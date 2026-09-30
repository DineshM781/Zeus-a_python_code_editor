// ============================================================
// ZEUS — Settings IPC Handler
// ============================================================

import { ipcMain } from 'electron'
import Store from 'electron-store'
import { IPC } from '../../../shared/ipc-channels'
import type { ZeusSettings } from '../../../shared/types'
import { DEFAULT_SETTINGS } from '../../../shared/types'

const store = new Store<ZeusSettings>({
  name: 'zeus-settings',
  defaults: DEFAULT_SETTINGS
})

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.SETTINGS_GET, async (_e, key?: keyof ZeusSettings) => {
    if (key) {
      return store.get(key)
    }
    return store.store
  })

  ipcMain.handle(IPC.SETTINGS_SET, async (_e, key: string, value: unknown) => {
    store.set(key, value)
    return true
  })

  ipcMain.handle(IPC.SETTINGS_RESET, async (_e, key?: keyof ZeusSettings) => {
    if (key) {
      store.set(key, DEFAULT_SETTINGS[key])
    } else {
      store.clear()
    }
    return true
  })
}
