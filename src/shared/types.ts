// ============================================================
// ZEUS — Shared Types
// ============================================================
// Types used across both main and renderer processes.
// Do NOT import renderer-only or main-only modules here.
// ============================================================

// ── File System ─────────────────────────────────────────────

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size?: number
  children?: FileEntry[]
  extension?: string
}

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
  path: string
}

// ── Diagnostics ─────────────────────────────────────────────

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint'

export interface Diagnostic {
  id: string
  filePath: string
  line: number       // 1-based
  column: number     // 1-based
  endLine?: number
  endColumn?: number
  severity: DiagnosticSeverity
  code: string
  message: string
  source: string     // e.g. 'ruff', 'pyflakes'
}

export interface DiagnosticsResult {
  filePath: string
  diagnostics: Diagnostic[]
  error?: string
}

// ── Python ───────────────────────────────────────────────────

export interface PythonEnvironment {
  path: string
  version: string
  name: string       // e.g. '.venv', 'system', 'conda-env'
  isVenv: boolean
}

export interface PythonRunOptions {
  filePath?: string
  code?: string
  pythonPath: string
  cwd?: string
  env?: Record<string, string>
  runId: string
}

export interface PythonRunChunk {
  runId: string
  stream: 'stdout' | 'stderr'
  data: string
}

export interface PythonRunComplete {
  runId: string
  exitCode: number
}

// ── Terminal ─────────────────────────────────────────────────

export interface TerminalCreateOptions {
  id: string
  shell?: string
  cwd?: string
  env?: Record<string, string>
  cols?: number
  rows?: number
}

export interface TerminalDataEvent {
  id: string
  data: string
}

export interface ShellOption {
  name: string
  path: string
  args?: string[]
}

// ── Git ──────────────────────────────────────────────────────

export interface GitFileStatus {
  path: string
  staged: boolean
  working: string   // M, A, D, ??, etc.
  index: string
}

export interface GitStatus {
  branch: string
  ahead: number
  behind: number
  staged: GitFileStatus[]
  unstaged: GitFileStatus[]
  untracked: GitFileStatus[]
  isClean: boolean
}

export interface GitBranch {
  name: string
  current: boolean
  remote?: string
}

export interface GitCommit {
  hash: string
  message: string
  author: string
  date: string
}

export interface GitDiff {
  filePath: string
  diff: string
  additions: number
  deletions: number
}

// ── Kernel (Jupyter) ─────────────────────────────────────────

export type KernelState = 'idle' | 'busy' | 'dead' | 'starting' | 'restarting'

export interface KernelInfo {
  id: string
  name: string
  language: string
  state: KernelState
}

export interface KernelExecuteOptions {
  kernelId: string
  code: string
  executionId: string
}

export type OutputType = 'stream' | 'display_data' | 'execute_result' | 'error'

export interface KernelOutput {
  executionId: string
  type: OutputType
  data: Record<string, unknown>
  metadata?: Record<string, unknown>
  executionCount?: number
  text?: string
  ename?: string
  evalue?: string
  traceback?: string[]
}

// ── Debug ────────────────────────────────────────────────────

export interface Breakpoint {
  id: string
  filePath: string
  line: number
  enabled: boolean
  condition?: string
}

export type DebugEvent =
  | { type: 'stopped'; reason: string; filePath: string; line: number }
  | { type: 'continued' }
  | { type: 'exited'; exitCode: number }
  | { type: 'output'; category: string; output: string }

export interface StackFrame {
  id: number
  name: string
  source: string
  line: number
  column: number
}

export interface Variable {
  name: string
  value: string
  type: string
  variablesReference: number
}

// ── Settings ─────────────────────────────────────────────────

export interface ZeusSettings {
  editor: {
    fontSize: number
    fontFamily: string
    tabSize: number
    insertSpaces: boolean
    wordWrap: 'off' | 'on' | 'wordWrapColumn' | 'bounded'
    minimap: boolean
    autoSave: 'off' | 'afterDelay' | 'onFocusChange' | 'onWindowChange'
    autoSaveDelay: number
    theme: 'zeus-dark' | 'zeus-light'
    formatOnSave: boolean
    lineNumbers: 'on' | 'off' | 'relative'
    renderWhitespace: 'none' | 'boundary' | 'selection' | 'all'
  }
  python: {
    interpreterPath: string
    defaultVenvName: string
    linter: 'ruff' | 'pyflakes' | 'none'
    formatter: 'black' | 'ruff' | 'autopep8' | 'none'
    typeChecker: 'pyright' | 'mypy' | 'none'
    formatOnSave: boolean
    analysisDelay: number
  }
  terminal: {
    shell: string
    fontSize: number
    fontFamily: string
    scrollback: number
  }
  notebook: {
    defaultKernel: string
    autoSave: boolean
  }
  diagnostics: {
    enabled: boolean
    showWarnings: boolean
    showInfo: boolean
    showHints: boolean
    analysisDelay: number
  }
  ai: {
    enabled: boolean
    completionEnabled: boolean
    completionDelay: number
    contextLevel: 'selection' | 'function' | 'file' | 'openFiles'
  }
  git: {
    enabled: boolean
    autofetch: boolean
  }
}

export const DEFAULT_SETTINGS: ZeusSettings = {
  editor: {
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    tabSize: 4,
    insertSpaces: true,
    wordWrap: 'off',
    minimap: false,
    autoSave: 'afterDelay',
    autoSaveDelay: 1000,
    theme: 'zeus-dark',
    formatOnSave: false,
    lineNumbers: 'on',
    renderWhitespace: 'selection'
  },
  python: {
    interpreterPath: 'python',
    defaultVenvName: '.venv',
    linter: 'ruff',
    formatter: 'ruff',
    typeChecker: 'none',
    formatOnSave: false,
    analysisDelay: 500
  },
  terminal: {
    shell: '',
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
    scrollback: 10000
  },
  notebook: {
    defaultKernel: 'python3',
    autoSave: true
  },
  diagnostics: {
    enabled: true,
    showWarnings: true,
    showInfo: true,
    showHints: true,
    analysisDelay: 500
  },
  ai: {
    enabled: true,
    completionEnabled: true,
    completionDelay: 800,
    contextLevel: 'function'
  },
  git: {
    enabled: true,
    autofetch: false
  }
}
