// ============================================================
// ZEUS — Explorer Store (Zustand)
// ============================================================

import { create } from 'zustand'
import type { FileEntry, FileChangeEvent } from '../../../shared/types'

interface ExplorerState {
  projectRoot: string | null
  fileTree: FileEntry[]
  expandedPaths: Set<string>
  selectedPath: string | null
  isLoading: boolean

  // Actions
  setProjectRoot: (root: string) => Promise<void>
  refreshTree: () => Promise<void>
  toggleExpanded: (path: string) => void
  setSelected: (path: string | null) => void
  handleFsChange: (event: FileChangeEvent) => void
  createFile: (dirPath: string, name: string) => Promise<string | null>
  createDir: (dirPath: string, name: string) => Promise<boolean>
  deleteEntry: (path: string) => Promise<boolean>
  renameEntry: (oldPath: string, newName: string) => Promise<string | null>
}

async function loadTree(root: string): Promise<FileEntry[]> {
  return window.zeus.fs.listDir(root)
}

export const useExplorerStore = create<ExplorerState>()((set, get) => ({
  projectRoot: null,
  fileTree: [],
  expandedPaths: new Set(),
  selectedPath: null,
  isLoading: false,

  setProjectRoot: async (root) => {
    set({ projectRoot: root, isLoading: true, fileTree: [] })

    try {
      // Start file watcher
      await window.zeus.fs.watchStart(root)

      // Load initial tree
      const tree = await loadTree(root)
      set({ fileTree: tree, isLoading: false, expandedPaths: new Set([root]) })

      // Set up FS change handler
      window.zeus.fs.onChanged((event) => {
        get().handleFsChange(event)
      })
    } catch (err) {
      console.error('[Explorer] Failed to load directory:', err)
      set({ isLoading: false })
    }
  },

  refreshTree: async () => {
    const { projectRoot } = get()
    if (!projectRoot) return
    set({ isLoading: true })
    const tree = await loadTree(projectRoot)
    set({ fileTree: tree, isLoading: false })
  },

  toggleExpanded: (path) => {
    set((state) => {
      const next = new Set(state.expandedPaths)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return { expandedPaths: next }
    })
  },

  setSelected: (path) => set({ selectedPath: path }),

  handleFsChange: (_event) => {
    // Debounce: refresh tree on FS change
    // In production: do incremental update instead of full refresh
    const state = get()
    if (state.projectRoot) {
      clearTimeout((globalThis as any).__explorerRefreshTimer)
      ;(globalThis as any).__explorerRefreshTimer = setTimeout(() => {
        state.refreshTree()
      }, 300)
    }
  },

  createFile: async (dirPath, name) => {
    const filePath = `${dirPath}/${name}`.replace(/\\/g, '/')
    try {
      await window.zeus.fs.createFile(filePath)
      await get().refreshTree()
      return filePath
    } catch {
      return null
    }
  },

  createDir: async (dirPath, name) => {
    const newPath = `${dirPath}/${name}`.replace(/\\/g, '/')
    try {
      await window.zeus.fs.createDir(newPath)
      await get().refreshTree()
      return true
    } catch {
      return false
    }
  },

  deleteEntry: async (path) => {
    try {
      await window.zeus.fs.delete(path)
      await get().refreshTree()
      return true
    } catch {
      return false
    }
  },

  renameEntry: async (oldPath, newName) => {
    const parts = oldPath.replace(/\\/g, '/').split('/')
    parts[parts.length - 1] = newName
    const newPath = parts.join('/')
    try {
      await window.zeus.fs.rename(oldPath, newPath)
      await get().refreshTree()
      return newPath
    } catch {
      return null
    }
  }
}))
