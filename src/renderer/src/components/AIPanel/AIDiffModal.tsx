// ============================================================
// ZEUS — AI Diff Modal
// ============================================================
// Shows before/after diff before applying AI results.
// User MUST accept or reject — no silent code modification.
// ============================================================

import React from 'react'
import styles from './AIDiffModal.module.css'

interface Props {
  before: string
  after: string
  explanation?: string
  action: string
  onApply: () => void
  onReject: () => void
}

function computeDiffLines(before: string, after: string): Array<{ type: 'context' | 'add' | 'remove'; text: string }> {
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')

  // Simple unified diff (LCS-based is complex; use line-by-line comparison)
  const result: Array<{ type: 'context' | 'add' | 'remove'; text: string }> = []

  const maxLen = Math.max(beforeLines.length, afterLines.length)
  for (let i = 0; i < maxLen; i++) {
    const bLine = beforeLines[i]
    const aLine = afterLines[i]

    if (bLine === aLine) {
      result.push({ type: 'context', text: ` ${bLine ?? ''}` })
    } else {
      if (bLine !== undefined) result.push({ type: 'remove', text: `-${bLine}` })
      if (aLine !== undefined) result.push({ type: 'add',    text: `+${aLine}` })
    }
  }

  return result
}

const AIDiffModal: React.FC<Props> = ({ before, after, explanation, action, onApply, onReject }) => {
  const diffLines = before ? computeDiffLines(before, after) : null
  const actionLabels: Record<string, string> = {
    correct: 'Corrected Code',
    optimize: 'Optimized Code',
    refactor: 'Refactored Code',
    tests: 'Generated Tests',
    docs: 'Generated Documentation'
  }

  return (
    <div className={styles.overlay} onClick={onReject}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.aiChip}>⚡ AI</span>
            <h2 className={styles.title}>{actionLabels[action] || 'AI Result'}</h2>
          </div>
          <button className={styles.closeBtn} onClick={onReject}>×</button>
        </div>

        {/* Explanation */}
        {explanation && (
          <div className={styles.explanation}>
            <span className={styles.explainLabel}>Analysis</span>
            <p>{explanation}</p>
          </div>
        )}

        {/* Diff or new code */}
        <div className={styles.diffContainer}>
          {diffLines ? (
            <>
              <div className={styles.diffHeader}>
                <span className={styles.diffLabel}>
                  <span style={{ color: 'var(--color-error)' }}>— Before</span>
                  {' '}·{' '}
                  <span style={{ color: 'var(--color-success)' }}>+ After</span>
                </span>
              </div>
              <div className={styles.diffBody}>
                {diffLines.map((line, i) => (
                  <div
                    key={i}
                    className={`${styles.diffLine} ${
                      line.type === 'add' ? styles.added :
                      line.type === 'remove' ? styles.removed : styles.context
                    }`}
                  >
                    <span className={styles.linePrefix}>
                      {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
                    </span>
                    <span className={styles.lineText}>{line.text.slice(1)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <pre className={styles.newCode}>{after}</pre>
          )}
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.rejectBtn} onClick={onReject}>
            ✕ Reject
          </button>
          <button className={styles.applyBtn} onClick={onApply}>
            ✓ Apply
          </button>
        </div>
      </div>
    </div>
  )
}

export default AIDiffModal
