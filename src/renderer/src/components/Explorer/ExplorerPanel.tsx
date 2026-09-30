// ============================================================
// ZEUS — File Explorer Panel
// ============================================================

import React, { useState, useRef, useCallback } from 'react'
import { useExplorerStore } from '../../stores/explorerStore'
import { useEditorStore } from '../../stores/editorStore'
import type { FileEntry } from '../../../../shared/types'
import styles from './ExplorerPanel.module.css'

interface ContextMenu {
  x: number
  y: number
  entry: FileEntry
}

const ICON_MAP: Record<string, string> = {
  '.py': '🐍', '.pyw': '🐍', '.ipynb': '📓',
  '.js': '📜', '.ts': '📘', '.jsx': '⚛️', '.tsx': '⚛️',
  '.json': '🔧', '.md': '📝', '.css': '🎨', '.html': '🌐',
  '.txt': '📄', '.sh': '⚡', '.yml': '⚙️', '.yaml': '⚙️',
  '.toml': '⚙️', '.env': '🔐', '.gitignore': '📋'
}

function getFileIcon(entry: FileEntry): string {
  if (entry.isDirectory) return '📁'
  const ext = entry.extension || ''
  return ICON_MAP[ext] || '📄'
}

interface FileTreeNodeProps {
  entry: FileEntry
  depth: number
  onOpen: (entry: FileEntry) => void
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ entry, depth, onOpen, onContextMenu }) => {
  const { expandedPaths, selectedPath, toggleExpanded, setSelected } = useExplorerStore()
  const isExpanded = expandedPaths.has(entry.path)
  const isSelected = selectedPath === entry.path

  const handleClick = () => {
    setSelected(entry.path)
    if (entry.isDirectory) {
      toggleExpanded(entry.path)
    } else {
      onOpen(entry)
    }
  }

  return (
    <div>
      <div
        className={`${styles.treeNode} ${isSelected ? styles.selected : ''}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, entry)}
        title={entry.path}
      >
        {entry.isDirectory && (
          <span className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`}>
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
        {!entry.isDirectory && <span className={styles.noChevron} />}
        <span className={styles.fileIcon}>{getFileIcon(entry)}</span>
        <span className={styles.fileName}>{entry.name}</span>
      </div>

      {entry.isDirectory && isExpanded && entry.children && (
        <div>
          {entry.children.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              onOpen={onOpen}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const ExplorerPanel: React.FC = () => {
  const { fileTree, projectRoot, isLoading, refreshTree, createFile, createDir, deleteEntry, renameEntry } = useExplorerStore()
  const { openFile } = useEditorStore()
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [creating, setCreating] = useState<{ parentPath: string; type: 'file' | 'folder' } | null>(null)
  const [newName, setNewName] = useState('')
  const createInputRef = useRef<HTMLInputElement>(null)

  const handleOpen = useCallback(async (entry: FileEntry) => {
    if (entry.isDirectory) return
    try {
      const content = await window.zeus.fs.readFile(entry.path)
      openFile(entry.path, content, '')
    } catch (err) {
      console.error('[Explorer] Failed to open file:', err)
    }
  }, [openFile])

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, entry })
  }, [])

  const closeContextMenu = () => setContextMenu(null)

  const startCreate = (parentPath: string, type: 'file' | 'folder') => {
    setCreating({ parentPath, type })
    setNewName('')
    closeContextMenu()
    setTimeout(() => createInputRef.current?.focus(), 50)
  }

  const handleCreateSubmit = async () => {
    if (!creating || !newName.trim()) {
      setCreating(null)
      return
    }
    if (creating.type === 'file') {
      const path = await createFile(creating.parentPath, newName.trim())
      if (path) {
        const content = await window.zeus.fs.readFile(path).catch(() => '')
        openFile(path, content, '')
      }
    } else {
      await createDir(creating.parentPath, newName.trim())
    }
    setCreating(null)
  }

  const handleDelete = async () => {
    if (!contextMenu) return
    const confirmed = confirm(`Delete "${contextMenu.entry.name}"?`)
    if (confirmed) {
      await deleteEntry(contextMenu.entry.path)
    }
    closeContextMenu()
  }

  const handleRename = async () => {
    if (!contextMenu) return
    const newNameInput = prompt('New name:', contextMenu.entry.name)
    if (newNameInput && newNameInput !== contextMenu.entry.name) {
      await renameEntry(contextMenu.entry.path, newNameInput)
    }
    closeContextMenu()
  }

  return (
    <div className={styles.panel} onClick={closeContextMenu}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>EXPLORER</span>
        <div className={styles.headerActions}>
          <button
            className="icon-btn"
            onClick={() => startCreate(projectRoot!, 'file')}
            title="New File"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="12" y1="12" x2="12" y2="18" /><line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </button>
          <button
            className="icon-btn"
            onClick={() => startCreate(projectRoot!, 'folder')}
            title="New Folder"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
            </svg>
          </button>
          <button className="icon-btn" onClick={refreshTree} title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>

      {/* Project name */}
      <div className={styles.projectName}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7a2 2 0 0 1 2-2h4.586a1 1 0 0 1 .707.293l1.414 1.414A1 1 0 0 0 12.414 7H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
        </svg>
        <span>{projectRoot?.split(/[/\\]/).pop() || 'Project'}</span>
      </div>

      {/* File tree */}
      <div className={styles.treeContainer}>
        {isLoading ? (
          <div className={styles.loading}>
            <div className="spinner" />
            <span>Loading...</span>
          </div>
        ) : (
          <>
            {/* New item input */}
            {creating && (
              <div className={styles.createInput} style={{ paddingLeft: '20px' }}>
                <span>{creating.type === 'file' ? '📄' : '📁'}</span>
                <input
                  ref={createInputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateSubmit()
                    if (e.key === 'Escape') setCreating(null)
                  }}
                  onBlur={handleCreateSubmit}
                  placeholder={`New ${creating.type}...`}
                  className={styles.nameInput}
                />
              </div>
            )}

            {fileTree.map((entry) => (
              <FileTreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                onOpen={handleOpen}
                onContextMenu={handleContextMenu}
              />
            ))}
          </>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.entry.isDirectory && (
            <>
              <div className="context-menu-item" onClick={() => startCreate(contextMenu.entry.path, 'file')}>
                📄 New File
              </div>
              <div className="context-menu-item" onClick={() => startCreate(contextMenu.entry.path, 'folder')}>
                📁 New Folder
              </div>
              <div className="context-menu-separator" />
            </>
          )}
          <div className="context-menu-item" onClick={handleRename}>
            ✏️ Rename
          </div>
          <div className="context-menu-separator" />
          <div className="context-menu-item danger" onClick={handleDelete}>
            🗑️ Delete
          </div>
        </div>
      )}
    </div>
  )
}

export default ExplorerPanel
