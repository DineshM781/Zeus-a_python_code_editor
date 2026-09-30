// ============================================================
// ZEUS — Debug Store (Zustand)
// ============================================================

import { create } from 'zustand'
import type { Breakpoint, DebugEvent, StackFrame, Variable } from '../../../shared/types'
import { v4 as uuid } from 'uuid'

export type DebugState_t = 'idle' | 'running' | 'paused' | 'stopped'

interface DebugStoreState {
  state: DebugState_t
  breakpoints: Breakpoint[]
  currentFrame: { filePath: string; line: number } | null
  stackFrames: StackFrame[]
  variables: Variable[]
  output: Array<{ category: string; text: string }>
  isVisible: boolean

  // Actions
  startDebug: (filePath: string, pythonPath: string) => Promise<void>
  stopDebug: () => Promise<void>
  continue: () => Promise<void>
  pause: () => Promise<void>
  stepOver: () => Promise<void>
  stepIn: () => Promise<void>
  stepOut: () => Promise<void>
  toggleBreakpoint: (filePath: string, line: number) => void
  clearBreakpoints: (filePath?: string) => void
  handleEvent: (event: DebugEvent) => void
  setVisible: (v: boolean) => void
  getBreakpointsForFile: (filePath: string) => Breakpoint[]
}

export const useDebugStore = create<DebugStoreState>()((set, get) => ({
  state: 'idle',
  breakpoints: [],
  currentFrame: null,
  stackFrames: [],
  variables: [],
  output: [],
  isVisible: false,

  startDebug: async (filePath, pythonPath) => {
    const { breakpoints } = get()
    set({ state: 'running', output: [], currentFrame: null, isVisible: true })

    // Subscribe to debug events
    window.zeus.debug.onEvent((event) => {
      get().handleEvent(event)
    })

    try {
      await window.zeus.debug.start(filePath, pythonPath, breakpoints)
    } catch (err) {
      set({ state: 'idle' })
      console.error('[Debug] Failed to start:', err)
    }
  },

  stopDebug: async () => {
    await window.zeus.debug.stop()
    set({ state: 'idle', currentFrame: null })
  },

  continue: async () => {
    await window.zeus.debug.continue()
    set({ state: 'running', currentFrame: null })
  },

  pause: async () => {
    await window.zeus.debug.pause()
  },

  stepOver: async () => {
    await window.zeus.debug.stepOver()
    set({ state: 'running' })
  },

  stepIn: async () => {
    await window.zeus.debug.stepIn()
    set({ state: 'running' })
  },

  stepOut: async () => {
    await window.zeus.debug.stepOut()
    set({ state: 'running' })
  },

  toggleBreakpoint: (filePath, line) => {
    set((state) => {
      const existing = state.breakpoints.findIndex(
        (bp) => bp.filePath === filePath && bp.line === line
      )
      let breakpoints: Breakpoint[]
      if (existing !== -1) {
        breakpoints = state.breakpoints.filter((_, i) => i !== existing)
      } else {
        breakpoints = [...state.breakpoints, {
          id: uuid(),
          filePath,
          line,
          enabled: true
        }]
      }
      // Sync to debug session if active
      if (state.state !== 'idle') {
        window.zeus.debug.setBreakpoints(breakpoints)
      }
      return { breakpoints }
    })
  },

  clearBreakpoints: (filePath) => {
    set((state) => ({
      breakpoints: filePath
        ? state.breakpoints.filter((bp) => bp.filePath !== filePath)
        : []
    }))
  },

  handleEvent: (event) => {
    switch (event.type) {
      case 'stopped':
        set({
          state: 'paused',
          currentFrame: { filePath: event.filePath, line: event.line }
        })
        break
      case 'continued':
        set({ state: 'running', currentFrame: null })
        break
      case 'exited':
        set({ state: 'stopped', currentFrame: null })
        setTimeout(() => set({ state: 'idle' }), 2000)
        break
      case 'output':
        set((s) => ({
          output: [...s.output, { category: event.category, text: event.output }].slice(-5000)
        }))
        break
    }
  },

  setVisible: (v) => set({ isVisible: v }),

  getBreakpointsForFile: (filePath) => {
    return get().breakpoints.filter((bp) => bp.filePath === filePath)
  }
}))
