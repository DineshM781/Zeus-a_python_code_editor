// ============================================================
// ZEUS — Git IPC Handler
// ============================================================

import { ipcMain, BrowserWindow } from 'electron'
import simpleGit, { SimpleGit } from 'simple-git'
import * as path from 'path'
import { IPC } from '../../../shared/ipc-channels'
import type { GitStatus, GitBranch, GitDiff, GitCommit, GitFileStatus } from '../../../shared/types'

function getGit(repoPath: string): SimpleGit {
  return simpleGit(repoPath)
}

export function registerGitHandlers(_win: BrowserWindow): void {
  ipcMain.handle(IPC.GIT_STATUS, async (_e, repoPath: string): Promise<GitStatus | null> => {
    try {
      const git = getGit(repoPath)
      const status = await git.status()
      const branch = await git.branch()

      let ahead = 0, behind = 0
      try {
        const tracking = await git.raw(['rev-list', '--left-right', '--count', '@{u}...HEAD'])
        const parts = tracking.trim().split(/\s+/)
        behind = parseInt(parts[0] || '0')
        ahead = parseInt(parts[1] || '0')
      } catch { /* no tracking branch */ }

      const mapFile = (f: string, staged: boolean, working: string, index: string): GitFileStatus => ({
        path: f,
        staged,
        working,
        index
      })

      const staged: GitFileStatus[] = [
        ...status.created.map(f => mapFile(f, true, ' ', 'A')),
        ...status.deleted.filter(f => !status.not_added.includes(f)).map(f => mapFile(f, true, ' ', 'D')),
        ...status.renamed.map(f => mapFile(typeof f === 'string' ? f : f.to, true, ' ', 'R'))
      ]

      const unstaged: GitFileStatus[] = [
        ...status.modified.map(f => mapFile(f, false, 'M', ' ')),
        ...status.deleted.filter(f => status.not_added.includes(f)).map(f => mapFile(f, false, 'D', ' '))
      ]

      const untracked: GitFileStatus[] = status.not_added.map(f => mapFile(f, false, '??', '??'))

      return {
        branch: branch.current || status.current || 'HEAD',
        ahead,
        behind,
        staged,
        unstaged,
        untracked,
        isClean: status.isClean()
      }
    } catch {
      return null
    }
  })

  ipcMain.handle(IPC.GIT_INIT, async (_e, repoPath: string) => {
    const git = getGit(repoPath)
    await git.init()
    return true
  })

  ipcMain.handle(IPC.GIT_STAGE, async (_e, repoPath: string, files: string[]) => {
    const git = getGit(repoPath)
    await git.add(files)
    return true
  })

  ipcMain.handle(IPC.GIT_UNSTAGE, async (_e, repoPath: string, files: string[]) => {
    const git = getGit(repoPath)
    for (const f of files) {
      await git.reset(['HEAD', '--', f]).catch(() => {})
    }
    return true
  })

  ipcMain.handle(IPC.GIT_COMMIT, async (_e, repoPath: string, message: string) => {
    const git = getGit(repoPath)
    await git.commit(message)
    return true
  })

  ipcMain.handle(IPC.GIT_PUSH, async (_e, repoPath: string) => {
    const git = getGit(repoPath)
    await git.push()
    return true
  })

  ipcMain.handle(IPC.GIT_PULL, async (_e, repoPath: string) => {
    const git = getGit(repoPath)
    await git.pull()
    return true
  })

  ipcMain.handle(IPC.GIT_FETCH, async (_e, repoPath: string) => {
    const git = getGit(repoPath)
    await git.fetch()
    return true
  })

  ipcMain.handle(IPC.GIT_BRANCHES, async (_e, repoPath: string): Promise<GitBranch[]> => {
    const git = getGit(repoPath)
    const result = await git.branch(['-a'])
    return result.all.map((name) => ({
      name: name.replace(/^remotes\//, ''),
      current: name === result.current,
      remote: name.startsWith('remotes/') ? name : undefined
    }))
  })

  ipcMain.handle(IPC.GIT_CHECKOUT, async (_e, repoPath: string, branch: string) => {
    const git = getGit(repoPath)
    await git.checkout(branch)
    return true
  })

  ipcMain.handle(IPC.GIT_DIFF, async (_e, repoPath: string, filePath?: string): Promise<GitDiff[]> => {
    const git = getGit(repoPath)
    const args = ['--stat']
    if (filePath) args.push('--', path.relative(repoPath, filePath))

    try {
      const raw = filePath
        ? await git.diff(['HEAD', '--', path.relative(repoPath, filePath)])
        : await git.diff(['HEAD'])

      const additions = (raw.match(/^\+/gm) || []).length
      const deletions = (raw.match(/^-/gm) || []).length

      return [{
        filePath: filePath || repoPath,
        diff: raw,
        additions,
        deletions
      }]
    } catch {
      return []
    }
  })

  ipcMain.handle(IPC.GIT_LOG, async (_e, repoPath: string, limit = 50): Promise<GitCommit[]> => {
    const git = getGit(repoPath)
    const log = await git.log({ maxCount: limit })
    return log.all.map((entry) => ({
      hash: entry.hash,
      message: entry.message,
      author: entry.author_name,
      date: entry.date
    }))
  })

  ipcMain.handle(IPC.GIT_CLONE, async (_e, url: string, destPath: string) => {
    const git = getGit(require('path').dirname(destPath))
    await git.clone(url, destPath)
    return true
  })
}
