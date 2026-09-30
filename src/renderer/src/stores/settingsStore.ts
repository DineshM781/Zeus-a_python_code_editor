// ============================================================
// ZEUS — Settings Store (Zustand)
// ============================================================

import { create } from 'zustand'
import type { ZeusSettings } from '../../../shared/types'
import { DEFAULT_SETTINGS } from '../../../shared/types'

interface SettingsState {
  settings: ZeusSettings
  isLoaded: boolean
  isOpen: boolean

  // Actions
  load: () => Promise<void>
  update: <K extends keyof ZeusSettings>(section: K, values: Partial<ZeusSettings[K]>) => Promise<void>
  reset: (section?: keyof ZeusSettings) => Promise<void>
  openSettings: () => void
  closeSettings: () => void
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoaded: false,
  isOpen: false,

  load: async () => {
    try {
      const settings = await window.zeus.settings.get() as ZeusSettings
      set({ settings: { ...DEFAULT_SETTINGS, ...settings }, isLoaded: true })

      // Apply theme to document
      const theme = settings.editor?.theme || 'zeus-dark'
      document.documentElement.setAttribute('data-theme', theme)
    } catch (err) {
      console.error('[Settings] Failed to load:', err)
      set({ settings: DEFAULT_SETTINGS, isLoaded: true })
    }
  },

  update: async (section, values) => {
    const current = get().settings
    const updated = {
      ...current,
      [section]: { ...current[section], ...values }
    }
    set({ settings: updated })

    // Persist
    await window.zeus.settings.set(section, updated[section])

    // Side effects
    if (section === 'editor' && 'theme' in values) {
      const theme = (values as Partial<ZeusSettings['editor']>).theme || 'zeus-dark'
      document.documentElement.setAttribute('data-theme', theme)
    }
  },

  reset: async (section) => {
    await window.zeus.settings.reset(section)
    if (section) {
      set((state) => ({
        settings: {
          ...state.settings,
          [section]: DEFAULT_SETTINGS[section]
        }
      }))
    } else {
      set({ settings: DEFAULT_SETTINGS })
    }
  },

  openSettings: () => set({ isOpen: true }),
  closeSettings: () => set({ isOpen: false })
}))
