// ============================================================
// ZEUS — Terminal Store (Zustand)
// ============================================================

import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type { ShellOption } from '../../../shared/types'

export interface TerminalTab {
  id: string
  title: string
  shell: string
  isActive: boolean
  pid?: number
}

export type PanelTab = 'problems' | 'output' | 'terminal'

interface TerminalState {
  tabs: TerminalTab[]
  activeTerminalId: string | null
  availableShells: ShellOption[]
  isVisible: boolean
  activePanelTab: PanelTab

  // Actions
  initShells: () => Promise<void>
  createTerminal: (shell?: string, cwd?: string) => Promise<string>
  killTerminal: (id: string) => Promise<void>
  setActiveTerminal: (id: string) => void
  setVisible: (visible: boolean) => void
  toggleVisible: () => void
  renameTerminal: (id: string, title: string) => void
  setActivePanelTab: (tab: PanelTab) => void
  executeCommand: (cmd: string, cwd?: string) => Promise<void>
}

export const useTerminalStore = create<TerminalState>()((set, get) => ({
  tabs: [],
  activeTerminalId: null,
  availableShells: [],
  isVisible: true,
  activePanelTab: 'terminal',

  initShells: async () => {
    const shells = await window.zeus.terminal.listShells()
    set({ availableShells: shells })
  },

  createTerminal: async (shell, cwd) => {
    const id = uuid()
    const shells = get().availableShells
    const selectedShell = shell || shells[0]?.path || ''

    const result = await window.zeus.terminal.create({
      id,
      shell: selectedShell,
      cwd
    })

    if (result.success) {
      const shellName = shells.find((s) => s.path === selectedShell)?.name || 'Terminal'
      const tab: TerminalTab = {
        id,
        title: shellName,
        shell: selectedShell,
        isActive: true
      }

      set((state) => ({
        tabs: [...state.tabs, tab],
        activeTerminalId: id,
        isVisible: true
      }))
    }

    return id
  },

  killTerminal: async (id) => {
    await window.zeus.terminal.kill(id)
    set((state) => {
      const tabs = state.tabs.filter((t) => t.id !== id)
      const activeTerminalId =
        state.activeTerminalId === id
          ? tabs[tabs.length - 1]?.id || null
          : state.activeTerminalId
      return { tabs, activeTerminalId }
    })
  },

  setActiveTerminal: (id) => set({ activeTerminalId: id }),

  setVisible: (visible) => set({ isVisible: visible }),

  toggleVisible: () => set((state) => ({ isVisible: !state.isVisible })),

  renameTerminal: (id, title) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, title } : t))
    }))
  },

  setActivePanelTab: (tab) => set({ activePanelTab: tab }),

  executeCommand: async (cmd, cwd) => {
    let termId = get().activeTerminalId
    if (!termId || get().tabs.length === 0) {
      termId = await get().createTerminal(undefined, cwd)
      // Allow shell to initialize before sending command
      await new Promise((r) => setTimeout(r, 450))
    }
    set({ isVisible: true, activePanelTab: 'terminal' })
    if (termId) {
      await window.zeus.terminal.write(termId, `${cmd}\r`)
    }
  }
}))
