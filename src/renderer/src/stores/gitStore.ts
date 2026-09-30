// ============================================================
// ZEUS — Git Store (Zustand)
// ============================================================

import { create } from 'zustand'
import type { GitStatus, GitBranch, GitDiff } from '../../../shared/types'

interface GitState {
  isGitRepo: boolean
  status: GitStatus | null
  branches: GitBranch[]
  diff: GitDiff[]
  commitMessage: string
  isLoading: boolean
  isPanelOpen: boolean
  error: string | null

  // Actions
  refresh: (repoPath: string) => Promise<void>
  stage: (repoPath: string, files: string[]) => Promise<void>
  unstage: (repoPath: string, files: string[]) => Promise<void>
  commit: (repoPath: string) => Promise<void>
  push: (repoPath: string) => Promise<void>
  pull: (repoPath: string) => Promise<void>
  checkout: (repoPath: string, branch: string) => Promise<void>
  setCommitMessage: (msg: string) => void
  openPanel: () => void
  closePanel: () => void
}

export const useGitStore = create<GitState>()((set, get) => ({
  isGitRepo: false,
  status: null,
  branches: [],
  diff: [],
  commitMessage: '',
  isLoading: false,
  isPanelOpen: false,
  error: null,

  refresh: async (repoPath) => {
    set({ isLoading: true, error: null })
    try {
      const [status, branches] = await Promise.all([
        window.zeus.git.status(repoPath),
        window.zeus.git.branches(repoPath).catch(() => [] as GitBranch[])
      ])

      set({ status, branches, isGitRepo: status !== null, isLoading: false })
    } catch {
      set({ isGitRepo: false, status: null, isLoading: false })
    }
  },

  stage: async (repoPath, files) => {
    await window.zeus.git.stage(repoPath, files)
    await get().refresh(repoPath)
  },

  unstage: async (repoPath, files) => {
    await window.zeus.git.unstage(repoPath, files)
    await get().refresh(repoPath)
  },

  commit: async (repoPath) => {
    const { commitMessage } = get()
    if (!commitMessage.trim()) return

    set({ isLoading: true })
    try {
      await window.zeus.git.commit(repoPath, commitMessage)
      set({ commitMessage: '' })
      await get().refresh(repoPath)
    } catch (err) {
      set({ error: String(err), isLoading: false })
    }
  },

  push: async (repoPath) => {
    set({ isLoading: true })
    try {
      await window.zeus.git.push(repoPath)
      await get().refresh(repoPath)
    } catch (err) {
      set({ error: String(err), isLoading: false })
    }
  },

  pull: async (repoPath) => {
    set({ isLoading: true })
    try {
      await window.zeus.git.pull(repoPath)
      await get().refresh(repoPath)
    } catch (err) {
      set({ error: String(err), isLoading: false })
    }
  },

  checkout: async (repoPath, branch) => {
    await window.zeus.git.checkout(repoPath, branch)
    await get().refresh(repoPath)
  },

  setCommitMessage: (msg) => set({ commitMessage: msg }),
  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false })
}))
