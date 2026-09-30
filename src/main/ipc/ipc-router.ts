// ============================================================
// ZEUS — IPC Router
// ============================================================
// Registers all IPC handlers from individual service handlers.
// ============================================================

import { BrowserWindow } from 'electron'
import { registerFsHandlers } from './handlers/fs.handler'
import { registerPythonHandlers } from './handlers/python.handler'
import { registerTerminalHandlers } from './handlers/terminal.handler'
import { registerDiagnosticsHandlers } from './handlers/diagnostics.handler'
import { registerGitHandlers } from './handlers/git.handler'
import { registerKernelHandlers } from './handlers/kernel.handler'
import { registerDebugHandlers } from './handlers/debug.handler'
import { registerSettingsHandlers } from './handlers/settings.handler'
import { registerAppHandlers } from './handlers/app.handler'

export function registerAllHandlers(win: BrowserWindow): void {
  registerFsHandlers(win)
  registerPythonHandlers(win)
  registerTerminalHandlers(win)
  registerDiagnosticsHandlers(win)
  registerGitHandlers(win)
  registerKernelHandlers(win)
  registerDebugHandlers(win)
  registerSettingsHandlers()
  registerAppHandlers(win)
}
