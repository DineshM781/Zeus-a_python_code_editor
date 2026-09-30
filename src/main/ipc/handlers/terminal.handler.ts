// ============================================================
// ZEUS — Terminal IPC Handler
// ============================================================

import { ipcMain, BrowserWindow } from 'electron'
import * as pty from 'node-pty'
import * as os from 'os'
import { IPC } from '../../../shared/ipc-channels'
import type { TerminalCreateOptions, TerminalDataEvent, ShellOption } from '../../../shared/types'

interface TerminalInstance {
  id: string
  pty: pty.IPty
}

const terminals = new Map<string, TerminalInstance>()

function detectShells(): ShellOption[] {
  const shells: ShellOption[] = []
  const platform = process.platform

  if (platform === 'win32') {
    // PowerShell 7+
    const ps7 = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'
    const fs = require('fs')
    if (fs.existsSync(ps7)) {
      shells.push({ name: 'PowerShell 7', path: ps7 })
    }
    // Windows PowerShell
    shells.push({ name: 'Windows PowerShell', path: 'powershell.exe' })
    // CMD
    shells.push({ name: 'Command Prompt', path: 'cmd.exe' })
    // Git Bash
    const gitBash = 'C:\\Program Files\\Git\\bin\\bash.exe'
    if (fs.existsSync(gitBash)) {
      shells.push({ name: 'Git Bash', path: gitBash, args: ['--login', '-i'] })
    }
  } else {
    // Unix shells
    const unixShells = [
      { name: 'Zsh', path: '/bin/zsh' },
      { name: 'Bash', path: '/bin/bash' },
      { name: 'Fish', path: '/usr/bin/fish' },
      { name: 'Sh', path: '/bin/sh' }
    ]
    for (const s of unixShells) {
      if (require('fs').existsSync(s.path)) {
        shells.push(s)
      }
    }
  }

  return shells
}

function getDefaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'cmd.exe'
  }
  return process.env.SHELL || '/bin/bash'
}

export function registerTerminalHandlers(win: BrowserWindow): void {
  ipcMain.handle(IPC.TERM_LIST_SHELLS, async () => {
    return detectShells()
  })

  ipcMain.handle(IPC.TERM_CREATE, async (_e, options: TerminalCreateOptions) => {
    const shell = options.shell || getDefaultShell()
    const cols = options.cols || 80
    const rows = options.rows || 24
    const cwd = options.cwd || os.homedir()

    try {
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          ...options.env
        } as Record<string, string>
      })

      ptyProcess.onData((data) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC.TERM_DATA, {
            id: options.id,
            data
          } satisfies TerminalDataEvent)
        }
      })

      ptyProcess.onExit(() => {
        terminals.delete(options.id)
        if (!win.isDestroyed()) {
          win.webContents.send(IPC.TERM_DATA, {
            id: options.id,
            data: '\r\n[Process exited]\r\n'
          } satisfies TerminalDataEvent)
        }
      })

      terminals.set(options.id, { id: options.id, pty: ptyProcess })
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(IPC.TERM_WRITE, async (_e, id: string, data: string) => {
    const term = terminals.get(id)
    if (term) {
      term.pty.write(data)
      return true
    }
    return false
  })

  ipcMain.handle(IPC.TERM_RESIZE, async (_e, id: string, cols: number, rows: number) => {
    const term = terminals.get(id)
    if (term) {
      try {
        term.pty.resize(cols, rows)
      } catch {
        // ignore resize errors
      }
      return true
    }
    return false
  })

  ipcMain.handle(IPC.TERM_KILL, async (_e, id: string) => {
    const term = terminals.get(id)
    if (term) {
      try {
        term.pty.kill()
      } catch {
        // already dead
      }
      terminals.delete(id)
      return true
    }
    return false
  })
}
