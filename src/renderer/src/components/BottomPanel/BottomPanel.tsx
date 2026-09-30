// ============================================================
// ZEUS — Bottom Panel (Problems / Output / Terminal tabs)
// ============================================================

import React from 'react'
import ProblemsPanel from '../Problems/ProblemsPanel'
import OutputPanel from './OutputPanel'
import TerminalPanel from '../Terminal/TerminalPanel'
import { useTerminalStore, PanelTab } from '../../stores/terminalStore'
import styles from './BottomPanel.module.css'

interface Props {
  onClose: () => void
}

const BottomPanel: React.FC<Props> = ({ onClose }) => {
  const { activePanelTab, setActivePanelTab } = useTerminalStore()

  return (
    <div className={styles.panel}>
      <div className={styles.tabBar}>
        <div className={styles.tabs}>
          {(['problems', 'output', 'terminal'] as PanelTab[]).map((tab) => (
            <button
              key={tab}
              className={`${styles.tab} ${activePanelTab === tab ? styles.active : ''}`}
              onClick={() => setActivePanelTab(tab)}
            >
              {tab === 'problems' && '⚠ Problems'}
              {tab === 'output' && '▶ Output'}
              {tab === 'terminal' && '$ Terminal'}
            </button>
          ))}
        </div>
        <div className={styles.tabActions}>
          <button className="icon-btn" onClick={onClose} title="Close Panel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {activePanelTab === 'problems' && <ProblemsPanel />}
        {activePanelTab === 'output' && <OutputPanel />}
        {activePanelTab === 'terminal' && <TerminalPanel />}
      </div>
    </div>
  )
}

export default BottomPanel
