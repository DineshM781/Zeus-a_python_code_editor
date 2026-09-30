// ============================================================
// ZEUS — File System IPC Handler
// ============================================================

import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'
import * as os from 'os'
import chokidar, { FSWatcher } from 'chokidar'
import { IPC } from '../../../shared/ipc-channels'
import type { FileEntry, FileChangeEvent } from '../../../shared/types'

const watchers = new Map<string, FSWatcher>()

function buildFileEntry(entryPath: string, stat: fsSync.Stats): FileEntry {
  return {
    name: path.basename(entryPath),
    path: entryPath,
    isDirectory: stat.isDirectory(),
    size: stat.isFile() ? stat.size : undefined,
    extension: stat.isFile() ? path.extname(entryPath).toLowerCase() : undefined
  }
}

async function listDirRecursive(
  dirPath: string,
  depth: number = 0,
  maxDepth: number = 3
): Promise<FileEntry[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const result: FileEntry[] = []

  // Sort: directories first, then files alphabetically
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1
    if (!a.isDirectory() && b.isDirectory()) return 1
    return a.name.localeCompare(b.name)
  })

  for (const entry of sorted) {
    // Skip hidden system folders
    if (entry.name.startsWith('.') && !entry.name.startsWith('.env')) continue
    if (['__pycache__', 'node_modules', '.git'].includes(entry.name)) continue

    const fullPath = path.join(dirPath, entry.name)
    const stat = await fs.stat(fullPath).catch(() => null)
    if (!stat) continue

    const fileEntry = buildFileEntry(fullPath, stat)

    if (entry.isDirectory() && depth < maxDepth) {
      fileEntry.children = await listDirRecursive(fullPath, depth + 1, maxDepth)
    }

    result.push(fileEntry)
  }

  return result
}

export function registerFsHandlers(win: BrowserWindow): void {
  ipcMain.handle(IPC.FS_READ_FILE, async (_e, filePath: string) => {
    return fs.readFile(filePath, 'utf-8')
  })

  ipcMain.handle(IPC.FS_WRITE_FILE, async (_e, filePath: string, content: string) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, content, 'utf-8')
    return true
  })

  ipcMain.handle(IPC.FS_LIST_DIR, async (_e, dirPath: string) => {
    return listDirRecursive(dirPath)
  })

  ipcMain.handle(IPC.FS_CREATE_FILE, async (_e, filePath: string) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, '', 'utf-8')
    return true
  })

  ipcMain.handle(IPC.FS_CREATE_DIR, async (_e, dirPath: string) => {
    await fs.mkdir(dirPath, { recursive: true })
    return true
  })

  ipcMain.handle(IPC.FS_DELETE, async (_e, targetPath: string) => {
    await fs.rm(targetPath, { recursive: true, force: true })
    return true
  })

  ipcMain.handle(IPC.FS_RENAME, async (_e, oldPath: string, newPath: string) => {
    await fs.rename(oldPath, newPath)
    return true
  })

  ipcMain.handle(IPC.FS_MOVE, async (_e, srcPath: string, destPath: string) => {
    await fs.rename(srcPath, destPath)
    return true
  })

  ipcMain.handle(IPC.FS_EXISTS, async (_e, targetPath: string) => {
    return fsSync.existsSync(targetPath)
  })

  ipcMain.handle(IPC.FS_WATCH_START, (_e, dirPath: string) => {
    if (watchers.has(dirPath)) return

    const watcher = chokidar.watch(dirPath, {
      ignored: /(^|[/\\])\..|(node_modules|__pycache__|\.git)/,
      persistent: true,
      ignoreInitial: true,
      depth: 5
    })

    const emit = (type: FileChangeEvent['type'], p: string) => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.FS_CHANGED, { type, path: p } satisfies FileChangeEvent)
      }
    }

    watcher.on('add', (p) => emit('add', p))
    watcher.on('change', (p) => emit('change', p))
    watcher.on('unlink', (p) => emit('unlink', p))
    watcher.on('addDir', (p) => emit('addDir', p))
    watcher.on('unlinkDir', (p) => emit('unlinkDir', p))

    watchers.set(dirPath, watcher)
    return true
  })

  ipcMain.handle(IPC.FS_WATCH_STOP, async (_e, dirPath: string) => {
    const watcher = watchers.get(dirPath)
    if (watcher) {
      await watcher.close()
      watchers.delete(dirPath)
    }
    return true
  })

  ipcMain.handle(IPC.FS_OPEN_DIALOG, async (_e, options?: Electron.OpenDialogOptions) => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      ...options
    })
    return result
  })

  ipcMain.handle(IPC.FS_SAVE_DIALOG, async (_e, options?: Electron.SaveDialogOptions) => {
    const result = await dialog.showSaveDialog(win, options ?? {})
    return result
  })

  ipcMain.handle(IPC.FS_GET_HOME, () => os.homedir())
}
