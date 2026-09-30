// ============================================================
// ZEUS — Editor Tabs
// ============================================================

import React, { useState } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import type { EditorGroup } from '../../stores/editorStore'
import styles from './EditorTabs.module.css'

interface Props {
  group: EditorGroup
}

const EditorTabs: React.FC<Props> = ({ group }) => {
  const { setActiveTab, closeTab, closeOtherTabs, closeAllTabs, pinTab } = useEditorStore()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null)

  const getTabIcon = (lang: string, fileName: string) => {
    if (fileName.endsWith('.ipynb')) return '📓'
    switch (lang) {
      case 'python':     return '🐍'
      case 'typescript': return '📘'
      case 'javascript': return '📜'
      case 'json':       return '🔧'
      case 'markdown':   return '📝'
      case 'css':        return '🎨'
      case 'html':       return '🌐'
      default:           return '📄'
    }
  }

  return (
    <div className={styles.tabsContainer} onClick={() => setContextMenu(null)}>
      <div className={styles.tabs}>
        {group.tabs.map((tab) => (
          <div
            key={tab.id}
            className={`${styles.tab} ${tab.id === group.activeTabId ? styles.active : ''} ${tab.isPinned ? styles.pinned : ''}`}
            onClick={() => setActiveTab(group.id, tab.id)}
            onContextMenu={(e) => {
              e.preventDefault()
              setContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id })
            }}
            title={tab.filePath}
          >
            <span className={styles.tabIcon}>{getTabIcon(tab.language, tab.fileName)}</span>
            <span className={styles.tabName}>{tab.fileName}</span>
            {tab.isDirty && <span className={styles.dirtyDot} title="Unsaved changes" />}
            {!tab.isDirty && (
              <button
                className={styles.closeBtn}
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(group.id, tab.id)
                }}
                title="Close"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => { e.stopPropagation(); setContextMenu(null) }}
        >
          <div className="context-menu-item" onClick={() => closeTab(group.id, contextMenu.tabId)}>
            Close Tab
          </div>
          <div className="context-menu-item" onClick={() => closeOtherTabs(group.id, contextMenu.tabId)}>
            Close Others
          </div>
          <div className="context-menu-item" onClick={() => closeAllTabs(group.id)}>
            Close All
          </div>
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={() => pinTab(group.id, contextMenu.tabId)}>
            Pin Tab
          </div>
        </div>
      )}
    </div>
  )
}

export default EditorTabs
