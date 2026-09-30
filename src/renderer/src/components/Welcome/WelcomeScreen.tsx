// ============================================================
// ZEUS — Welcome Screen (Simple & Professional IDE start page)
// ============================================================

import React, { useState } from 'react'
import { useExplorerStore } from '../../stores/explorerStore'
import { useEditorStore } from '../../stores/editorStore'
import styles from './WelcomeScreen.module.css'

const WelcomeScreen: React.FC = () => {
  const { setProjectRoot } = useExplorerStore()
  const { openFile } = useEditorStore()
  const [isLoading, setIsLoading] = useState(false)

  const handleOpenFolder = async () => {
    const result = await window.zeus.fs.openDialog({
      properties: ['openDirectory'],
      title: 'Open Project Folder'
    })
    if (!result.canceled && result.filePaths[0]) {
      setIsLoading(true)
      await setProjectRoot(result.filePaths[0])
      setIsLoading(false)
    }
  }

  const handleOpenFile = async () => {
    const result = await window.zeus.fs.openDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Python', extensions: ['py', 'pyw', 'ipynb'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      title: 'Open File'
    })
    if (!result.canceled && result.filePaths[0]) {
      const fp = result.filePaths[0]
      const dir = fp.replace(/[/\\][^/\\]+$/, '')
      await setProjectRoot(dir)
      const content = await window.zeus.fs.readFile(fp)
      openFile(fp, content, '')
    }
  }

  const handleNewFile = () => {
    const newName = `untitled_${Date.now().toString().slice(-4)}.py`
    const defaultContent = '# ZEUS — Python 3\n\ndef main():\n    print("Hello from ZEUS!")\n\nif __name__ == "__main__":\n    main()\n'
    openFile(newName, defaultContent, 'python')
  }

  return (
    <div className={styles.screen}>
      <div className={styles.container}>
        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.logoWrapper}>
            <svg width="60" height="60" viewBox="0 0 80 80" fill="none">
              <defs>
                <linearGradient id="zeusLogoGrad" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#7c6af5"/>
                  <stop offset="100%" stopColor="#a78bfa"/>
                </linearGradient>
              </defs>
              <polygon
                points="40,6 66,21 66,59 40,74 14,59 14,21"
                fill="none"
                stroke="url(#zeusLogoGrad)"
                strokeWidth="2.5"
                opacity="0.8"
              />
              <text x="40" y="51" textAnchor="middle" fontSize="30" fontWeight="900"
                fontFamily="Inter,sans-serif" fill="url(#zeusLogoGrad)">Z</text>
            </svg>
          </div>
          <div className={styles.brandText}>
            <h1 className={styles.brandName}>ZEUS</h1>
            <p className={styles.brandSub}>a python coder</p>
          </div>
        </div>

        {/* Professional Two-Column Layout */}
        <div className={styles.sectionsGrid}>
          {/* Start Section */}
          <div className={styles.sectionCol}>
            <h2 className={styles.sectionTitle}>Start</h2>
            <div className={styles.actionList}>
              <button className={styles.actionItem} onClick={handleNewFile}>
                <span className={styles.actionIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </span>
                <span className={styles.actionLabel}>New Python File</span>
                <kbd className={styles.actionKey}>Ctrl+N</kbd>
              </button>

              <button className={styles.actionItem} onClick={handleOpenFile}>
                <span className={styles.actionIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </span>
                <span className={styles.actionLabel}>Open File...</span>
                <kbd className={styles.actionKey}>Ctrl+O</kbd>
              </button>

              <button className={styles.actionItem} onClick={handleOpenFolder} disabled={isLoading}>
                <span className={styles.actionIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </span>
                <span className={styles.actionLabel}>Open Folder...</span>
                <kbd className={styles.actionKey}>Ctrl+Shift+O</kbd>
              </button>
            </div>
          </div>

          {/* Quick Shortcuts Section */}
          <div className={styles.sectionCol}>
            <h2 className={styles.sectionTitle}>Shortcuts</h2>
            <div className={styles.shortcutList}>
              <div className={styles.shortcutRow}>
                <span className={styles.shortcutDesc}>Run Python File</span>
                <kbd className={styles.shortcutKey}>Ctrl+F5</kbd>
              </div>
              <div className={styles.shortcutRow}>
                <span className={styles.shortcutDesc}>Integrated Terminal</span>
                <kbd className={styles.shortcutKey}>Ctrl+`</kbd>
              </div>
              <div className={styles.shortcutRow}>
                <span className={styles.shortcutDesc}>Save Document</span>
                <kbd className={styles.shortcutKey}>Ctrl+S</kbd>
              </div>
              <div className={styles.shortcutRow}>
                <span className={styles.shortcutDesc}>Search in Files</span>
                <kbd className={styles.shortcutKey}>Ctrl+Shift+F</kbd>
              </div>
              <div className={styles.shortcutRow}>
                <span className={styles.shortcutDesc}>Format Document</span>
                <kbd className={styles.shortcutKey}>Shift+Alt+F</kbd>
              </div>
            </div>
          </div>
        </div>

        <p className={styles.version}>
          ZEUS v1.0 &nbsp;·&nbsp; Python 3 IDE
        </p>
      </div>
    </div>
  )
}

export default WelcomeScreen
