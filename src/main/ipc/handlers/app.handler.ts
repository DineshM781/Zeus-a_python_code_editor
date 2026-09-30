// ============================================================
// ZEUS — App IPC Handler
// ============================================================

import { ipcMain, BrowserWindow, app, shell } from 'electron'
import { IPC } from '../../../shared/ipc-channels'

export function registerAppHandlers(win: BrowserWindow): void {
  ipcMain.handle(IPC.APP_GET_VERSION, () => app.getVersion())

  ipcMain.handle(IPC.APP_QUIT, () => {
    app.quit()
  })

  ipcMain.handle(IPC.APP_MINIMIZE, () => {
    win.minimize()
  })

  ipcMain.handle(IPC.APP_MAXIMIZE, () => {
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  ipcMain.handle(IPC.APP_OPEN_EXTERNAL, async (_e, url: string) => {
    await shell.openExternal(url)
    return true
  })

  ipcMain.handle(IPC.SHELL_OPEN_PATH, async (_e, filePath: string) => {
    await shell.openPath(filePath)
    return true
  })
}
