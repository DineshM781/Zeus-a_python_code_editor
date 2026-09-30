// ============================================================
// ZEUS — AI Explain Modal
// ============================================================

import React from 'react'
import styles from './AIExplainModal.module.css'

interface Props {
  explanation: string
  keyPoints: string[]
  onClose: () => void
}

const AIExplainModal: React.FC<Props> = ({ explanation, keyPoints, onClose }) => {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.aiChip}>⚡ AI</span>
            <h2 className={styles.title}>Code Explanation</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.body}>
          <p className={styles.explanation}>{explanation}</p>

          {keyPoints.length > 0 && (
            <div className={styles.keyPoints}>
              <h3 className={styles.keyPointsTitle}>Key Points</h3>
              <ul>
                {keyPoints.map((point, i) => (
                  <li key={i} className={styles.keyPoint}>
                    <span className={styles.bullet}>◆</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.closeButton} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default AIExplainModal
