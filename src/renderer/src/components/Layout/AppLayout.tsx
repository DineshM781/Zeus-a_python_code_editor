// ============================================================
// ZEUS — Main App Layout
// ============================================================

import React, { useState, useCallback, useRef } from 'react'
import TitleBar from '../TitleBar/TitleBar'
import ActivityBar from '../ActivityBar/ActivityBar'
import SidePanel from '../SidePanel/SidePanel'
import EditorArea from '../Editor/EditorArea'
import BottomPanel from '../BottomPanel/BottomPanel'
import StatusBar from '../StatusBar/StatusBar'
import { useTerminalStore } from '../../stores/terminalStore'
import styles from './AppLayout.module.css'

export type SidePanelView = 'explorer' | 'search' | 'git' | 'debug' | null

const AppLayout: React.FC = () => {
  const [activeSideView, setActiveSideView] = useState<SidePanelView>('explorer')
  const [sidePanelWidth, setSidePanelWidth] = useState(260)
  const [bottomPanelHeight, setBottomPanelHeight] = useState(220)
  const { isVisible: isBottomVisible, setVisible: setIsBottomVisible } = useTerminalStore()

  const sideResizing = useRef(false)
  const bottomResizing = useRef(false)
  const sideStartX = useRef(0)
  const bottomStartY = useRef(0)
  const sideStartWidth = useRef(260)
  const bottomStartHeight = useRef(220)

  // ── Side panel resize ────────────────────────────────────────
  const handleSideResizeStart = useCallback((e: React.MouseEvent) => {
    sideResizing.current = true
    sideStartX.current = e.clientX
    sideStartWidth.current = sidePanelWidth

    const onMove = (ev: MouseEvent) => {
      if (!sideResizing.current) return
      const delta = ev.clientX - sideStartX.current
      const newWidth = Math.max(160, Math.min(600, sideStartWidth.current + delta))
      setSidePanelWidth(newWidth)
    }
    const onUp = () => {
      sideResizing.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [sidePanelWidth])

  // ── Bottom panel resize ──────────────────────────────────────
  const handleBottomResizeStart = useCallback((e: React.MouseEvent) => {
    bottomResizing.current = true
    bottomStartY.current = e.clientY
    bottomStartHeight.current = bottomPanelHeight

    const onMove = (ev: MouseEvent) => {
      if (!bottomResizing.current) return
      const delta = bottomStartY.current - ev.clientY
      const newHeight = Math.max(80, Math.min(600, bottomStartHeight.current + delta))
      setBottomPanelHeight(newHeight)
    }
    const onUp = () => {
      bottomResizing.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [bottomPanelHeight])

  const handleActivityClick = (view: SidePanelView) => {
    if (activeSideView === view) {
      setActiveSideView(null)
    } else {
      setActiveSideView(view)
    }
  }

  return (
    <div className={styles.layout}>
      <TitleBar />

      <div className={styles.workArea}>
        {/* Activity bar (leftmost icon rail) */}
        <ActivityBar activeView={activeSideView} onViewChange={handleActivityClick} />

        {/* Side panel (explorer, search, git, debug) */}
        {activeSideView && (
          <>
            <div
              className={styles.sidePanel}
              style={{ width: sidePanelWidth }}
            >
              <SidePanel view={activeSideView} />
            </div>
            <div
              className={`resize-handle resize-handle-v ${styles.sideResizeHandle}`}
              onMouseDown={handleSideResizeStart}
            />
          </>
        )}

        {/* Main content area */}
        <div className={styles.mainArea}>
          <EditorArea />

          {/* Bottom panel resize handle */}
          {isBottomVisible && (
            <div
              className={`resize-handle resize-handle-h ${styles.bottomResizeHandle}`}
              onMouseDown={handleBottomResizeStart}
            />
          )}

          {/* Bottom panel (terminal, problems, output) */}
          {isBottomVisible && (
            <div
              className={styles.bottomPanel}
              style={{ height: bottomPanelHeight }}
            >
              <BottomPanel onClose={() => setIsBottomVisible(false)} />
            </div>
          )}
        </div>
      </div>

      <StatusBar
        onTogglePanel={() => setIsBottomVisible((v) => !v)}
        isPanelVisible={isBottomVisible}
      />
    </div>
  )
}

export default AppLayout
