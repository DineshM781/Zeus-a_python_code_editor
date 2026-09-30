// ============================================================
// ZEUS — Debug IPC Handler (DAP via debugpy)
// ============================================================
// Debug services start ONLY when debugging is requested.
// ============================================================

import { ipcMain, BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import * as net from 'net'
import * as path from 'path'
import { IPC } from '../../../shared/ipc-channels'
import type { Breakpoint, DebugEvent, StackFrame, Variable } from '../../../shared/types'

interface DebugSession {
  id: string
  process: ChildProcess
  client: net.Socket | null
  port: number
  seq: number
  pendingRequests: Map<number, (response: unknown) => void>
}

let activeSession: DebugSession | null = null

function findFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.listen(0, () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 5678
      server.close(() => resolve(port))
    })
  })
}

function sendDapRequest(
  session: DebugSession,
  command: string,
  args: unknown
): Promise<unknown> {
  return new Promise((resolve) => {
    const seq = ++session.seq
    const msg = JSON.stringify({ seq, type: 'request', command, arguments: args })
    const header = `Content-Length: ${Buffer.byteLength(msg, 'utf8')}\r\n\r\n`

    session.pendingRequests.set(seq, resolve)
    session.client?.write(header + msg)

    // Timeout after 5s
    setTimeout(() => {
      if (session.pendingRequests.has(seq)) {
        session.pendingRequests.delete(seq)
        resolve(null)
      }
    }, 5000)
  })
}

