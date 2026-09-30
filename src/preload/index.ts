// ============================================================
// ZEUS — Preload Script (contextBridge)
// ============================================================
// All communication between renderer and main goes through here.
// nodeIntegration is OFF. This is the ONLY bridge.
// ============================================================

import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type {
  FileEntry, FileChangeEvent, PythonEnvironment, PythonRunOptions,
  TerminalCreateOptions, ShellOption, GitStatus, GitBranch, GitDiff,
  GitCommit, KernelInfo, KernelOutput, Breakpoint, DebugEvent,
  ZeusSettings, Diagnostic, DiagnosticsResult
} from '../shared/types'

// ── File System API ──────────────────────────────────────────
const fsApi = {
  readFile: (filePath: string) =>
    ipcRenderer.invoke(IPC.FS_READ_FILE, filePath) as Promise<string>,

  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke(IPC.FS_WRITE_FILE, filePath, content) as Promise<boolean>,

  listDir: (dirPath: string) =>
    ipcRenderer.invoke(IPC.FS_LIST_DIR, dirPath) as Promise<FileEntry[]>,

  createFile: (filePath: string) =>
    ipcRenderer.invoke(IPC.FS_CREATE_FILE, filePath) as Promise<boolean>,

  createDir: (dirPath: string) =>
    ipcRenderer.invoke(IPC.FS_CREATE_DIR, dirPath) as Promise<boolean>,

  delete: (targetPath: string) =>
    ipcRenderer.invoke(IPC.FS_DELETE, targetPath) as Promise<boolean>,

  rename: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke(IPC.FS_RENAME, oldPath, newPath) as Promise<boolean>,

  move: (srcPath: string, destPath: string) =>
    ipcRenderer.invoke(IPC.FS_MOVE, srcPath, destPath) as Promise<boolean>,

  exists: (targetPath: string) =>
    ipcRenderer.invoke(IPC.FS_EXISTS, targetPath) as Promise<boolean>,

  watchStart: (dirPath: string) =>
    ipcRenderer.invoke(IPC.FS_WATCH_START, dirPath) as Promise<boolean>,

  watchStop: (dirPath: string) =>
    ipcRenderer.invoke(IPC.FS_WATCH_STOP, dirPath) as Promise<boolean>,

  onChanged: (callback: (event: FileChangeEvent) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, event: FileChangeEvent) => callback(event)
    ipcRenderer.on(IPC.FS_CHANGED, handler)
    return () => { ipcRenderer.removeListener(IPC.FS_CHANGED, handler) }
  },

  openDialog: (options?: Electron.OpenDialogOptions) =>
    ipcRenderer.invoke(IPC.FS_OPEN_DIALOG, options) as Promise<Electron.OpenDialogReturnValue>,

  saveDialog: (options?: Electron.SaveDialogOptions) =>
    ipcRenderer.invoke(IPC.FS_SAVE_DIALOG, options) as Promise<Electron.SaveDialogReturnValue>,

  getHome: () =>
    ipcRenderer.invoke(IPC.FS_GET_HOME) as Promise<string>
}

