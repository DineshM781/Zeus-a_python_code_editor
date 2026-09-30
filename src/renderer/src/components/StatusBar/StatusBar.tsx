// ============================================================
// ZEUS — Status Bar
// ============================================================

import React, { useEffect, useState } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { useGitStore } from '../../stores/gitStore'
import { useDebugStore } from '../../stores/debugStore'
import { useExplorerStore } from '../../stores/explorerStore'
import { aiProvider } from '../../ai/ai_provider'
import styles from './StatusBar.module.css'

interface Props {
  onTogglePanel: () => void
  isPanelVisible: boolean
}

const StatusBar: React.FC<Props> = ({ onTogglePanel, isPanelVisible }) => {
  const { getActiveTab, diagnostics } = useEditorStore()
  const { status: gitStatus } = useGitStore()
  const { state: debugState } = useDebugStore()
  const { projectRoot } = useExplorerStore()
  const [pythonVersion, setPythonVersion] = useState<string>('')
  const [aiReady, setAiReady] = useState<boolean | null>(null)

  const activeTab = getActiveTab()

  // Detect Python version
  useEffect(() => {
    if (!projectRoot) return
    window.zeus.python.detect(projectRoot).then((envs) => {
      if (envs.length > 0) {
        setPythonVersion(`Python ${envs[0].version}`)
      }
    }).catch(() => setPythonVersion('Python: not found'))
  }, [projectRoot])

  // Check AI availability
  useEffect(() => {
    aiProvider.isAvailable().then(setAiReady)
  }, [])

  // Count diagnostics for active file
  const fileDiags = activeTab ? (diagnostics[activeTab.filePath] || []) : []
  const errorCount   = fileDiags.filter((d) => d.severity === 'error').length
  const warningCount = fileDiags.filter((d) => d.severity === 'warning').length

  const language = activeTab?.language || ''
  const line     = activeTab?.cursorLine || 1
  const col      = activeTab?.cursorColumn || 1

  return (
    <div className={`${styles.statusBar} ${debugState !== 'idle' ? styles.debugging : ''}`}>
      {/* Left section */}
      <div className={styles.left}>
        {/* Git branch */}
        {gitStatus && (
          <div className={styles.item} title="Git Branch">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
              <path d="M6 9v6M9 6h6a3 3 0 0 1 3 3v6" />
            </svg>
            <span>{gitStatus.branch}</span>
            {(gitStatus.ahead > 0 || gitStatus.behind > 0) && (
              <span className={styles.gitSync}>
                {gitStatus.ahead > 0 && `↑${gitStatus.ahead}`}
                {gitStatus.behind > 0 && `↓${gitStatus.behind}`}
              </span>
            )}
          </div>
        )}

        {/* Error/warning counts */}
        {(errorCount > 0 || warningCount > 0) && (
          <div className={`${styles.item} ${errorCount > 0 ? styles.hasErrors : styles.hasWarnings}`}
            onClick={onTogglePanel}
          >
            {errorCount > 0 && <span>❌ {errorCount}</span>}
            {warningCount > 0 && <span>⚠ {warningCount}</span>}
          </div>
        )}

        {/* Debug state */}
        {debugState !== 'idle' && (
          <div className={`${styles.item} ${styles.debugActive}`}>
            <span className="animate-pulse">●</span>
            <span>{debugState === 'paused' ? 'Paused' : 'Debugging'}</span>
          </div>
        )}
      </div>

      {/* Right section */}
      <div className={styles.right}>
        {/* Python version */}
        {pythonVersion && (
          <div className={styles.item} title="Python Interpreter">
            <span>🐍</span>
            <span>{pythonVersion}</span>
          </div>
        )}

        {/* Language */}
        {language && (
          <div className={styles.item}>
            <span>{language}</span>
          </div>
        )}

        {/* Cursor position */}
        {activeTab && (
          <div className={styles.item} title="Line and Column">
            <span>Ln {line}, Col {col}</span>
          </div>
        )}

        {/* AI status */}
        <div
          className={`${styles.item} ${aiReady ? styles.aiReady : aiReady === false ? styles.aiOff : ''}`}
          title={aiReady ? 'AI Provider: Ready' : 'AI Provider: Not configured'}
        >
          <span>⚡</span>
          <span>{aiReady ? 'AI: Ready' : aiReady === false ? 'AI: Off' : 'AI: ...'}</span>
        </div>

        {/* Panel toggle */}
        <button
          className={styles.panelToggle}
          onClick={onTogglePanel}
          title={isPanelVisible ? 'Hide Panel' : 'Show Panel'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isPanelVisible
              ? <polyline points="18 15 12 9 6 15" />
              : <polyline points="6 9 12 15 18 9" />
            }
          </svg>
        </button>
      </div>
    </div>
  )
}

export default StatusBar
