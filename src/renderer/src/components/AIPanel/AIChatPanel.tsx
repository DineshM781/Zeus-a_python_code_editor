// ============================================================
// ZEUS — AI Chat Panel
// ============================================================

import React, { useState, useRef, useEffect } from 'react'
import { aiProvider, AIChatMessage } from '../../ai/ai_provider'
import styles from './AIChatPanel.module.css'

interface Props {
  onClose: () => void
}

const AIChatPanel: React.FC<Props> = ({ onClose }) => {
  const [messages, setMessages] = useState<AIChatMessage[]>([{
    role: 'assistant',
    content: "Hi! I'm ZEUS AI. I can help you with Python code — ask me anything about debugging, algorithms, libraries, or best practices."
  }])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!input.trim() || isLoading) return

    const userMsg: AIChatMessage = { role: 'user', content: input }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const result = await aiProvider.chat([...messages, userMsg])
      setMessages((prev) => [...prev, { role: 'assistant', content: result.message }])
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'AI unavailable'}. Please check your configuration in ai_provider.ts`
      }])
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.aiChip}>⚡ AI</span>
            <span className={styles.title}>Python Chat</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.messages}>
          {messages.map((msg, i) => (
            <div key={i} className={`${styles.message} ${msg.role === 'user' ? styles.user : styles.assistant}`}>
              <div className={styles.messageBubble}>
                <pre className={styles.messageText}>{msg.content}</pre>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className={`${styles.message} ${styles.assistant}`}>
              <div className={styles.messageBubble}>
                <div className={styles.typingDots}>
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className={styles.inputArea}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about Python... (Enter to send, Shift+Enter for newline)"
            className={styles.input}
            rows={3}
          />
          <button
            className={styles.sendBtn}
            onClick={send}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? <div className={styles.spinner} /> : '↑'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AIChatPanel
