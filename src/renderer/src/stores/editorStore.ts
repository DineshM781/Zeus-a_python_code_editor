// ============================================================
// ZEUS — Editor Store (Zustand)
// ============================================================

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { Diagnostic } from '../../../shared/types'

export interface EditorTab {
  id: string
  filePath: string
  fileName: string
  language: string
  content: string
  isDirty: boolean
  isPinned: boolean
  isReadOnly: boolean
  cursorLine: number
  cursorColumn: number
  scrollTop: number
}

export interface EditorGroup {
  id: string
  tabs: EditorTab[]
  activeTabId: string | null
  orientation: 'vertical' | 'horizontal'
}

interface EditorState {
  // File groups (split editor support)
  groups: EditorGroup[]
  activeGroupId: string

  // Diagnostics
  diagnostics: Record<string, Diagnostic[]> // filePath -> diagnostics

  // Run
  activeRunId: string | null
  runOutput: Array<{ stream: 'stdout' | 'stderr'; data: string }>

  // Actions
  openFile: (filePath: string, content: string, language: string) => void
  closeTab: (groupId: string, tabId: string) => void
  closeOtherTabs: (groupId: string, tabId: string) => void
  closeAllTabs: (groupId: string) => void
  setActiveTab: (groupId: string, tabId: string) => void
  updateContent: (tabId: string, content: string) => void
  markSaved: (tabId: string) => void
  pinTab: (groupId: string, tabId: string) => void
  setCursor: (tabId: string, line: number, col: number) => void
  setDiagnostics: (filePath: string, diagnostics: Diagnostic[]) => void
  setActiveRun: (runId: string | null) => void
  appendRunOutput: (stream: 'stdout' | 'stderr', data: string) => void
  clearRunOutput: () => void
  splitEditor: (groupId: string, orientation: 'vertical' | 'horizontal') => void
  getActiveTab: () => EditorTab | null
  getTabByPath: (filePath: string) => EditorTab | null
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    py: 'python', pyw: 'python',
    ipynb: 'json',
    js: 'javascript', jsx: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    json: 'json', jsonc: 'json',
    md: 'markdown', mdx: 'markdown',
    html: 'html', htm: 'html',
    css: 'css', scss: 'scss',
    yaml: 'yaml', yml: 'yaml',
    toml: 'toml',
    sh: 'shell', bash: 'shell',
    txt: 'plaintext',
    rs: 'rust', go: 'go', cpp: 'cpp',
    c: 'c', h: 'c', java: 'java'
  }
  return map[ext || ''] || 'plaintext'
}

const DEFAULT_GROUP: EditorGroup = {
  id: 'group-1',
  tabs: [],
  activeTabId: null,
  orientation: 'vertical'
}

