// ============================================================
// ZEUS — Notebook View (.ipynb)
// ============================================================

import React, { useState, useEffect, useRef } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useExplorerStore } from '../../stores/explorerStore'
import { aiProvider } from '../../ai/ai_provider'
import styles from './NotebookView.module.css'
import { v4 as uuid } from 'uuid'

interface NotebookCell {
  id: string
  cell_type: 'code' | 'markdown' | 'raw'
  source: string | string[]
  outputs: NotebookOutput[]
  execution_count: number | null
}

interface NotebookOutput {
  output_type: string
  text?: string | string[]
  data?: Record<string, string | string[]>
  traceback?: string[]
  ename?: string
  evalue?: string
}

interface NotebookData {
  nbformat: number
  cells: NotebookCell[]
  metadata?: Record<string, unknown>
}

function cellSource(cell: NotebookCell): string {
  return Array.isArray(cell.source) ? cell.source.join('') : cell.source
}

interface Props {
  tabId: string
  filePath: string
  content: string
}

const NotebookView: React.FC<Props> = ({ tabId, filePath, content }) => {
  const [notebook, setNotebook] = useState<NotebookData | null>(null)
  const [kernelId, setKernelId] = useState<string | null>(null)
  const [runningCells, setRunningCells] = useState<Set<string>>(new Set())
  const [parseError, setParseError] = useState<string | null>(null)
  const { updateContent, markSaved } = useEditorStore()
  const { settings } = useSettingsStore()
  const { projectRoot } = useExplorerStore()

  // Parse notebook
  useEffect(() => {
    try {
      const data = JSON.parse(content) as NotebookData
      // Ensure cells have IDs
      data.cells = data.cells.map((c) => ({ ...c, id: (c as any).id || uuid() }))
      setNotebook(data)
      setParseError(null)
    } catch (err) {
      setParseError(`Invalid notebook: ${err}`)
    }
  }, [])

  // Start kernel lazily
  useEffect(() => {
    if (!notebook || kernelId) return
    const startKernel = async () => {
      try {
        const result = await window.zeus.kernel.start(
          settings.python.interpreterPath,
          projectRoot || '.'
        )
        if ('id' in result) {
          setKernelId(result.id)
        }
      } catch {
        // Kernel start failed — cells still show but won't run
      }
    }
    startKernel()

    return () => {
      if (kernelId) window.zeus.kernel.stop(kernelId)
    }
  }, [notebook])

  // Listen for kernel output
  useEffect(() => {
    const unsub = window.zeus.kernel.onOutput((output) => {
      setNotebook((nb) => {
        if (!nb) return nb
        // Find cell with this executionId and update outputs
        const cells = nb.cells.map((cell) => {
          if ((cell as any).__executionId !== output.executionId) return cell

          const newOutput: NotebookOutput = {
            output_type: output.type,
            text: output.text,
            data: output.data as Record<string, string>,
            traceback: output.traceback,
            ename: output.ename,
            evalue: output.evalue
          }

          return {
            ...cell,
            outputs: [...cell.outputs, newOutput]
          }
        })
        return { ...nb, cells }
      })
    })
    return () => {
      unsub()
    }
  }, [])

  const saveNotebook = (nb: NotebookData) => {
    const json = JSON.stringify(nb, null, 2)
    updateContent(tabId, json)
    window.zeus.fs.writeFile(filePath, json).then(() => markSaved(tabId))
  }

  const updateCell = (id: string, source: string) => {
    setNotebook((nb) => {
      if (!nb) return nb
      const cells = nb.cells.map((c) => c.id === id ? { ...c, source } : c)
      const updated = { ...nb, cells }
      saveNotebook(updated)
      return updated
    })
  }

  const runCell = async (cell: NotebookCell) => {
    if (!kernelId) return
    const executionId = uuid()
    ;(cell as any).__executionId = executionId

    setRunningCells((s) => new Set(s).add(cell.id))
    // Clear previous outputs
    setNotebook((nb) => {
      if (!nb) return nb
      return {
        ...nb,
        cells: nb.cells.map((c) =>
          c.id === cell.id ? { ...c, outputs: [], __executionId: executionId } as any : c
        )
      }
    })

    await window.zeus.kernel.execute(
      executionId, kernelId, cellSource(cell),
      settings.python.interpreterPath,
      projectRoot || '.'
    )

    setRunningCells((s) => {
      const next = new Set(s)
      next.delete(cell.id)
      return next
    })
  }

  const addCell = (afterId: string, type: 'code' | 'markdown') => {
    setNotebook((nb) => {
      if (!nb) return nb
      const idx = nb.cells.findIndex((c) => c.id === afterId)
      const newCell: NotebookCell = {
        id: uuid(), cell_type: type, source: '',
        outputs: [], execution_count: null
      }
      const cells = [...nb.cells]
      cells.splice(idx + 1, 0, newCell)
      const updated = { ...nb, cells }
      saveNotebook(updated)
      return updated
    })
  }

  const deleteCell = (id: string) => {
    setNotebook((nb) => {
      if (!nb || nb.cells.length <= 1) return nb
      const cells = nb.cells.filter((c) => c.id !== id)
      const updated = { ...nb, cells }
      saveNotebook(updated)
      return updated
    })
  }

  const runAll = async () => {
    if (!notebook) return
    for (const cell of notebook.cells) {
      if (cell.cell_type === 'code') {
        await runCell(cell)
      }
    }
  }

  if (parseError) {
    return (
      <div className={styles.error}>
        <p>⚠️ {parseError}</p>
        <p>This file may not be a valid Jupyter notebook.</p>
      </div>
    )
  }

  if (!notebook) return <div className={styles.loading}><div className="spinner" /></div>

  return (
    <div className={styles.notebook}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <button className={styles.toolBtn} onClick={runAll} title="Run All Cells">
          ▶▶ Run All
        </button>
        <button
          className={styles.toolBtn}
          onClick={() => kernelId && window.zeus.kernel.interrupt(kernelId)}
          title="Interrupt Kernel"
        >
          ⏹ Interrupt
        </button>
        <button
          className={styles.toolBtn}
          onClick={() => kernelId && window.zeus.kernel.restart(kernelId, settings.python.interpreterPath, projectRoot || '.')}
          title="Restart Kernel"
        >
          ↺ Restart
        </button>
        <div className={styles.kernelStatus}>
          <span className={`${styles.kernelDot} ${kernelId ? styles.kernelReady : styles.kernelOff}`} />
          <span>{kernelId ? 'Python 3' : 'No Kernel'}</span>
        </div>
      </div>

      {/* Cells */}
      <div className={styles.cells}>
        {notebook.cells.map((cell, idx) => (
          <NotebookCellView
            key={cell.id}
            cell={cell}
            index={idx + 1}
            isRunning={runningCells.has(cell.id)}
            onRun={() => runCell(cell)}
            onChange={(src) => updateCell(cell.id, src)}
            onDelete={() => deleteCell(cell.id)}
            onAddCode={() => addCell(cell.id, 'code')}
            onAddMarkdown={() => addCell(cell.id, 'markdown')}
          />
        ))}
      </div>
    </div>
  )
}