export function registerDebugHandlers(win: BrowserWindow): void {
  ipcMain.handle(IPC.DEBUG_START, async (
    _e,
    filePath: string,
    pythonPath: string,
    breakpoints: Breakpoint[]
  ) => {
    if (activeSession) {
      try {
        activeSession.process.kill()
        activeSession.client?.destroy()
      } catch { /* ignore */ }
      activeSession = null
    }

    const port = await findFreePort()

    const proc = spawn(pythonPath || 'python', [
      '-m', 'debugpy',
      '--listen', `127.0.0.1:${port}`,
      '--wait-for-client',
      filePath
    ], {
      cwd: path.dirname(filePath),
      env: process.env as Record<string, string>,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    proc.stderr?.on('data', (d: Buffer) => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.DEBUG_EVENT, {
          type: 'output',
          category: 'stderr',
          output: d.toString()
        } satisfies DebugEvent)
      }
    })

    proc.on('exit', (code) => {
      activeSession = null
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.DEBUG_EVENT, {
          type: 'exited',
          exitCode: code ?? 0
        } satisfies DebugEvent)
      }
    })

    const session: DebugSession = {
      id: `debug_${Date.now()}`,
      process: proc,
      client: null,
      port,
      seq: 0,
      pendingRequests: new Map()
    }

    // Connect to DAP server
    await new Promise<void>((resolve) => {
      let attempts = 0
      const tryConnect = () => {
        const socket = net.connect(port, '127.0.0.1', () => {
          session.client = socket
          resolve()
        })
        socket.on('error', () => {
          attempts++
          if (attempts < 20) {
            setTimeout(tryConnect, 300)
          } else {
            resolve() // give up connecting
          }
        })
      }
      setTimeout(tryConnect, 500) // wait for debugpy to start
    })

    if (session.client) {
      let buffer = ''
      session.client.on('data', (data: Buffer) => {
        buffer += data.toString()
        // Parse DAP messages
        while (true) {
          const headerEnd = buffer.indexOf('\r\n\r\n')
          if (headerEnd === -1) break
          const headerStr = buffer.slice(0, headerEnd)
          const lenMatch = headerStr.match(/Content-Length: (\d+)/)
          if (!lenMatch) break
          const bodyLen = parseInt(lenMatch[1])
          const bodyStart = headerEnd + 4
          if (buffer.length < bodyStart + bodyLen) break

          const bodyStr = buffer.slice(bodyStart, bodyStart + bodyLen)
          buffer = buffer.slice(bodyStart + bodyLen)

          try {
            const msg = JSON.parse(bodyStr) as { type: string; event?: string; body?: unknown; request_seq?: number }
            if (msg.type === 'event') {
              handleDapEvent(msg.event || '', msg.body, win)
            } else if (msg.type === 'response' && msg.request_seq) {
              const handler = session.pendingRequests.get(msg.request_seq)
              if (handler) {
                session.pendingRequests.delete(msg.request_seq)
                handler(msg)
              }
            }
          } catch { /* bad json */ }
        }
      })

      // Initialize DAP session
      await sendDapRequest(session, 'initialize', {
        clientID: 'zeus',
        adapterID: 'python',
        pathFormat: 'path',
        linesStartAt1: true,
        columnsStartAt1: true
      })

      // Set breakpoints
      const bpsByFile = new Map<string, Breakpoint[]>()
      for (const bp of breakpoints) {
        const list = bpsByFile.get(bp.filePath) || []
        list.push(bp)
        bpsByFile.set(bp.filePath, list)
      }

      for (const [file, bps] of bpsByFile.entries()) {
        await sendDapRequest(session, 'setBreakpoints', {
          source: { path: file },
          breakpoints: bps.map((bp) => ({
            line: bp.line,
            condition: bp.condition
          }))
        })
      }

      await sendDapRequest(session, 'launch', {
        program: filePath,
        stopOnEntry: false,
        justMyCode: true
      })

      await sendDapRequest(session, 'configurationDone', {})
    }

    activeSession = session
    return { success: true, sessionId: session.id, port }
  })

  ipcMain.handle(IPC.DEBUG_STOP, async () => {
    if (activeSession) {
      try {
        await sendDapRequest(activeSession, 'disconnect', { restart: false })
        activeSession.process.kill()
        activeSession.client?.destroy()
      } catch { /* ignore */ }
      activeSession = null
    }
    return true
  })

  ipcMain.handle(IPC.DEBUG_CONTINUE, async () => {
    if (activeSession?.client) {
      await sendDapRequest(activeSession, 'continue', { threadId: 1 })
    }
    return true
  })

  ipcMain.handle(IPC.DEBUG_PAUSE, async () => {
    if (activeSession?.client) {
      await sendDapRequest(activeSession, 'pause', { threadId: 1 })
    }
    return true
  })

  ipcMain.handle(IPC.DEBUG_STEP_OVER, async () => {
    if (activeSession?.client) {
      await sendDapRequest(activeSession, 'next', { threadId: 1 })
    }
    return true
  })

  ipcMain.handle(IPC.DEBUG_STEP_IN, async () => {
    if (activeSession?.client) {
      await sendDapRequest(activeSession, 'stepIn', { threadId: 1 })
    }
    return true
  })

  ipcMain.handle(IPC.DEBUG_STEP_OUT, async () => {
    if (activeSession?.client) {
      await sendDapRequest(activeSession, 'stepOut', { threadId: 1 })
    }
    return true
  })

  ipcMain.handle(IPC.DEBUG_SET_BREAKPOINTS, async (_e, bps: Breakpoint[]) => {
    if (!activeSession?.client) return false
    const bpsByFile = new Map<string, Breakpoint[]>()
    for (const bp of bps) {
      const list = bpsByFile.get(bp.filePath) || []
      list.push(bp)
      bpsByFile.set(bp.filePath, list)
    }
    for (const [file, fileBps] of bpsByFile.entries()) {
      await sendDapRequest(activeSession, 'setBreakpoints', {
        source: { path: file },
        breakpoints: fileBps.map((bp) => ({ line: bp.line }))
      })
    }
    return true
  })
}

function handleDapEvent(event: string, body: unknown, win: BrowserWindow): void {
  if (win.isDestroyed()) return

  const b = body as Record<string, unknown>

  switch (event) {
    case 'stopped':
      win.webContents.send(IPC.DEBUG_EVENT, {
        type: 'stopped',
        reason: (b?.reason as string) || 'breakpoint',
        filePath: (b?.source as Record<string, string>)?.path || '',
        line: (b?.line as number) || 0
      } satisfies DebugEvent)
      break
    case 'continued':
      win.webContents.send(IPC.DEBUG_EVENT, { type: 'continued' } satisfies DebugEvent)
      break
    case 'exited':
      win.webContents.send(IPC.DEBUG_EVENT, {
        type: 'exited',
        exitCode: (b?.exitCode as number) ?? 0
      } satisfies DebugEvent)
      break
    case 'output':
      win.webContents.send(IPC.DEBUG_EVENT, {
        type: 'output',
        category: (b?.category as string) || 'console',
        output: (b?.output as string) || ''
      } satisfies DebugEvent)
      break
  }
}