export const useEditorStore = create<EditorState>()(
  subscribeWithSelector((set, get) => ({
    groups: [DEFAULT_GROUP],
    activeGroupId: 'group-1',
    diagnostics: {},
    activeRunId: null,
    runOutput: [],

    openFile: (filePath, content, language) => {
      set((state) => {
        const groups = [...state.groups]
        const groupIdx = groups.findIndex((g) => g.id === state.activeGroupId)
        const group = { ...groups[groupIdx] }

        // If already open, just activate
        const existingIdx = group.tabs.findIndex((t) => t.filePath === filePath)
        if (existingIdx !== -1) {
          group.activeTabId = group.tabs[existingIdx].id
          groups[groupIdx] = group
          return { groups }
        }

        const fileName = filePath.split(/[/\\]/).pop() || filePath
        const tab: EditorTab = {
          id: `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          filePath,
          fileName,
          language: language || detectLanguage(filePath),
          content,
          isDirty: false,
          isPinned: false,
          isReadOnly: false,
          cursorLine: 1,
          cursorColumn: 1,
          scrollTop: 0
        }

        group.tabs = [...group.tabs, tab]
        group.activeTabId = tab.id
        groups[groupIdx] = group

        return { groups }
      })
    },

    closeTab: (groupId, tabId) => {
      set((state) => {
        const groups = state.groups.map((g) => {
          if (g.id !== groupId) return g
          const tabs = g.tabs.filter((t) => t.id !== tabId)
          let activeTabId = g.activeTabId

          if (activeTabId === tabId) {
            const closedIdx = g.tabs.findIndex((t) => t.id === tabId)
            activeTabId = tabs[Math.min(closedIdx, tabs.length - 1)]?.id || null
          }

          return { ...g, tabs, activeTabId }
        })
        return { groups }
      })
    },

    closeOtherTabs: (groupId, tabId) => {
      set((state) => {
        const groups = state.groups.map((g) => {
          if (g.id !== groupId) return g
          const tab = g.tabs.find((t) => t.id === tabId)
          if (!tab) return g
          return { ...g, tabs: [tab], activeTabId: tabId }
        })
        return { groups }
      })
    },

    closeAllTabs: (groupId) => {
      set((state) => {
        const groups = state.groups.map((g) =>
          g.id === groupId ? { ...g, tabs: [], activeTabId: null } : g
        )
        return { groups }
      })
    },

    setActiveTab: (groupId, tabId) => {
      set((state) => {
        const groups = state.groups.map((g) =>
          g.id === groupId ? { ...g, activeTabId: tabId } : g
        )
        return { groups, activeGroupId: groupId }
      })
    },

    updateContent: (tabId, content) => {
      set((state) => {
        const groups = state.groups.map((g) => ({
          ...g,
          tabs: g.tabs.map((t) =>
            t.id === tabId ? { ...t, content, isDirty: true } : t
          )
        }))
        return { groups }
      })
    },

    markSaved: (tabId) => {
      set((state) => {
        const groups = state.groups.map((g) => ({
          ...g,
          tabs: g.tabs.map((t) =>
            t.id === tabId ? { ...t, isDirty: false } : t
          )
        }))
        return { groups }
      })
    },

    pinTab: (groupId, tabId) => {
      set((state) => {
        const groups = state.groups.map((g) => {
          if (g.id !== groupId) return g
          return {
            ...g,
            tabs: g.tabs.map((t) =>
              t.id === tabId ? { ...t, isPinned: !t.isPinned } : t
            )
          }
        })
        return { groups }
      })
    },

    setCursor: (tabId, line, col) => {
      set((state) => {
        const groups = state.groups.map((g) => ({
          ...g,
          tabs: g.tabs.map((t) =>
            t.id === tabId ? { ...t, cursorLine: line, cursorColumn: col } : t
          )
        }))
        return { groups }
      })
    },

    setDiagnostics: (filePath, diagnostics) => {
      set((state) => ({
        diagnostics: { ...state.diagnostics, [filePath]: diagnostics }
      }))
    },

    setActiveRun: (runId) => set({ activeRunId: runId }),

    appendRunOutput: (stream, data) => {
      set((state) => ({
        runOutput: [...state.runOutput, { stream, data }].slice(-10000)
      }))
    },

    clearRunOutput: () => set({ runOutput: [] }),

    splitEditor: (groupId, orientation) => {
      set((state) => {
        const sourceGroup = state.groups.find((g) => g.id === groupId)
        if (!sourceGroup) return {}
        const newGroup: EditorGroup = {
          id: `group-${Date.now()}`,
          tabs: [],
          activeTabId: null,
          orientation
        }
        return { groups: [...state.groups, newGroup], activeGroupId: newGroup.id }
      })
    },

    getActiveTab: () => {
      const state = get()
      const group = state.groups.find((g) => g.id === state.activeGroupId)
      if (!group || !group.activeTabId) return null
      return group.tabs.find((t) => t.id === group.activeTabId) || null
    },

    getTabByPath: (filePath) => {
      const state = get()
      for (const group of state.groups) {
        const tab = group.tabs.find((t) => t.filePath === filePath)
        if (tab) return tab
      }
      return null
    }
  }))
)