// ── Individual Cell Component ────────────────────────────────

interface CellProps {
  cell: NotebookCell
  index: number
  isRunning: boolean
  onRun: () => void
  onChange: (source: string) => void
  onDelete: () => void
  onAddCode: () => void
  onAddMarkdown: () => void
}

const NotebookCellView: React.FC<CellProps> = ({
  cell, index, isRunning, onRun, onChange, onDelete, onAddCode, onAddMarkdown
}) => {
  const source = cellSource(cell)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const autoResize = () => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = `${ta.scrollHeight}px`
    }
  }

  useEffect(() => { autoResize() }, [source])

  return (
    <div className={`${styles.cell} ${isRunning ? styles.cellRunning : ''}`}>
      <div className={styles.cellGutter}>
        {cell.cell_type === 'code' ? (
          <button
            className={`${styles.runBtn} ${isRunning ? styles.running : ''}`}
            onClick={onRun}
            title="Run Cell"
          >
            {isRunning ? <div className={styles.miniSpinner} /> : '[' + (cell.execution_count ?? ' ') + ']'}
          </button>
        ) : (
          <span className={styles.markdownLabel}>M</span>
        )}
      </div>

      <div className={styles.cellContent}>
        <textarea
          ref={textareaRef}
          value={source}
          onChange={(e) => { onChange(e.target.value); autoResize() }}
          className={`${styles.cellInput} ${cell.cell_type === 'code' ? styles.codeInput : styles.markdownInput}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.shiftKey) {
              e.preventDefault()
              onRun()
            }
          }}
          placeholder={cell.cell_type === 'code' ? 'Python code...' : 'Markdown...'}
          spellCheck={cell.cell_type !== 'code'}
        />

        {/* Outputs */}
        {cell.outputs.length > 0 && (
          <div className={styles.outputs}>
            {cell.outputs.map((output, i) => (
              <div key={i} className={styles.output}>
                {output.output_type === 'error' ? (
                  <pre className={styles.errorOutput}>
                    {output.ename}: {output.evalue}
                    {output.traceback?.join('\n')}
                  </pre>
                ) : (
                  <pre className={styles.stdOutput}>
                    {output.text ? (Array.isArray(output.text) ? output.text.join('') : output.text) : ''}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cell actions */}
      <div className={styles.cellActions}>
        <button className={styles.cellActionBtn} onClick={onAddCode} title="Add Code Cell">+py</button>
        <button className={styles.cellActionBtn} onClick={onAddMarkdown} title="Add Markdown Cell">+md</button>
        <button className={`${styles.cellActionBtn} ${styles.deleteBtn}`} onClick={onDelete} title="Delete Cell">✕</button>
      </div>
    </div>
  )
}

export default NotebookView
