// ============================================================
// ZEUS — Problems Panel (Error Lens list view)
// ============================================================

import React from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { useEditorStore as useEd } from '../../stores/editorStore'
import type { Diagnostic, DiagnosticSeverity } from '../../../../shared/types'
import styles from './ProblemsPanel.module.css'

const SEVERITY_ICON: Record<DiagnosticSeverity, string> = {
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  hint: '💡'
}

const ProblemsPanel: React.FC = () => {
  const { diagnostics } = useEditorStore()

  const allDiagnostics: Array<Diagnostic & { relativeFile: string }> = []
  for (const [filePath, diags] of Object.entries(diagnostics)) {
    const fileName = filePath.split(/[/\\]/).pop() || filePath
    for (const d of diags) {
      allDiagnostics.push({ ...d, relativeFile: fileName })
    }
  }

  const errors   = allDiagnostics.filter((d) => d.severity === 'error')
  const warnings = allDiagnostics.filter((d) => d.severity === 'warning')
  const infos    = allDiagnostics.filter((d) => d.severity === 'info' || d.severity === 'hint')

  const handleClick = async (diag: Diagnostic) => {
    // Open file and jump to location
    const { openFile, groups, activeGroupId, setActiveTab } = useEditorStore.getState()

    // Check if already open
    const group = groups.find((g) => g.id === activeGroupId)
    const existingTab = groups.flatMap((g) => g.tabs).find((t) => t.filePath === diag.filePath)
    if (existingTab) {
      // Just navigate — the editor cursor update is handled by Monaco
      return
    }

    // Open the file
    try {
      const content = await window.zeus.fs.readFile(diag.filePath)
      openFile(diag.filePath, content, 'python')
    } catch { /* ignore */ }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.summary}>
        {errors.length > 0 && (
          <span className={styles.summaryItem}>
            ❌ <strong>{errors.length}</strong> Error{errors.length !== 1 ? 's' : ''}
          </span>
        )}
        {warnings.length > 0 && (
          <span className={styles.summaryItem}>
            ⚠️ <strong>{warnings.length}</strong> Warning{warnings.length !== 1 ? 's' : ''}
          </span>
        )}
        {infos.length > 0 && (
          <span className={styles.summaryItem}>
            ℹ️ <strong>{infos.length}</strong> Info
          </span>
        )}
        {allDiagnostics.length === 0 && (
          <span className={styles.noProblems}>✅ No problems detected</span>
        )}
      </div>

      <div className={styles.list}>
        {allDiagnostics.map((diag) => (
          <div
            key={diag.id}
            className={`${styles.item} ${styles[diag.severity]}`}
            onClick={() => handleClick(diag)}
            title={`${diag.filePath}:${diag.line}:${diag.column}`}
          >
            <span className={styles.icon}>{SEVERITY_ICON[diag.severity]}</span>
            <div className={styles.itemContent}>
              <span className={styles.message}>{diag.message}</span>
              <span className={styles.location}>
                {diag.relativeFile}:{diag.line}:{diag.column}
                {diag.code && <span className={styles.code}> [{diag.code}]</span>}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ProblemsPanel
