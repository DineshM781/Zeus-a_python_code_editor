// ============================================================
// ZEUS — Debug Panel
// ============================================================

import React from 'react'
import { useDebugStore } from '../../stores/debugStore'
import { useEditorStore } from '../../stores/editorStore'
import { useSettingsStore } from '../../stores/settingsStore'
import styles from './DebugPanel.module.css'

const DebugPanel: React.FC = () => {
  const { state, breakpoints, currentFrame, output, clearBreakpoints, startDebug, stopDebug, continue: cont, pause, stepOver, stepIn, stepOut } = useDebugStore()
  const { getActiveTab } = useEditorStore()
  const { settings } = useSettingsStore()

  const activeTab = getActiveTab()
  const isPython = activeTab?.language === 'python'
  const isIdle = state === 'idle'

  const handleStart = () => {
    if (!activeTab?.filePath) return
    startDebug(activeTab.filePath, settings.python.interpreterPath)
  }

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>RUN & DEBUG</span>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        {isIdle ? (
          <button
            className={styles.startBtn}
            onClick={handleStart}
            disabled={!isPython}
            title={!isPython ? 'Open a Python file to debug' : 'Start Debugging (F5)'}
          >
            ▶ Start Debugging
          </button>
        ) : (
          <div className={styles.debugControls}>
            <button className={`${styles.ctrl} ${styles.contBtn}`} onClick={cont} title="Continue (F5)" disabled={state !== 'paused'}>▶</button>
            <button className={`${styles.ctrl}`} onClick={stepOver} title="Step Over (F10)" disabled={state !== 'paused'}>⤵</button>
            <button className={`${styles.ctrl}`} onClick={stepIn} title="Step Into (F11)" disabled={state !== 'paused'}>↓</button>
            <button className={`${styles.ctrl}`} onClick={stepOut} title="Step Out (Shift+F11)" disabled={state !== 'paused'}>↑</button>
            <button className={`${styles.ctrl}`} onClick={pause} title="Pause" disabled={state !== 'running'}>⏸</button>
            <button className={`${styles.ctrl} ${styles.stopBtn}`} onClick={stopDebug} title="Stop (Shift+F5)">⏹</button>
          </div>
        )}

        <div className={`${styles.stateBadge} ${styles[state]}`}>
          {state === 'idle' && '● Idle'}
          {state === 'running' && '▶ Running'}
          {state === 'paused' && '⏸ Paused'}
          {state === 'stopped' && '⏹ Stopped'}
        </div>
      </div>

      {/* Current location */}
      {currentFrame && (
        <div className={styles.location}>
          <span className={styles.locationIcon}>→</span>
          <span>{currentFrame.filePath.split(/[/\\]/).pop()}:{currentFrame.line}</span>
        </div>
      )}

      {/* Breakpoints */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span>Breakpoints ({breakpoints.length})</span>
          {breakpoints.length > 0 && (
            <button className={styles.clearBtn} onClick={() => clearBreakpoints()}>Clear All</button>
          )}
        </div>
        {breakpoints.length === 0 ? (
          <div className={styles.hint}>Click the gutter in the editor to add breakpoints</div>
        ) : (
          breakpoints.map((bp) => (
            <div key={bp.id} className={styles.bpRow}>
              <span className={styles.bpDot}>●</span>
              <span className={styles.bpFile}>{bp.filePath.split(/[/\\]/).pop()}</span>
              <span className={styles.bpLine}>:{bp.line}</span>
            </div>
          ))
        )}
      </div>

      {/* Debug output */}
      {output.length > 0 && (
        <div className={styles.debugOutput}>
          <div className={styles.sectionHeader}><span>Console Output</span></div>
          <div className={styles.outputScroll}>
            {output.slice(-100).map((o, i) => (
              <div key={i} className={`${styles.outputLine} ${o.category === 'stderr' ? styles.errorLine : ''}`}>
                {o.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default DebugPanel
