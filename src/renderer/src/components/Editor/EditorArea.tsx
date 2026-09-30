// ============================================================
// ZEUS — Editor Area (tabs + editor/notebook routing)
// ============================================================

import React from 'react'
import { useEditorStore } from '../../stores/editorStore'
import EditorTabs from './EditorTabs'
import MonacoEditor from './MonacoEditor'
import NotebookView from '../Notebook/NotebookView'
import EmptyEditor from './EmptyEditor'
import styles from './EditorArea.module.css'

const EditorArea: React.FC = () => {
  const { groups, activeGroupId } = useEditorStore()
  const group = groups.find((g) => g.id === activeGroupId) || groups[0]

  if (!group || group.tabs.length === 0) {
    return (
      <div className={styles.editorArea}>
        <EmptyEditor />
      </div>
    )
  }

  const activeTab = group.tabs.find((t) => t.id === group.activeTabId) || group.tabs[0]

  return (
    <div className={styles.editorArea}>
      <EditorTabs group={group} />
      <div className={styles.editorContent}>
        {activeTab.fileName.endsWith('.ipynb') ? (
          <NotebookView
            key={activeTab.id}
            tabId={activeTab.id}
            filePath={activeTab.filePath}
            content={activeTab.content}
          />
        ) : (
          <MonacoEditor
            key={activeTab.id}
            tabId={activeTab.id}
            filePath={activeTab.filePath}
            content={activeTab.content}
            language={activeTab.language}
            readOnly={activeTab.isReadOnly}
          />
        )}
      </div>
    </div>
  )
}

export default EditorArea