// ── Python API ───────────────────────────────────────────────
const pythonApi = {
  detect: (projectRoot?: string) =>
    ipcRenderer.invoke(IPC.PYTHON_DETECT, projectRoot) as Promise<PythonEnvironment[]>,

  getEnvs: (projectRoot?: string) =>
    ipcRenderer.invoke(IPC.PYTHON_GET_ENVS, projectRoot) as Promise<PythonEnvironment[]>,

  run: (options: PythonRunOptions) =>
    ipcRenderer.invoke(IPC.PYTHON_RUN, options) as Promise<{ exitCode: number }>,

  kill: (runId: string) =>
    ipcRenderer.invoke(IPC.PYTHON_KILL, runId) as Promise<boolean>,

  onOutput: (callback: (chunk: { runId: string; stream: 'stdout' | 'stderr'; data: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, chunk: typeof callback extends (c: infer C) => void ? C : never) => callback(chunk)
    ipcRenderer.on(IPC.PYTHON_RUN_OUTPUT, handler)
    return () => { ipcRenderer.removeListener(IPC.PYTHON_RUN_OUTPUT, handler) }
  }
}

// ── Diagnostics API ──────────────────────────────────────────
const diagnosticsApi = {
  analyze: (filePath: string, code: string) =>
    ipcRenderer.invoke(IPC.DIAG_ANALYZE, filePath, code) as Promise<DiagnosticsResult>
}

// ── Terminal API ─────────────────────────────────────────────
const terminalApi = {
  listShells: () =>
    ipcRenderer.invoke(IPC.TERM_LIST_SHELLS) as Promise<ShellOption[]>,

  create: (options: TerminalCreateOptions) =>
    ipcRenderer.invoke(IPC.TERM_CREATE, options) as Promise<{ success: boolean; error?: string }>,

  write: (id: string, data: string) =>
    ipcRenderer.invoke(IPC.TERM_WRITE, id, data) as Promise<boolean>,

  resize: (id: string, cols: number, rows: number) =>
    ipcRenderer.invoke(IPC.TERM_RESIZE, id, cols, rows) as Promise<boolean>,

  kill: (id: string) =>
    ipcRenderer.invoke(IPC.TERM_KILL, id) as Promise<boolean>,

  onData: (callback: (event: { id: string; data: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, event: { id: string; data: string }) => callback(event)
    ipcRenderer.on(IPC.TERM_DATA, handler)
    return () => { ipcRenderer.removeListener(IPC.TERM_DATA, handler) }
  }
}

// ── Git API ──────────────────────────────────────────────────
const gitApi = {
  status: (repoPath: string) =>
    ipcRenderer.invoke(IPC.GIT_STATUS, repoPath) as Promise<GitStatus | null>,

  init: (repoPath: string) =>
    ipcRenderer.invoke(IPC.GIT_INIT, repoPath) as Promise<boolean>,

  stage: (repoPath: string, files: string[]) =>
    ipcRenderer.invoke(IPC.GIT_STAGE, repoPath, files) as Promise<boolean>,

  unstage: (repoPath: string, files: string[]) =>
    ipcRenderer.invoke(IPC.GIT_UNSTAGE, repoPath, files) as Promise<boolean>,

  commit: (repoPath: string, message: string) =>
    ipcRenderer.invoke(IPC.GIT_COMMIT, repoPath, message) as Promise<boolean>,

  push: (repoPath: string) =>
    ipcRenderer.invoke(IPC.GIT_PUSH, repoPath) as Promise<boolean>,

  pull: (repoPath: string) =>
    ipcRenderer.invoke(IPC.GIT_PULL, repoPath) as Promise<boolean>,

  fetch: (repoPath: string) =>
    ipcRenderer.invoke(IPC.GIT_FETCH, repoPath) as Promise<boolean>,

  branches: (repoPath: string) =>
    ipcRenderer.invoke(IPC.GIT_BRANCHES, repoPath) as Promise<GitBranch[]>,

  checkout: (repoPath: string, branch: string) =>
    ipcRenderer.invoke(IPC.GIT_CHECKOUT, repoPath, branch) as Promise<boolean>,

  diff: (repoPath: string, filePath?: string) =>
    ipcRenderer.invoke(IPC.GIT_DIFF, repoPath, filePath) as Promise<GitDiff[]>,

  log: (repoPath: string, limit?: number) =>
    ipcRenderer.invoke(IPC.GIT_LOG, repoPath, limit) as Promise<GitCommit[]>,

  clone: (url: string, destPath: string) =>
    ipcRenderer.invoke(IPC.GIT_CLONE, url, destPath) as Promise<boolean>
}

// ── Kernel API ───────────────────────────────────────────────
const kernelApi = {
  start: (pythonPath: string, cwd: string) =>
    ipcRenderer.invoke(IPC.KERNEL_START, pythonPath, cwd) as Promise<KernelInfo | { error: string }>,

  stop: (kernelId: string) =>
    ipcRenderer.invoke(IPC.KERNEL_STOP, kernelId) as Promise<boolean>,

  execute: (executionId: string, kernelId: string, code: string, pythonPath: string, cwd: string) =>
    ipcRenderer.invoke(IPC.KERNEL_EXECUTE, executionId, kernelId, code, pythonPath, cwd) as Promise<{ executionCount: number }>,

  interrupt: (kernelId: string) =>
    ipcRenderer.invoke(IPC.KERNEL_INTERRUPT, kernelId) as Promise<boolean>,

  restart: (kernelId: string, pythonPath: string, cwd: string) =>
    ipcRenderer.invoke(IPC.KERNEL_RESTART, kernelId, pythonPath, cwd) as Promise<{ success?: boolean; error?: string }>,

  list: () =>
    ipcRenderer.invoke(IPC.KERNEL_LIST) as Promise<KernelInfo[]>,

  onOutput: (callback: (output: KernelOutput) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, output: KernelOutput) => callback(output)
    ipcRenderer.on(IPC.KERNEL_OUTPUT, handler)
    return () => { ipcRenderer.removeListener(IPC.KERNEL_OUTPUT, handler) }
  },

  onStatus: (callback: (status: { id: string; state: string; message?: string }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, s: { id: string; state: string; message?: string }) => callback(s)
    ipcRenderer.on(IPC.KERNEL_STATUS, handler)
    return () => { ipcRenderer.removeListener(IPC.KERNEL_STATUS, handler) }
  }
}

// ── Debug API ────────────────────────────────────────────────
const debugApi = {
  start: (filePath: string, pythonPath: string, breakpoints: Breakpoint[]) =>
    ipcRenderer.invoke(IPC.DEBUG_START, filePath, pythonPath, breakpoints) as Promise<{ success: boolean; sessionId: string; port: number }>,

  stop: () =>
    ipcRenderer.invoke(IPC.DEBUG_STOP) as Promise<boolean>,

  continue: () =>
    ipcRenderer.invoke(IPC.DEBUG_CONTINUE) as Promise<boolean>,

  pause: () =>
    ipcRenderer.invoke(IPC.DEBUG_PAUSE) as Promise<boolean>,

  stepOver: () =>
    ipcRenderer.invoke(IPC.DEBUG_STEP_OVER) as Promise<boolean>,

  stepIn: () =>
    ipcRenderer.invoke(IPC.DEBUG_STEP_IN) as Promise<boolean>,

  stepOut: () =>
    ipcRenderer.invoke(IPC.DEBUG_STEP_OUT) as Promise<boolean>,

  setBreakpoints: (breakpoints: Breakpoint[]) =>
    ipcRenderer.invoke(IPC.DEBUG_SET_BREAKPOINTS, breakpoints) as Promise<boolean>,

  onEvent: (callback: (event: DebugEvent) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, event: DebugEvent) => callback(event)
    ipcRenderer.on(IPC.DEBUG_EVENT, handler)
    return () => { ipcRenderer.removeListener(IPC.DEBUG_EVENT, handler) }
  }
}

