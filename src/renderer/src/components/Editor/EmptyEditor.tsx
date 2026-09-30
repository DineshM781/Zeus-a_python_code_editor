// ============================================================
// ZEUS — Empty Editor (no file open)
// ============================================================

import React from 'react'
import { useExplorerStore } from '../../stores/explorerStore'
import styles from './EmptyEditor.module.css'

const EmptyEditor: React.FC = () => {
  const { projectRoot } = useExplorerStore()

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* ZEUS logo / branding */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#7c6af5"/>
                  <stop offset="100%" stopColor="#c084fc"/>
                </linearGradient>
              </defs>
              <polygon
                points="32,4 52,16 52,48 32,60 12,48 12,16"
                fill="none"
                stroke="url(#logoGrad)"
                strokeWidth="2.5"
              />
              <text x="32" y="39" textAnchor="middle" fontSize="22" fontWeight="800"
                fontFamily="Inter,sans-serif" fill="url(#logoGrad)">Z</text>
            </svg>
          </div>
          <div className={styles.logoText}>
            <span className={styles.brandName}>ZEUS</span>
            <span className={styles.brandSub}>a python coder</span>
          </div>
        </div>

        {/* Quick actions */}
        <div className={styles.actions}>
          <div className={styles.actionGroup}>
            <h3 className={styles.actionGroupTitle}>Start</h3>
            <button className={styles.actionItem} onClick={() => {
              window.zeus.fs.openDialog({ properties: ['openDirectory'] }).then((result) => {
                if (!result.canceled && result.filePaths[0]) {
                  useExplorerStore.getState().setProjectRoot(result.filePaths[0])
                }
              })
            }}>
              📁 Open Folder
            </button>
            <button className={styles.actionItem} onClick={() => {
              window.zeus.fs.openDialog({ properties: ['openFile'], filters: [
                { name: 'Python', extensions: ['py', 'pyw', 'ipynb'] },
                { name: 'All', extensions: ['*'] }
              ]}).then(async (result) => {
                if (!result.canceled && result.filePaths[0]) {
                  const fp = result.filePaths[0]
                  const content = await window.zeus.fs.readFile(fp)
                  useEditorStore.getState().openFile(fp, content, '')
                }
              })
            }}>
              📄 Open File
            </button>
          </div>

          <div className={styles.actionGroup}>
            <h3 className={styles.actionGroupTitle}>Shortcuts</h3>
            <div className={styles.shortcut}>
              <kbd>Ctrl+S</kbd><span>Save</span>
            </div>
            <div className={styles.shortcut}>
              <kbd>Ctrl+`</kbd><span>Open Terminal</span>
            </div>
            <div className={styles.shortcut}>
              <kbd>F5</kbd><span>Run File</span>
            </div>
            <div className={styles.shortcut}>
              <kbd>Tab</kbd><span>Accept AI Completion</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Import here to avoid circular — fine for this component
import { useEditorStore } from '../../stores/editorStore'

export default EmptyEditor
