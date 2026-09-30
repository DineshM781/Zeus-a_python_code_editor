// ============================================================
// ZEUS — Title Bar (custom frameless window chrome)
// ============================================================

import React from 'react'
import styles from './TitleBar.module.css'

const TitleBar: React.FC = () => {
  const handleMinimize = () => window.zeus.app.minimize()
  const handleMaximize = () => window.zeus.app.maximize()
  const handleClose    = () => window.zeus.app.quit()

  return (
    <div className={styles.titleBar} data-drag-region>
      {/* Brand */}
      <div className={styles.brand}>
        <span className={styles.brandName}>ZEUS</span>
        <span className={styles.brandSub}>a python coder</span>
      </div>

      {/* Drag region (center) */}
      <div className={styles.dragRegion} />

      {/* Window controls */}
      <div className={styles.windowControls}>
        <button
          className={`${styles.winBtn} ${styles.minimize}`}
          onClick={handleMinimize}
          title="Minimize"
          aria-label="Minimize window"
        >
          <svg width="10" height="2" viewBox="0 0 10 2">
            <rect width="10" height="2" rx="1" fill="currentColor" />
          </svg>
        </button>
        <button
          className={`${styles.winBtn} ${styles.maximize}`}
          onClick={handleMaximize}
          title="Maximize"
          aria-label="Maximize window"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="1" y="1" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </button>
        <button
          className={`${styles.winBtn} ${styles.close}`}
          onClick={handleClose}
          title="Close"
          aria-label="Close window"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default TitleBar