// ── Settings API ─────────────────────────────────────────────
const settingsApi = {
  get: (key?: keyof ZeusSettings) =>
    ipcRenderer.invoke(IPC.SETTINGS_GET, key) as Promise<ZeusSettings | ZeusSettings[keyof ZeusSettings]>,

  set: (key: string, value: unknown) =>
    ipcRenderer.invoke(IPC.SETTINGS_SET, key, value) as Promise<boolean>,

  reset: (key?: keyof ZeusSettings) =>
    ipcRenderer.invoke(IPC.SETTINGS_RESET, key) as Promise<boolean>
}

// ── App API ──────────────────────────────────────────────────
const appApi = {
  getVersion: () =>
    ipcRenderer.invoke(IPC.APP_GET_VERSION) as Promise<string>,

  quit: () =>
    ipcRenderer.invoke(IPC.APP_QUIT),

  minimize: () =>
    ipcRenderer.invoke(IPC.APP_MINIMIZE),

  maximize: () =>
    ipcRenderer.invoke(IPC.APP_MAXIMIZE),

  openExternal: (url: string) =>
    ipcRenderer.invoke(IPC.APP_OPEN_EXTERNAL, url) as Promise<boolean>,

  openPath: (filePath: string) =>
    ipcRenderer.invoke(IPC.SHELL_OPEN_PATH, filePath) as Promise<boolean>
}

// ── Expose to Renderer ───────────────────────────────────────
contextBridge.exposeInMainWorld('zeus', {
  fs: fsApi,
  python: pythonApi,
  diagnostics: diagnosticsApi,
  terminal: terminalApi,
  git: gitApi,
  kernel: kernelApi,
  debug: debugApi,
  settings: settingsApi,
  app: appApi
})

// ── TypeScript Window Augmentation ───────────────────────────
export type ZeusAPI = {
  fs: typeof fsApi
  python: typeof pythonApi
  diagnostics: typeof diagnosticsApi
  terminal: typeof terminalApi
  git: typeof gitApi
  kernel: typeof kernelApi
  debug: typeof debugApi
  settings: typeof settingsApi
  app: typeof appApi
}

declare global {
  interface Window {
    zeus: ZeusAPI
  }
}
