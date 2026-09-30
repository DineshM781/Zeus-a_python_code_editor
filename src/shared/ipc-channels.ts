// ============================================================
// ZEUS — Shared IPC Channel Definitions
// ============================================================
// These string constants are the ONLY thing shared between
// main process and renderer. Keep them in sync.
// ============================================================

export const IPC = {
  // File System
  FS_READ_FILE: 'fs:readFile',
  FS_WRITE_FILE: 'fs:writeFile',
  FS_LIST_DIR: 'fs:listDir',
  FS_CREATE_FILE: 'fs:createFile',
  FS_CREATE_DIR: 'fs:createDir',
  FS_DELETE: 'fs:delete',
  FS_RENAME: 'fs:rename',
  FS_MOVE: 'fs:move',
  FS_EXISTS: 'fs:exists',
  FS_WATCH_START: 'fs:watchStart',
  FS_WATCH_STOP: 'fs:watchStop',
  FS_CHANGED: 'fs:changed',
  FS_OPEN_DIALOG: 'fs:openDialog',
  FS_SAVE_DIALOG: 'fs:saveDialog',
  FS_GET_HOME: 'fs:getHome',

  // Python
  PYTHON_DETECT: 'python:detect',
  PYTHON_RUN: 'python:run',
  PYTHON_RUN_OUTPUT: 'python:runOutput',
  PYTHON_KILL: 'python:kill',
  PYTHON_GET_ENVS: 'python:getEnvs',

  // Diagnostics
  DIAG_ANALYZE: 'diag:analyze',
  DIAG_RESULT: 'diag:result',

  // Terminal
  TERM_CREATE: 'term:create',
  TERM_WRITE: 'term:write',
  TERM_DATA: 'term:data',
  TERM_RESIZE: 'term:resize',
  TERM_KILL: 'term:kill',
  TERM_LIST_SHELLS: 'term:listShells',

  // Git
  GIT_STATUS: 'git:status',
  GIT_INIT: 'git:init',
  GIT_STAGE: 'git:stage',
  GIT_UNSTAGE: 'git:unstage',
  GIT_COMMIT: 'git:commit',
  GIT_PUSH: 'git:push',
  GIT_PULL: 'git:pull',
  GIT_FETCH: 'git:fetch',
  GIT_BRANCHES: 'git:branches',
  GIT_CHECKOUT: 'git:checkout',
  GIT_DIFF: 'git:diff',
  GIT_LOG: 'git:log',
  GIT_CLONE: 'git:clone',

  // Kernel (Jupyter)
  KERNEL_START: 'kernel:start',
  KERNEL_STOP: 'kernel:stop',
  KERNEL_EXECUTE: 'kernel:execute',
  KERNEL_OUTPUT: 'kernel:output',
  KERNEL_STATUS: 'kernel:status',
  KERNEL_INTERRUPT: 'kernel:interrupt',
  KERNEL_RESTART: 'kernel:restart',
  KERNEL_LIST: 'kernel:list',

  // Debug
  DEBUG_START: 'debug:start',
  DEBUG_STOP: 'debug:stop',
  DEBUG_CONTINUE: 'debug:continue',
  DEBUG_PAUSE: 'debug:pause',
  DEBUG_STEP_OVER: 'debug:stepOver',
  DEBUG_STEP_IN: 'debug:stepIn',
  DEBUG_STEP_OUT: 'debug:stepOut',
  DEBUG_SET_BREAKPOINTS: 'debug:setBreakpoints',
  DEBUG_EVENT: 'debug:event',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_RESET: 'settings:reset',

  // App
  APP_GET_VERSION: 'app:getVersion',
  APP_QUIT: 'app:quit',
  APP_MINIMIZE: 'app:minimize',
  APP_MAXIMIZE: 'app:maximize',
  APP_OPEN_EXTERNAL: 'app:openExternal',

  // Shell
  SHELL_OPEN_PATH: 'shell:openPath'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
