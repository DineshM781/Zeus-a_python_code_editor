// ============================================================
// ZEUS — AI Action Bar
// ============================================================
// The ONE place in the UI that triggers AI features.
// All calls go through aiProvider — never to a specific API.
// ============================================================

import React, { useState, useRef, MutableRefObject } from 'react'
import * as monaco from 'monaco-editor'
import { aiProvider } from '../../ai/ai_provider'
import { useSettingsStore } from '../../stores/settingsStore'
import { useEditorStore } from '../../stores/editorStore'
import AIDiffModal from './AIDiffModal'
import AIExplainModal from './AIExplainModal'
import AIChatPanel from './AIChatPanel'
import styles from './AIActionBar.module.css'

interface Props {
  editorRef: MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>
  filePath: string
  language: string
}

type AIAction = 'correct' | 'optimize' | 'explain' | 'refactor' | 'tests' | 'docs' | 'chat'

interface DiffResult {
  before: string
  after: string
  explanation?: string
  action: AIAction
}

const AIActionBar: React.FC<Props> = ({ editorRef, filePath, language }) => {
  const { settings } = useSettingsStore()
  const { getActiveTab } = useEditorStore()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLoading, setIsLoading] = useState<AIAction | null>(null)
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null)
  const [explainResult, setExplainResult] = useState<{ explanation: string; keyPoints: string[] } | null>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  if (!settings.ai.enabled) return null

  const getContext = () => {
    const editor = editorRef.current
    if (!editor) return { code: '', selection: '' }

    const selection = editor.getSelection()
    const model = editor.getModel()
    if (!model) return { code: '', selection: '' }

    const selectedText = selection ? model.getValueInRange(selection) : ''
    const fullCode = model.getValue()

    return {
      code: selectedText || fullCode,
      selection: selectedText,
      fullCode
    }
  }

  const applyResult = (result: string) => {
    const editor = editorRef.current
    if (!editor) return

    const selection = editor.getSelection()
    const model = editor.getModel()
    if (!model) return

    if (selection && !selection.isEmpty()) {
      // Replace selection
      editor.executeEdits('ai-apply', [{
        range: selection,
        text: result
      }])
    } else {
      // Replace entire file content
      const fullRange = model.getFullModelRange()
      editor.executeEdits('ai-apply', [{
        range: fullRange,
        text: result
      }])
    }
  }

  const runAction = async (action: AIAction) => {
    setIsMenuOpen(false)
    setAiError(null)

    if (action === 'chat') {
      setIsChatOpen(true)
      return
    }

    const { code } = getContext()
    if (!code.trim()) {
      setAiError('No code to process. Select some code or open a file.')
      return
    }

    setIsLoading(action)

    try {
      const ctx = { code, language, filePath }

      switch (action) {
        case 'correct': {
          const result = await aiProvider.correctCode(ctx)
          setDiffResult({ before: code, after: result.result, explanation: result.explanation, action })
          break
        }
        case 'optimize': {
          const result = await aiProvider.optimizeCode(ctx)
          setDiffResult({ before: code, after: result.result, explanation: result.explanation, action })
          break
        }
        case 'explain': {
          const result = await aiProvider.explainCode(ctx)
          setExplainResult(result)
          break
        }
        case 'refactor': {
          const result = await aiProvider.refactorCode(ctx)
          setDiffResult({ before: code, after: result.result, explanation: result.explanation, action })
          break
        }
        case 'tests': {
          const result = await aiProvider.generateTests(ctx)
          setDiffResult({ before: '', after: result.tests, explanation: `Framework: ${result.framework}`, action })
          break
        }
        case 'docs': {
          const result = await aiProvider.generateDocumentation(ctx)
          setDiffResult({ before: code, after: result.documentation, explanation: 'Docstrings added', action })
          break
        }
      }
    } catch (err) {
      setAiError(
        err instanceof Error && err.message.includes('API key')
          ? 'AI not configured. Set your API key in src/renderer/src/ai/ai_provider.ts'
          : `AI error: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      setIsLoading(null)
    }
  }

  const actionLabel: Record<AIAction, string> = {
    correct: 'Correct Code',
    optimize: 'Optimize',
    explain: 'Explain',
    refactor: 'Refactor',
    tests: 'Generate Tests',
    docs: 'Generate Docs',
    chat: 'AI Chat'
  }

  const isAnyLoading = isLoading !== null

  return (
    <>
      <div className={styles.bar}>
        <div className={styles.aiButtonWrapper}>
          <button
            className={`${styles.aiButton} ${isAnyLoading ? styles.loading : ''}`}
            onClick={() => setIsMenuOpen((v) => !v)}
            disabled={isAnyLoading}
            title="AI Actions"
          >
            {isAnyLoading ? (
              <>
                <div className={styles.spinner} />
                <span>{actionLabel[isLoading!]}...</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                <span>AI</span>
                <svg width="10" height="10" viewBox="0 0 10 10" style={{ marginLeft: 2 }}>
                  <path d="M2 3l3 4 3-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                </svg>
              </>
            )}
          </button>

          {isMenuOpen && (
            <div className={styles.menu}>
              {(['correct', 'optimize', 'explain', 'refactor', 'tests', 'docs', 'chat'] as AIAction[]).map((action) => (
                <button
                  key={action}
                  className={styles.menuItem}
                  onClick={() => runAction(action)}
                >
                  {actionLabel[action]}
                </button>
              ))}
            </div>
          )}
        </div>

        {aiError && (
          <div className={styles.errorPill}>
            <span>⚠️ {aiError}</span>
            <button onClick={() => setAiError(null)}>×</button>
          </div>
        )}
      </div>

      {/* Diff modal — shown before applying AI results */}
      {diffResult && (
        <AIDiffModal
          before={diffResult.before}
          after={diffResult.after}
          explanation={diffResult.explanation}
          action={diffResult.action}
          onApply={() => {
            applyResult(diffResult.after)
            setDiffResult(null)
          }}
          onReject={() => setDiffResult(null)}
        />
      )}

      {/* Explain modal */}
      {explainResult && (
        <AIExplainModal
          explanation={explainResult.explanation}
          keyPoints={explainResult.keyPoints}
          onClose={() => setExplainResult(null)}
        />
      )}

      {/* Chat panel */}
      {isChatOpen && (
        <AIChatPanel onClose={() => setIsChatOpen(false)} />
      )}
    </>
  )
}

export default AIActionBar
