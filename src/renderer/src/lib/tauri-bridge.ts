// ============================================================
// ZEUS — Tauri Bridge
// ============================================================
// This is the ONLY file in the frontend that knows about Tauri.
// It replaces the Electron preload's contextBridge / window.zeus.
//
// All other files in the renderer continue to use window.zeus.*
// exactly as before — this module installs the same API shape
// on window.zeus at startup.
//
// Architecture:
//   Electron:  window.zeus  ←  contextBridge ← ipcRenderer.invoke()
//   Tauri:     window.zeus  ←  tauri-bridge.ts ← invoke() + listen()
// ============================================================

import { invoke } from '@tauri-apps/api/core'
import { listen, emit, UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type {
  FileEntry, FileChangeEvent, PythonEnvironment, PythonRunOptions,
  TerminalCreateOptions, ShellOption, GitStatus, GitBranch, GitDiff,
  GitCommit, KernelInfo, KernelOutput, Breakpoint, DebugEvent,
  ZeusSettings, Diagnostic, DiagnosticsResult
} from '../../shared/types'

// ── File System API ──────────────────────────────────────────
const fsApi = {
  readFile: (filePath: string) =>
    invoke<string>('fs_read_file', { filePath }),

  writeFile: (filePath: string, content: string) =>
    invoke<boolean>('fs_write_file', { filePath, content }),

  listDir: (dirPath: string) =>
    invoke<FileEntry[]>('fs_list_dir', { dirPath }),

  createFile: (filePath: string) =>
    invoke<boolean>('fs_create_file', { filePath }),

  createDir: (dirPath: string) =>
    invoke<boolean>('fs_create_dir', { dirPath }),

  delete: (targetPath: string) =>
    invoke<boolean>('fs_delete', { targetPath }),

  rename: (oldPath: string, newPath: string) =>
    invoke<boolean>('fs_rename', { oldPath, newPath }),

  move: (srcPath: string, destPath: string) =>
    invoke<boolean>('fs_move', { srcPath, destPath }),

  exists: (targetPath: string) =>
    invoke<boolean>('fs_exists', { targetPath }),

  watchStart: (dirPath: string) =>
    invoke<boolean>('fs_watch_start', { dirPath }),

  watchStop: (dirPath: string) =>
    invoke<boolean>('fs_watch_stop', { dirPath }),

  onChanged: (callback: (event: FileChangeEvent) => void): UnlistenFn => {
    // Returns unlisten function synchronously, listener is async internally
    let unlisten: UnlistenFn = () => {}
    listen<FileChangeEvent>('fs:changed', (e) => callback(e.payload)).then((fn) => {
      unlisten = fn
    })
    return () => unlisten()
  },

  openDialog: async (options?: {
    directory?: boolean
    title?: string
    multiple?: boolean
    properties?: string[]
    filters?: Array<{ name: string; extensions: string[] }>
  }) => {
    // Support both Electron-style `properties: ['openDirectory']`
    // and Tauri-style `directory: true`
    const isDirectory = options?.directory === true
      || (options?.properties ?? []).includes('openDirectory')

    const result = await invoke<{ canceled: boolean; filePaths: string[] }>(
      'fs_open_dialog',
      { options: { directory: isDirectory, title: options?.title, multiple: options?.multiple } }
    )
    return {
      canceled: result.canceled,
      filePaths: result.filePaths
    }
  },

  saveDialog: async (options?: { title?: string }) => {
    const result = await invoke<{ canceled: boolean; filePath?: string }>(
      'fs_save_dialog',
      { options: options ?? {} }
    )
    return {
      canceled: result.canceled,
      filePath: result.filePath
    }
  },

  getHome: () =>
    invoke<string>('fs_get_home')
}

// ── Python API ───────────────────────────────────────────────
const pythonApi = {
  detect: (projectRoot?: string) =>
    invoke<PythonEnvironment[]>('python_detect', { projectRoot }),

  getEnvs: (projectRoot?: string) =>
    invoke<PythonEnvironment[]>('python_get_envs', { projectRoot }),

  run: (options: PythonRunOptions) =>
    invoke<{ exitCode: number }>('python_run', { options }),

  kill: (runId: string) =>
    invoke<boolean>('python_kill', { runId }),

  onOutput: (callback: (chunk: { runId: string; stream: 'stdout' | 'stderr'; data: string }) => void): UnlistenFn => {
    let unlisten: UnlistenFn = () => {}
    listen<{ runId: string; stream: 'stdout' | 'stderr'; data: string }>('python:runOutput', (e) => {
      callback(e.payload)
    }).then((fn) => { unlisten = fn })
    return () => unlisten()
  }
}

// ── Diagnostics API ──────────────────────────────────────────
const diagnosticsApi = {
  analyze: (filePath: string, code: string) =>
    invoke<DiagnosticsResult>('diag_analyze', { filePath, code })
}

// ── Terminal API ─────────────────────────────────────────────
const terminalApi = {
  listShells: () =>
    invoke<ShellOption[]>('term_list_shells'),

  create: (options: TerminalCreateOptions) =>
    invoke<{ success: boolean; error?: string }>('term_create', { options }),

  write: (id: string, data: string) =>
    invoke<boolean>('term_write', { id, data }),

  resize: (id: string, cols: number, rows: number) =>
    invoke<boolean>('term_resize', { id, cols, rows }),

  kill: (id: string) =>
    invoke<boolean>('term_kill', { id }),

  onData: (callback: (event: { id: string; data: string }) => void): UnlistenFn => {
    let unlisten: UnlistenFn = () => {}
    listen<{ id: string; data: string }>('term:data', (e) => callback(e.payload)).then((fn) => {
      unlisten = fn
    })
    return () => unlisten()
  }
}

// ── Git API ──────────────────────────────────────────────────
const gitApi = {
  status: (repoPath: string) =>
    invoke<GitStatus | null>('git_status', { repoPath }),

  init: (repoPath: string) =>
    invoke<boolean>('git_init', { repoPath }),

  stage: (repoPath: string, files: string[]) =>
    invoke<boolean>('git_stage', { repoPath, files }),

  unstage: (repoPath: string, files: string[]) =>
    invoke<boolean>('git_unstage', { repoPath, files }),

  commit: (repoPath: string, message: string) =>
    invoke<boolean>('git_commit', { repoPath, message }),

  push: (repoPath: string) =>
    invoke<boolean>('git_push', { repoPath }),

  pull: (repoPath: string) =>
    invoke<boolean>('git_pull', { repoPath }),

  fetch: (repoPath: string) =>
    invoke<boolean>('git_fetch', { repoPath }),

  branches: (repoPath: string) =>
    invoke<GitBranch[]>('git_branches', { repoPath }),

  checkout: (repoPath: string, branch: string) =>
    invoke<boolean>('git_checkout', { repoPath, branch }),

  diff: (repoPath: string, filePath?: string) =>
    invoke<GitDiff[]>('git_diff', { repoPath, filePath }),

  log: (repoPath: string, limit?: number) =>
    invoke<GitCommit[]>('git_log', { repoPath, limit }),

  clone: (url: string, destPath: string) =>
    invoke<boolean>('git_clone', { url, destPath })
}

// ── Kernel API ───────────────────────────────────────────────
const kernelApi = {
  start: (pythonPath: string, cwd: string) =>
    invoke<KernelInfo | { error: string }>('kernel_start', { pythonPath, cwd }),

  stop: (kernelId: string) =>
    invoke<boolean>('kernel_stop', { kernelId }),

  execute: (executionId: string, kernelId: string, code: string, pythonPath: string, cwd: string) =>
    invoke<{ executionCount: number }>('kernel_execute', { executionId, kernelId, code, pythonPath, cwd }),

  interrupt: (kernelId: string) =>
    invoke<boolean>('kernel_interrupt', { kernelId }),

  restart: (kernelId: string, pythonPath: string, cwd: string) =>
    invoke<{ success?: boolean; error?: string }>('kernel_restart', { kernelId, pythonPath, cwd }),

  list: () =>
    invoke<KernelInfo[]>('kernel_list'),

  onOutput: (callback: (output: KernelOutput) => void): UnlistenFn => {
    let unlisten: UnlistenFn = () => {}
    listen<KernelOutput>('kernel:output', (e) => callback(e.payload)).then((fn) => {
      unlisten = fn
    })
    return () => unlisten()
  },

  onStatus: (callback: (status: { id: string; state: string; message?: string }) => void): UnlistenFn => {
    let unlisten: UnlistenFn = () => {}
    listen<{ id: string; state: string; message?: string }>('kernel:status', (e) => callback(e.payload)).then((fn) => {
      unlisten = fn
    })
    return () => unlisten()
  }
}

// ── Debug API ────────────────────────────────────────────────
const debugApi = {
  start: (filePath: string, pythonPath: string, breakpoints: Breakpoint[]) =>
    invoke<{ success: boolean; sessionId: string; port: number }>('debug_start', { filePath, pythonPath, breakpoints }),

  stop: () =>
    invoke<boolean>('debug_stop'),

  continue: () =>
    invoke<boolean>('debug_continue'),

  pause: () =>
    invoke<boolean>('debug_pause'),

  stepOver: () =>
    invoke<boolean>('debug_step_over'),

  stepIn: () =>
    invoke<boolean>('debug_step_in'),

  stepOut: () =>
    invoke<boolean>('debug_step_out'),

  setBreakpoints: (breakpoints: Breakpoint[]) =>
    invoke<boolean>('debug_set_breakpoints', { breakpoints }),

  onEvent: (callback: (event: DebugEvent) => void): UnlistenFn => {
    let unlisten: UnlistenFn = () => {}
    listen<DebugEvent>('debug:event', (e) => callback(e.payload)).then((fn) => {
      unlisten = fn
    })
    return () => unlisten()
  }
}

// ── Settings API ─────────────────────────────────────────────
const settingsApi = {
  get: (key?: keyof ZeusSettings) =>
    invoke<ZeusSettings | ZeusSettings[keyof ZeusSettings]>('settings_get', { key }),

  set: (key: string, value: unknown) =>
    invoke<boolean>('settings_set', { key, value }),

  reset: (key?: keyof ZeusSettings) =>
    invoke<boolean>('settings_reset', { key })
}

// ── App API ──────────────────────────────────────────────────
// Window controls (minimize/maximize/quit) are handled via
// @tauri-apps/api/window directly, without going through Rust commands.
const win = getCurrentWindow()

const appApi = {
  getVersion: () =>
    invoke<string>('app_get_version'),

  quit: () => win.close(),

  minimize: () => win.minimize(),

  maximize: async () => {
    if (await win.isMaximized()) {
      await win.unmaximize()
    } else {
      await win.maximize()
    }
  },

  openExternal: (url: string) =>
    invoke<boolean>('app_open_external', { url }),

  openPath: (filePath: string) =>
    invoke<boolean>('app_open_path', { filePath })
}

// ── Install on window.zeus ───────────────────────────────────
// Exactly the same shape as the Electron preload's contextBridge
export const zeusAPI = {
  fs: fsApi,
  python: pythonApi,
  diagnostics: diagnosticsApi,
  terminal: terminalApi,
  git: gitApi,
  kernel: kernelApi,
  debug: debugApi,
  settings: settingsApi,
  app: appApi
}

export type ZeusAPI = typeof zeusAPI

declare global {
  interface Window {
    zeus: ZeusAPI
  }
}

// Install on window so all existing stores/components work unchanged
export function installZeusAPI(): void {
  window.zeus = zeusAPI
}
