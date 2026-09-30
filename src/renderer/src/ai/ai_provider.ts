// ============================================================
// ZEUS AI PROVIDER
// ============================================================
// This is the ONLY file in the entire ZEUS application that
// contains AI/API/LLM integration code.
//
// ALL other components call only the generic functions exported
// at the bottom of this file. Nothing else in ZEUS knows which
// provider is active.
//
// TO SWITCH PROVIDERS:
//   1. Comment/uncomment the implementation sections below.
//   2. Save the file.
//   3. Nothing else needs to change.
// ============================================================

// ============================================================
// GENERIC INTERFACE
// ============================================================

export interface AIContext {
  code?: string
  language?: string
  filePath?: string
  cursorLine?: number
  surroundingCode?: string
  diagnostics?: string[]
  projectRoot?: string
}

export interface AICompletionResult {
  completion: string
  confidence?: number
}

export interface AICodeResult {
  result: string
  explanation?: string
  diff?: { before: string; after: string }
}

export interface AIExplanation {
  explanation: string
  keyPoints: string[]
}

export interface AIChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIChatResult {
  message: string
  tokensUsed?: number
}

export interface AITestResult {
  tests: string
  framework: string
  coverage?: string[]
}

export interface AIDocResult {
  documentation: string
  format: 'docstring' | 'markdown'
}

// ============================================================
// API IMPLEMENTATION
// ============================================================
// Uses an external HTTP API (OpenAI-compatible format).
// Set API_BASE_URL and API_KEY to configure.
//
// To use this implementation:
//   - Ensure the code below is NOT commented out.
//   - Comment out the LOCAL LLM IMPLEMENTATION section.
// ============================================================

interface ApiConfig {
  baseUrl: string
  apiKey: string
  model: string
  maxTokens: number
  temperature: number
}

const API_CONFIG: ApiConfig = {
  // Replace with your API endpoint and key.
  // Supports any OpenAI-compatible API (OpenAI, Together, Groq, Ollama with openai compat, etc.)
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',           // ← Set your API key here or load from secure storage
  model: 'gpt-4o-mini', // ← Change model name here
  maxTokens: 2048,
  temperature: 0.2
}

interface ApiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function callApi(messages: ApiMessage[], maxTokens?: number): Promise<string> {
  if (!API_CONFIG.apiKey) {
    throw new Error('AI API key not configured. Set apiKey in src/renderer/src/ai/ai_provider.ts')
  }

