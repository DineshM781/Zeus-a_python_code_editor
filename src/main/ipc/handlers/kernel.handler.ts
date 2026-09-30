// ============================================================
// ZEUS — Jupyter Kernel IPC Handler (Lazy-loaded)
// ============================================================
// Kernel services are started ONLY when a .ipynb file is opened.
// ============================================================

import { ipcMain, BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import { IPC } from '../../../shared/ipc-channels'
import type { KernelInfo, KernelState, KernelOutput } from '../../../shared/types'
import { v4 as uuid } from 'uuid'

interface KernelSession {
  id: string
  process: ChildProcess
  state: KernelState
  connectionFile: string
}

const kernels = new Map<string, KernelSession>()

// Simple Jupyter kernel launcher using python -m ipykernel
async function startKernel(
  pythonPath: string,
  cwd: string,
  id: string,
  win: BrowserWindow
): Promise<KernelSession> {
  const connFile = path.join(os.tmpdir(), `zeus_kernel_${id}.json`)

  const proc = spawn(pythonPath, [
    '-m', 'ipykernel_launcher',
    '-f', connFile
  ], {
    cwd,
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe']
  })

  proc.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString()
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.KERNEL_STATUS, { id, state: 'busy', message: msg })
    }
  })

  proc.on('exit', () => {
    kernels.delete(id)
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.KERNEL_STATUS, { id, state: 'dead' })
    }
  })

  // Wait briefly for connection file to be created
  await new Promise<void>((resolve) => {
    let attempts = 0
    const interval = setInterval(() => {
      if (fs.existsSync(connFile) || attempts > 20) {
        clearInterval(interval)
        resolve()
      }
      attempts++
    }, 500)
  })

  const session: KernelSession = {
    id,
    process: proc,
    state: 'idle',
    connectionFile: connFile
  }

  kernels.set(id, session)
  return session
}

export function registerKernelHandlers(win: BrowserWindow): void {
  ipcMain.handle(IPC.KERNEL_START, async (
    _e,
    pythonPath: string,
    cwd: string
  ): Promise<KernelInfo | { error: string }> => {
    const id = uuid()
    try {
      const session = await startKernel(pythonPath || 'python', cwd || os.homedir(), id, win)
      return {
        id,
        name: 'python3',
        language: 'python',
        state: session.state
      }
    } catch (err) {
      return { error: String(err) }
    }
  })

  ipcMain.handle(IPC.KERNEL_STOP, async (_e, kernelId: string) => {
    const kernel = kernels.get(kernelId)
    if (kernel) {
      try {
        kernel.process.kill('SIGTERM')
        fs.unlink(kernel.connectionFile, () => {})
      } catch { /* already dead */ }
      kernels.delete(kernelId)
      return true
    }
    return false
  })

  ipcMain.handle(IPC.KERNEL_INTERRUPT, async (_e, kernelId: string) => {
    const kernel = kernels.get(kernelId)
    if (kernel) {
      try {
        kernel.process.kill('SIGINT')
      } catch { /* ignore */ }
      return true
    }
    return false
  })

  ipcMain.handle(IPC.KERNEL_RESTART, async (_e, kernelId: string, pythonPath: string, cwd: string) => {
    // Stop existing
    const kernel = kernels.get(kernelId)
    if (kernel) {
      try {
        kernel.process.kill('SIGTERM')
        fs.unlink(kernel.connectionFile, () => {})
      } catch { /* ignore */ }
      kernels.delete(kernelId)
    }

    // Start new with same ID
    try {
      await startKernel(pythonPath || 'python', cwd || os.homedir(), kernelId, win)
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.KERNEL_STATUS, { id: kernelId, state: 'idle' })
      }
      return { success: true }
    } catch (err) {
      return { error: String(err) }
    }
  })

  // Execute cell via subprocess (simplified: run cell code with python)
  // For full Jupyter protocol, this would use ZMQ messaging
  ipcMain.handle(IPC.KERNEL_EXECUTE, async (
    _e,
    executionId: string,
    kernelId: string,
    code: string,
    pythonPath: string,
    cwd: string
  ) => {
    if (!code.trim()) {
      return { executionCount: 0 }
    }

    const kernel = kernels.get(kernelId)
    const python = pythonPath || 'python'

    // Write code to temp file and execute
    const tmpFile = path.join(os.tmpdir(), `zeus_cell_${executionId}.py`)
    fs.writeFileSync(tmpFile, code, 'utf-8')

    return new Promise<{ executionCount: number }>((resolve) => {
      const proc = spawn(python, [tmpFile], {
        cwd: cwd || os.homedir(),
        env: process.env as Record<string, string>,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString()
        if (!win.isDestroyed()) {
          win.webContents.send(IPC.KERNEL_OUTPUT, {
            executionId,
            type: 'stream',
            data: { text: data.toString() },
            text: data.toString()
          } satisfies KernelOutput)
        }
      })

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        fs.unlink(tmpFile, () => {})

        if (stderr && !win.isDestroyed()) {
          win.webContents.send(IPC.KERNEL_OUTPUT, {
            executionId,
            type: 'error',
            data: { text: stderr },
            ename: 'Error',
            evalue: stderr.split('\n')[0],
            traceback: stderr.split('\n')
          } satisfies KernelOutput)
        }

        resolve({ executionCount: 1 })
      })

      proc.on('error', (err) => {
        fs.unlink(tmpFile, () => {})
        if (!win.isDestroyed()) {
          win.webContents.send(IPC.KERNEL_OUTPUT, {
            executionId,
            type: 'error',
            data: { text: err.message },
            ename: 'KernelError',
            evalue: err.message,
            traceback: [err.message]
          } satisfies KernelOutput)
        }
        resolve({ executionCount: 0 })
      })
    })
  })

  ipcMain.handle(IPC.KERNEL_LIST, async () => {
    return Array.from(kernels.entries()).map(([id, k]) => ({
      id,
      name: 'python3',
      language: 'python',
      state: k.state
    } satisfies KernelInfo))
  })
}
