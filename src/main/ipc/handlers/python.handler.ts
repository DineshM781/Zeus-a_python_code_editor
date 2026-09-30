// ============================================================
// ZEUS — Python IPC Handler
// ============================================================

import { ipcMain, BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { IPC } from '../../../shared/ipc-channels'
import type { PythonEnvironment, PythonRunOptions, PythonRunChunk } from '../../../shared/types'

const runningProcesses = new Map<string, ChildProcess>()

function detectPythonVersions(): PythonEnvironment[] {
  const candidates: string[] = ['python3', 'python', 'py']
  const found: PythonEnvironment[] = []

  for (const cmd of candidates) {
    try {
      const result = require('child_process').execSync(`${cmd} --version 2>&1`, {
        timeout: 2000,
        encoding: 'utf8'
      }) as string
      const match = result.match(/Python (\d+\.\d+\.\d+)/)
      if (match) {
        found.push({
          path: cmd,
          version: match[1],
          name: `system (${cmd})`,
          isVenv: false
        })
      }
    } catch {
      // not found
    }
  }

  return found
}

function findVenvInProject(projectRoot: string): PythonEnvironment[] {
  const venvNames = ['.venv', 'venv', 'env', '.env']
  const found: PythonEnvironment[] = []

  for (const name of venvNames) {
    const venvPath = path.join(projectRoot, name)
    const pythonPath = process.platform === 'win32'
      ? path.join(venvPath, 'Scripts', 'python.exe')
      : path.join(venvPath, 'bin', 'python')

    if (fs.existsSync(pythonPath)) {
      try {
        const result = require('child_process').execSync(
          `"${pythonPath}" --version 2>&1`,
          { timeout: 2000, encoding: 'utf8' }
        ) as string
        const match = result.match(/Python (\d+\.\d+\.\d+)/)
        if (match) {
          found.push({
            path: pythonPath,
            version: match[1],
            name,
            isVenv: true
          })
        }
      } catch {
        // invalid venv
      }
    }
  }

  return found
}

export function registerPythonHandlers(win: BrowserWindow): void {
  ipcMain.handle(IPC.PYTHON_DETECT, async (_e, projectRoot?: string) => {
    const system = detectPythonVersions()
    const venvs = projectRoot ? findVenvInProject(projectRoot) : []
    return [...venvs, ...system]
  })

  ipcMain.handle(IPC.PYTHON_GET_ENVS, async (_e, projectRoot?: string) => {
    const system = detectPythonVersions()
    const venvs = projectRoot ? findVenvInProject(projectRoot) : []
    return [...venvs, ...system]
  })

  ipcMain.handle(IPC.PYTHON_RUN, async (_e, options: PythonRunOptions) => {
    return new Promise<{ exitCode: number }>((resolve, reject) => {
      const args: string[] = []
      let tmpFile: string | null = null

      if (options.filePath) {
        args.push(options.filePath)
      } else if (options.code) {
        // Write code to temp file
        tmpFile = path.join(os.tmpdir(), `zeus_run_${options.runId}.py`)
        fs.writeFileSync(tmpFile, options.code, 'utf-8')
        args.push(tmpFile)
      } else {
        reject(new Error('Either filePath or code must be provided'))
        return
      }

      const proc = spawn(options.pythonPath || 'python', args, {
        cwd: options.cwd || (options.filePath ? path.dirname(options.filePath) : undefined),
        env: { ...process.env, ...options.env },
        stdio: ['pipe', 'pipe', 'pipe']
      })

      runningProcesses.set(options.runId, proc)

      proc.stdout?.on('data', (data: Buffer) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC.PYTHON_RUN_OUTPUT, {
            runId: options.runId,
            stream: 'stdout',
            data: data.toString('utf-8')
          } satisfies PythonRunChunk)
        }
      })

      proc.stderr?.on('data', (data: Buffer) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC.PYTHON_RUN_OUTPUT, {
            runId: options.runId,
            stream: 'stderr',
            data: data.toString('utf-8')
          } satisfies PythonRunChunk)
        }
      })

      proc.on('close', (code) => {
        runningProcesses.delete(options.runId)
        if (tmpFile) {
          fs.unlink(tmpFile, () => {})
        }
        resolve({ exitCode: code ?? 0 })
      })

      proc.on('error', (err) => {
        runningProcesses.delete(options.runId)
        if (tmpFile) {
          fs.unlink(tmpFile, () => {})
        }
        reject(err)
      })
    })
  })

  ipcMain.handle(IPC.PYTHON_KILL, async (_e, runId: string) => {
    const proc = runningProcesses.get(runId)
    if (proc) {
      proc.kill('SIGTERM')
      setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL')
      }, 2000)
      runningProcesses.delete(runId)
      return true
    }
    return false
  })
}
