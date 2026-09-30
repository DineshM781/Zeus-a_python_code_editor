// ============================================================
// ZEUS — Search Panel
// ============================================================

import React, { useState, useCallback } from 'react'
import { useExplorerStore } from '../../stores/explorerStore'
import { useEditorStore } from '../../stores/editorStore'
import styles from './SearchPanel.module.css'

interface SearchResult {
  filePath: string
  fileName: string
  line: number
  column: number
  text: string
  match: string
}

const SearchPanel: React.FC = () => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [searchCount, setSearchCount] = useState(0)
  const { projectRoot, fileTree } = useExplorerStore()
  const { openFile } = useEditorStore()

  const getAllFiles = (entries: typeof fileTree): string[] => {
    const files: string[] = []
    const walk = (items: typeof fileTree) => {
      for (const item of items) {
        if (!item.isDirectory) {
          const ext = item.extension || ''
          if (['.py', '.pyw', '.ipynb', '.md', '.json', '.txt', '.yaml', '.yml', '.toml'].includes(ext)) {
            files.push(item.path)
          }
        }
        if (item.children) walk(item.children)
      }
    }
    walk(entries)
    return files
  }

  const search = useCallback(async () => {
    if (!query.trim() || !projectRoot) return
    setIsSearching(true)
    setResults([])

    const files = getAllFiles(fileTree)
    const found: SearchResult[] = []
    const pattern = caseSensitive ? query : query.toLowerCase()

    for (const filePath of files) {
      try {
        const content = await window.zeus.fs.readFile(filePath)
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const searchLine = caseSensitive ? line : line.toLowerCase()
          const col = searchLine.indexOf(pattern)
          if (col !== -1) {
            found.push({
              filePath,
              fileName: filePath.split(/[/\\]/).pop() || filePath,
              line: i + 1,
              column: col + 1,
              text: line.trim(),
              match: query
            })
          }
        }
      } catch { /* skip unreadable files */ }
    }

    setResults(found.slice(0, 500)) // Cap at 500 results
    setSearchCount(found.length)
    setIsSearching(false)
  }, [query, projectRoot, fileTree, caseSensitive])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') search()
  }

  const openResult = async (result: SearchResult) => {
    try {
      const content = await window.zeus.fs.readFile(result.filePath)
      openFile(result.filePath, content, '')
      // TODO: Jump cursor to result.line, result.column
    } catch { /* ignore */ }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>SEARCH</span>
      </div>

      <div className={styles.searchBar}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search in project..."
          className={styles.searchInput}
          autoFocus
        />
        <div className={styles.searchOptions}>
          <button
            className={`${styles.optBtn} ${caseSensitive ? styles.active : ''}`}
            onClick={() => setCaseSensitive((v) => !v)}
            title="Case Sensitive"
          >Aa</button>
          <button
            className={styles.searchBtn}
            onClick={search}
            disabled={isSearching || !query.trim()}
          >
            {isSearching ? '...' : '🔍'}
          </button>
        </div>
      </div>

      {searchCount > 500 && (
        <div className={styles.tooMany}>Showing 500 of {searchCount} results</div>
      )}

      <div className={styles.results}>
        {results.length === 0 && !isSearching && query && (
          <div className={styles.noResults}>No results found</div>
        )}
        {results.map((r, i) => (
          <div key={i} className={styles.result} onClick={() => openResult(r)}>
            <div className={styles.resultFile}>
              {r.fileName}
              <span className={styles.resultLine}>:{r.line}</span>
            </div>
            <div className={styles.resultText}>
              {r.text.slice(0, 80)}
              {r.text.length > 80 && '...'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SearchPanel