  const response = await fetch(`${API_CONFIG.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_CONFIG.apiKey}`
    },
    body: JSON.stringify({
      model: API_CONFIG.model,
      messages,
      max_tokens: maxTokens ?? API_CONFIG.maxTokens,
      temperature: API_CONFIG.temperature
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`API error ${response.status}: ${err}`)
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>
  }
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

// ── API Implementation Functions ──────────────────────────────

async function apiGenerateCompletion(context: AIContext): Promise<AICompletionResult> {
  const system = `You are an expert Python code completion assistant.
Complete the Python code naturally and concisely.
Return ONLY the completion code, nothing else — no markdown, no explanation.`

  const user = `Language: ${context.language || 'python'}
Code so far:
\`\`\`python
${context.surroundingCode || context.code || ''}
\`\`\`

Complete from the cursor position. Return only the completion text.`

  const completion = await callApi([
    { role: 'system', content: system },
    { role: 'user', content: user }
  ], 512)

  return { completion }
}

async function apiCorrectCode(context: AIContext): Promise<AICodeResult> {
  const system = `You are an expert Python code reviewer.
Identify and fix bugs, errors, and issues in the provided code.
Return JSON: { "result": "<corrected code>", "explanation": "<brief explanation>" }`

  const diagContext = context.diagnostics?.length
    ? `\nDiagnostics:\n${context.diagnostics.join('\n')}`
    : ''

  const user = `Fix this Python code:${diagContext}
\`\`\`python
${context.code}
\`\`\``

  const raw = await callApi([
    { role: 'system', content: system },
    { role: 'user', content: user }
  ])

  try {
    const parsed = JSON.parse(raw) as { result: string; explanation: string }
    return {
      result: parsed.result,
      explanation: parsed.explanation,
      diff: { before: context.code || '', after: parsed.result }
    }
  } catch {
    return { result: raw, diff: { before: context.code || '', after: raw } }
  }
}

async function apiOptimizeCode(context: AIContext): Promise<AICodeResult> {
  const system = `You are a Python performance and readability expert.
Optimize the code for readability, maintainability, and efficiency.
Return JSON: { "result": "<optimized code>", "explanation": "<what was improved and why>" }`

  const user = `Optimize this Python code:
\`\`\`python
${context.code}
\`\`\``

  const raw = await callApi([
    { role: 'system', content: system },
    { role: 'user', content: user }
  ])

  try {
    const parsed = JSON.parse(raw) as { result: string; explanation: string }
    return {
      result: parsed.result,
      explanation: parsed.explanation,
      diff: { before: context.code || '', after: parsed.result }
    }
  } catch {
    return { result: raw, diff: { before: context.code || '', after: raw } }
  }
}

async function apiExplainCode(context: AIContext): Promise<AIExplanation> {
  const system = `You are a Python code educator.
Explain the provided code clearly and concisely.
Return JSON: { "explanation": "<clear explanation>", "keyPoints": ["<point1>", "<point2>"] }`

  const user = `Explain this Python code:
\`\`\`python
${context.code}
\`\`\``

  const raw = await callApi([
    { role: 'system', content: system },
    { role: 'user', content: user }
  ])

  try {
    return JSON.parse(raw) as AIExplanation
  } catch {
    return { explanation: raw, keyPoints: [] }
  }
}

async function apiRefactorCode(context: AIContext): Promise<AICodeResult> {
  const system = `You are a Python refactoring expert.
Refactor the code to improve structure, reduce duplication, and follow Python best practices.
Return JSON: { "result": "<refactored code>", "explanation": "<what was refactored>" }`

  const user = `Refactor this Python code:
\`\`\`python
${context.code}
\`\`\``

  const raw = await callApi([
    { role: 'system', content: system },
    { role: 'user', content: user }
  ])

  try {
    const parsed = JSON.parse(raw) as { result: string; explanation: string }
    return {
      result: parsed.result,
      explanation: parsed.explanation,
      diff: { before: context.code || '', after: parsed.result }
    }
  } catch {
    return { result: raw, diff: { before: context.code || '', after: raw } }
  }
}

async function apiGenerateTests(context: AIContext): Promise<AITestResult> {
  const system = `You are a Python testing expert.
Generate comprehensive pytest tests for the provided code.
Return JSON: { "tests": "<test code>", "framework": "pytest", "coverage": ["<function1>", "<function2>"] }`

  const user = `Generate tests for this Python code:
\`\`\`python
${context.code}
\`\`\``

  const raw = await callApi([
    { role: 'system', content: system },
    { role: 'user', content: user }
  ])

  try {
    return JSON.parse(raw) as AITestResult
  } catch {
    return { tests: raw, framework: 'pytest', coverage: [] }
  }
}

async function apiGenerateDocumentation(context: AIContext): Promise<AIDocResult> {
  const system = `You are a Python documentation expert.
Generate clear, accurate Google-style docstrings for the provided code.
Return JSON: { "documentation": "<code with added docstrings>", "format": "docstring" }`

  const user = `Add docstrings to this Python code:
\`\`\`python
${context.code}
\`\`\``

  const raw = await callApi([
    { role: 'system', content: system },
    { role: 'user', content: user }
  ])

  try {
    return JSON.parse(raw) as AIDocResult
  } catch {
    return { documentation: raw, format: 'docstring' }
  }
}

async function apiChat(messages: AIChatMessage[]): Promise<AIChatResult> {
  const apiMessages: ApiMessage[] = [
    {
      role: 'system',
      content: 'You are ZEUS AI, a helpful Python programming assistant. Be concise and practical.'
    },
    ...messages.map((m) => ({ role: m.role as ApiMessage['role'], content: m.content }))
  ]

  const message = await callApi(apiMessages)
  return { message }
}

// ============================================================
// LOCAL LLM IMPLEMENTATION
// ============================================================
// Uses a locally running LLM via an HTTP endpoint.
// Compatible with: Ollama, llama.cpp server, LM Studio, etc.
//
// To use this implementation:
//   - Comment out the API IMPLEMENTATION section above.
//   - Uncomment the code below.
//   - Start your local LLM server.
// ============================================================

// interface LocalLLMConfig {
//   baseUrl: string    // e.g. 'http://localhost:11434' for Ollama
//   model: string      // e.g. 'codellama', 'deepseek-coder', 'phi3'
//   maxTokens: number
//   temperature: number
// }
//
// const LOCAL_LLM_CONFIG: LocalLLMConfig = {
//   baseUrl: 'http://localhost:11434',   // ← Ollama default
//   model: 'codellama',                  // ← Change to your local model
//   maxTokens: 2048,
//   temperature: 0.2
// }
//
// async function callLocalLLM(prompt: string, system?: string): Promise<string> {
//   // Ollama /api/generate endpoint
//   const response = await fetch(`${LOCAL_LLM_CONFIG.baseUrl}/api/generate`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       model: LOCAL_LLM_CONFIG.model,
//       prompt: system ? `${system}\n\n${prompt}` : prompt,
//       stream: false,
//       options: {
//         temperature: LOCAL_LLM_CONFIG.temperature,
//         num_predict: LOCAL_LLM_CONFIG.maxTokens
//       }
//     })
//   })
//
//   if (!response.ok) {
//     throw new Error(`Local LLM error ${response.status}`)
//   }
//
//   const data = await response.json() as { response: string }
//   return data.response?.trim() ?? ''
// }
//
// async function llmGenerateCompletion(context: AIContext): Promise<AICompletionResult> {
//   const prompt = `Complete this Python code:\n\`\`\`python\n${context.surroundingCode || context.code}\n\`\`\`\nCompletion only:`
//   const completion = await callLocalLLM(prompt, 'You are a Python code completion AI. Return only code.')
//   return { completion }
// }
//
// async function llmCorrectCode(context: AIContext): Promise<AICodeResult> {
//   const prompt = `Fix this Python code:\n\`\`\`python\n${context.code}\n\`\`\`\nReturn fixed code in JSON: {"result":"<code>","explanation":"<why>"}`
//   const raw = await callLocalLLM(prompt, 'You are a Python code correction AI. Return valid JSON only.')
//   try {
//     const p = JSON.parse(raw) as { result: string; explanation: string }
//     return { result: p.result, explanation: p.explanation, diff: { before: context.code || '', after: p.result } }
//   } catch {
//     return { result: raw, diff: { before: context.code || '', after: raw } }
//   }
// }
//
// async function llmOptimizeCode(context: AIContext): Promise<AICodeResult> {
//   const prompt = `Optimize this Python code:\n\`\`\`python\n${context.code}\n\`\`\`\nReturn JSON: {"result":"<code>","explanation":"<improvements>"}`
//   const raw = await callLocalLLM(prompt, 'You are a Python optimization AI. Return valid JSON only.')
//   try {
//     const p = JSON.parse(raw) as { result: string; explanation: string }
//     return { result: p.result, explanation: p.explanation, diff: { before: context.code || '', after: p.result } }
//   } catch {
//     return { result: raw, diff: { before: context.code || '', after: raw } }
//   }
// }
//
// async function llmExplainCode(context: AIContext): Promise<AIExplanation> {
//   const prompt = `Explain this Python code:\n\`\`\`python\n${context.code}\n\`\`\`\nReturn JSON: {"explanation":"<text>","keyPoints":["<p1>","<p2>"]}`
//   const raw = await callLocalLLM(prompt, 'You are a Python code explainer AI. Return valid JSON only.')
//   try {
//     return JSON.parse(raw) as AIExplanation
//   } catch {
//     return { explanation: raw, keyPoints: [] }
//   }
// }
//
// async function llmRefactorCode(context: AIContext): Promise<AICodeResult> {
//   const prompt = `Refactor this Python code:\n\`\`\`python\n${context.code}\n\`\`\`\nReturn JSON: {"result":"<code>","explanation":"<changes>"}`
//   const raw = await callLocalLLM(prompt, 'You are a Python refactoring AI. Return valid JSON only.')
//   try {
//     const p = JSON.parse(raw) as { result: string; explanation: string }
//     return { result: p.result, explanation: p.explanation, diff: { before: context.code || '', after: p.result } }
//   } catch {
//     return { result: raw, diff: { before: context.code || '', after: raw } }
//   }
// }
//
// async function llmGenerateTests(context: AIContext): Promise<AITestResult> {
//   const prompt = `Generate pytest tests for:\n\`\`\`python\n${context.code}\n\`\`\`\nReturn JSON: {"tests":"<code>","framework":"pytest","coverage":["<fn1>"]}`
//   const raw = await callLocalLLM(prompt, 'You are a Python testing AI. Return valid JSON only.')
//   try {
//     return JSON.parse(raw) as AITestResult
//   } catch {
//     return { tests: raw, framework: 'pytest' }
//   }
// }
//
// async function llmGenerateDocumentation(context: AIContext): Promise<AIDocResult> {
//   const prompt = `Add Google-style docstrings to:\n\`\`\`python\n${context.code}\n\`\`\`\nReturn JSON: {"documentation":"<code with docstrings>","format":"docstring"}`
//   const raw = await callLocalLLM(prompt, 'You are a Python documentation AI. Return valid JSON only.')
//   try {
//     return JSON.parse(raw) as AIDocResult
//   } catch {
//     return { documentation: raw, format: 'docstring' }
//   }
// }
//
// async function llmChat(messages: AIChatMessage[]): Promise<AIChatResult> {
//   const lastMsg = messages[messages.length - 1]?.content || ''
//   const history = messages.slice(0, -1).map((m) => `${m.role}: ${m.content}`).join('\n')
//   const prompt = history ? `${history}\nuser: ${lastMsg}\nassistant:` : lastMsg
//   const message = await callLocalLLM(prompt, 'You are ZEUS AI, a Python programming assistant.')
//   return { message }
// }

// ============================================================
// ACTIVE IMPLEMENTATION
// ============================================================
// This section selects which implementation is currently used.
// To switch:
//   - Change the function references below.
//   - The rest of the application is unaffected.
// ============================================================

const activeGenerateCompletion = apiGenerateCompletion
const activeCorrectCode        = apiCorrectCode
const activeOptimizeCode       = apiOptimizeCode
const activeExplainCode        = apiExplainCode
const activeRefactorCode       = apiRefactorCode
const activeGenerateTests      = apiGenerateTests
const activeGenerateDoc        = apiGenerateDocumentation
const activeChat               = apiChat

// If using local LLM, replace with:
// const activeGenerateCompletion = llmGenerateCompletion
// const activeCorrectCode        = llmCorrectCode
// const activeOptimizeCode       = llmOptimizeCode
// const activeExplainCode        = llmExplainCode
// const activeRefactorCode       = llmRefactorCode
// const activeGenerateTests      = llmGenerateTests
// const activeGenerateDoc        = llmGenerateDocumentation
// const activeChat               = llmChat

// ============================================================
// NORMALIZATION / RESPONSE PROCESSING
// ============================================================

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:python|py)?\n?/gm, '')
    .replace(/^```\n?/gm, '')
    .trim()
}

function sanitizeContext(context: AIContext): AIContext {
  // Never include sensitive patterns in AI context
  const EXCLUDED_PATTERNS = [
    /password\s*=\s*.+/gi,
    /secret\s*=\s*.+/gi,
    /api[_-]?key\s*=\s*.+/gi,
    /token\s*=\s*.+/gi,
    /credentials?\s*=\s*.+/gi
  ]

  let code = context.code || ''
  for (const pattern of EXCLUDED_PATTERNS) {
    code = code.replace(pattern, '# [REDACTED]')
  }

  return { ...context, code }
}

// ============================================================
// PUBLIC API (what the rest of ZEUS calls)
// ============================================================
// These are the ONLY AI functions the application uses.
// No component imports anything else from this file.
// ============================================================

export const aiProvider = {
  /**
   * Generate inline code completion (ghost text).
   * Debounced by the caller; this function does the actual call.
   */
  generateCompletion: async (context: AIContext): Promise<AICompletionResult> => {
    const safe = sanitizeContext(context)
    const result = await activeGenerateCompletion(safe)
    return { ...result, completion: stripMarkdownFences(result.completion) }
  },

  /**
   * Detect and fix code errors.
   * Always shows diff before applying.
   */
  correctCode: async (context: AIContext): Promise<AICodeResult> => {
    const safe = sanitizeContext(context)
    const result = await activeCorrectCode(safe)
    return { ...result, result: stripMarkdownFences(result.result) }
  },

  /**
   * Optimize code for readability, performance, and pythonic style.
   * Always shows diff before applying.
   */
  optimizeCode: async (context: AIContext): Promise<AICodeResult> => {
    const safe = sanitizeContext(context)
    const result = await activeOptimizeCode(safe)
    return { ...result, result: stripMarkdownFences(result.result) }
  },

  /**
   * Explain what a code selection does.
   */
  explainCode: async (context: AIContext): Promise<AIExplanation> => {
    const safe = sanitizeContext(context)
    return activeExplainCode(safe)
  },

  /**
   * Refactor code structure without changing behavior.
   * Always shows diff before applying.
   */
  refactorCode: async (context: AIContext): Promise<AICodeResult> => {
    const safe = sanitizeContext(context)
    const result = await activeRefactorCode(safe)
    return { ...result, result: stripMarkdownFences(result.result) }
  },

  /**
   * Generate pytest tests for the selected code.
   */
  generateTests: async (context: AIContext): Promise<AITestResult> => {
    const safe = sanitizeContext(context)
    const result = await activeGenerateTests(safe)
    return { ...result, tests: stripMarkdownFences(result.tests) }
  },

  /**
   * Generate docstrings / documentation for code.
   */
  generateDocumentation: async (context: AIContext): Promise<AIDocResult> => {
    const safe = sanitizeContext(context)
    const result = await activeGenerateDoc(safe)
    return { ...result, documentation: stripMarkdownFences(result.documentation) }
  },

  /**
   * Chat with the AI about Python code.
   */
  chat: async (messages: AIChatMessage[]): Promise<AIChatResult> => {
    return activeChat(messages)
  },

  /**
   * Check if AI is configured and available.
   * Returns false if no API key is set or local model is unreachable.
   */
  isAvailable: async (): Promise<boolean> => {
    try {
      // API mode: check if key is set
      if (API_CONFIG.apiKey) {
        return true
      }
      // Local LLM mode: check if server responds
      // Uncomment when using local LLM:
      // const res = await fetch(`${LOCAL_LLM_CONFIG.baseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) })
      // return res.ok
      return false
    } catch {
      return false
    }
  }
} as const

export type AIProvider = typeof aiProvider
