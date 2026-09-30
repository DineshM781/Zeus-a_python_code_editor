// ============================================================
// ZEUS — Git Panel
// ============================================================

import React, { useEffect } from 'react'
import { useGitStore } from '../../stores/gitStore'
import { useExplorerStore } from '../../stores/explorerStore'
import styles from './GitPanel.module.css'

const GitPanel: React.FC = () => {
  const { status, commitMessage, isLoading, error, refresh, stage, unstage, commit, push, pull, setCommitMessage, branches, checkout } = useGitStore()
  const { projectRoot } = useExplorerStore()

  useEffect(() => {
    if (projectRoot) refresh(projectRoot)
  }, [projectRoot])

  if (!projectRoot) return <div className={styles.empty}>No project open</div>
  if (isLoading && !status) return (
    <div className={styles.loading}>
      <div className="spinner" />
      <span>Loading git status...</span>
    </div>
  )
  if (!status) return (
    <div className={styles.empty}>
      <p>Not a git repository</p>
      <button className={styles.initBtn} onClick={() => window.zeus.git.init(projectRoot).then(() => refresh(projectRoot))}>
        Initialize Repository
      </button>
    </div>
  )

  const allUnstaged = [...status.unstaged, ...status.untracked]

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>SOURCE CONTROL</span>
        <div className={styles.headerActions}>
          <button className="icon-btn" onClick={() => refresh(projectRoot)} title="Refresh">⟳</button>
          <button className="icon-btn" onClick={() => push(projectRoot)} title="Push">↑</button>
          <button className="icon-btn" onClick={() => pull(projectRoot)} title="Pull">↓</button>
        </div>
      </div>

      {/* Branch */}
      <div className={styles.branch}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
          <path d="M6 9v6M9 6h6a3 3 0 0 1 3 3v6" />
        </svg>
        <span className={styles.branchName}>{status.branch}</span>
        {status.ahead > 0 && <span className={styles.sync}>↑{status.ahead}</span>}
        {status.behind > 0 && <span className={styles.sync}>↓{status.behind}</span>}
      </div>

      {/* Commit message */}
      <div className={styles.commitArea}>
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Commit message..."
          className={styles.commitInput}
          rows={3}
        />
        <button
          className={styles.commitBtn}
          onClick={() => commit(projectRoot)}
          disabled={!commitMessage.trim() || status.staged.length === 0}
        >
          Commit {status.staged.length > 0 && `(${status.staged.length})`}
        </button>
      </div>

      {/* Staged changes */}
      {status.staged.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span>Staged Changes ({status.staged.length})</span>
          </div>
          {status.staged.map((f) => (
            <div key={f.path} className={styles.fileRow}>
              <span className={`${styles.fileStatus} ${styles.staged}`}>{f.index}</span>
              <span className={styles.fileName}>{f.path.split(/[/\\]/).pop()}</span>
              <button
                className={styles.fileAction}
                onClick={() => unstage(projectRoot, [f.path])}
                title="Unstage"
              >−</button>
            </div>
          ))}
        </div>
      )}

      {/* Unstaged changes */}
      {allUnstaged.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span>Changes ({allUnstaged.length})</span>
            <button
              className={styles.stageAllBtn}
              onClick={() => stage(projectRoot, allUnstaged.map((f) => f.path))}
            >Stage All</button>
          </div>
          {allUnstaged.map((f) => (
            <div key={f.path} className={styles.fileRow}>
              <span className={`${styles.fileStatus} ${styles.modified}`}>{f.working}</span>
              <span className={styles.fileName}>{f.path.split(/[/\\]/).pop()}</span>
              <button
                className={styles.fileAction}
                onClick={() => stage(projectRoot, [f.path])}
                title="Stage"
              >+</button>
            </div>
          ))}
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}
    </div>
  )
}

export default GitPanel
