// ============================================================
// ZEUS — Activity Bar (leftmost icon rail)
// ============================================================

import React from 'react'
import type { SidePanelView } from '../Layout/AppLayout'
import { useGitStore } from '../../stores/gitStore'
import { useEditorStore } from '../../stores/editorStore'
import { useSettingsStore } from '../../stores/settingsStore'
import styles from './ActivityBar.module.css'

interface Props {
  activeView: SidePanelView
  onViewChange: (view: SidePanelView) => void
}

const ActivityBar: React.FC<Props> = ({ activeView, onViewChange }) => {
  const { status: gitStatus } = useGitStore()
  const { diagnostics } = useEditorStore()
  const { openSettings } = useSettingsStore()

  const errorCount = Object.values(diagnostics)
    .flat()
    .filter((d) => d.severity === 'error').length

  const gitChanges = gitStatus
    ? gitStatus.staged.length + gitStatus.unstaged.length + gitStatus.untracked.length
    : 0

  const items: Array<{
    id: SidePanelView
    icon: React.ReactNode
    title: string
    badge?: number
  }> = [
    {
      id: 'explorer',
      title: 'Explorer',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 7a2 2 0 0 1 2-2h4.586a1 1 0 0 1 .707.293l1.414 1.414A1 1 0 0 0 12.414 7H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
        </svg>
      )
    },
    {
      id: 'search',
      title: 'Search',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="22" y2="22" strokeLinecap="round" />
        </svg>
      )
    },
    {
      id: 'git',
      title: 'Source Control',
      badge: gitChanges || undefined,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="18" cy="18" r="3" />
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M6 9v6M9 6h6a3 3 0 0 1 3 3v6" />
        </svg>
      )
    },
    {
      id: 'debug',
      title: 'Run & Debug',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 6.5L3 12l5 5.5M16 6.5L21 12l-5 5.5M14 4l-4 16" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }
  ]

  return (
    <div className={styles.activityBar}>
      <div className={styles.topItems}>
        {items.map((item) => (
          <button
            key={item.id}
            className={`${styles.item} ${activeView === item.id ? styles.active : ''}`}
            onClick={() => onViewChange(item.id as SidePanelView)}
            title={item.title}
            aria-label={item.title}
          >
            {item.icon}
            {item.badge !== undefined && item.badge > 0 && (
              <span className={styles.badge}>{item.badge > 99 ? '99+' : item.badge}</span>
            )}
            {item.id === 'debug' && errorCount > 0 && (
              <span className={`${styles.badge} ${styles.badgeError}`}>
                {errorCount > 99 ? '99+' : errorCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className={styles.bottomItems}>
        <button
          className={styles.item}
          onClick={openSettings}
          title="Settings"
          aria-label="Open Settings"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2a10 10 0 0 1 0 20A10 10 0 0 1 12 2" opacity=".3" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default ActivityBar
