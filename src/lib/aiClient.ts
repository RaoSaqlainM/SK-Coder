import type { AIKeyStatus, AIChatMessage } from "../types/ide"

type AIResponse = { content: string; error?: string }

function detectEndpoint(key: string, customEndpoint: string): { endpoint: string; type: "gemini" | "openai" } {
  if (customEndpoint.trim()) {
    const ep = customEndpoint.trim().replace(/\/$/, "")
    if (ep.includes("generativelanguage.googleapis.com")) return { endpoint: ep, type: "gemini" }
    return { endpoint: ep, type: "openai" }
  }
  if (key.startsWith("AIza")) return { endpoint: "gemini", type: "gemini" }
  if (key.startsWith("gsk_")) return { endpoint: "https://api.groq.com/openai/v1", type: "openai" }
  if (key.startsWith("sk-or-")) return { endpoint: "https://openrouter.ai/api/v1", type: "openai" }
  if (key.startsWith("sk-ant-")) return { endpoint: "https://api.anthropic.com/v1", type: "openai" }
  if (key.startsWith("sk-")) return { endpoint: "https://api.openai.com/v1", type: "openai" }
  return { endpoint: "https://api.openai.com/v1", type: "openai" }
}

function detectModel(key: string, customModel: string): string {
  if (customModel.trim()) return customModel.trim()
  if (key.startsWith("AIza")) return "gemini-2.0-flash"
  if (key.startsWith("gsk_")) return "llama-3.3-70b-versatile"
  if (key.startsWith("sk-or-")) return "openai/gpt-4o-mini"
  if (key.startsWith("sk-ant-")) return "claude-3-haiku-20240307"
  return "gpt-4o-mini"
}

async function callGemini(key: string, model: string, messages: AIChatMessage[], systemPrompt: string): Promise<AIResponse> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }))
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        }),
      }
    )
    if (res.status === 400 || res.status === 401 || res.status === 403) return { content: "", error: "invalid_key" }
    if (res.status === 429) return { content: "", error: "expired" }
    if (!res.ok) return { content: "", error: `error_${res.status}` }
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
    return { content: text }
  } catch {
    return { content: "", error: "network_error" }
  }
}

async function callOpenAICompat(
  key: string,
  endpoint: string,
  model: string,
  messages: AIChatMessage[],
  systemPrompt: string
): Promise<AIResponse> {
  try {
    const res = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://skcoder.app",
        "X-Title": "SK Coder",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    })
    if (res.status === 401 || res.status === 403) return { content: "", error: "invalid_key" }
    if (res.status === 429) return { content: "", error: "expired" }
    if (!res.ok) return { content: "", error: `error_${res.status}` }
    const data = await res.json()
    return { content: data?.choices?.[0]?.message?.content || "" }
  } catch {
    return { content: "", error: "network_error" }
  }
}

export async function validateAPIKey(
  key: string,
  customEndpoint: string,
  customModel: string
): Promise<AIKeyStatus> {
  if (!key.trim()) return "none"
  const { endpoint, type } = detectEndpoint(key, customEndpoint)
  const model = detectModel(key, customModel)
  const testMsg: AIChatMessage[] = [{ id: "t", role: "user", content: "Hi", timestamp: 0 }]
  let res: AIResponse
  try {
    if (type === "gemini") {
      res = await callGemini(key, model, testMsg, "You are a helpful assistant.")
    } else {
      res = await callOpenAICompat(key, endpoint, model, testMsg, "You are a helpful assistant.")
    }
    if (res.error === "invalid_key") return "invalid"
    if (res.error === "expired") return "expired"
    if (res.error === "network_error") return "invalid"
    if (res.error) return "invalid"
    return "valid"
  } catch {
    return "invalid"
  }
}

export async function sendAIMessage(opts: {
  key: string
  customEndpoint: string
  customModel: string
  messages: AIChatMessage[]
  systemPrompt: string
}): Promise<AIResponse> {
  const { key, customEndpoint, customModel, messages, systemPrompt } = opts
  const { endpoint, type } = detectEndpoint(key, customEndpoint)
  const model = detectModel(key, customModel)
  try {
    if (type === "gemini") return await callGemini(key, model, messages, systemPrompt)
    return await callOpenAICompat(key, endpoint, model, messages, systemPrompt)
  } catch (e) {
    return { content: "", error: String(e) }
  }
}

export function buildSystemPrompt(opts: {
  activeFilePath?: string
  activeFileContent?: string
  fileTree?: string[]
}): string {
  const { activeFilePath, activeFileContent, fileTree } = opts
  let prompt = `You are an expert coding assistant built into SK Coder IDE by Saqlain King. Help developers write, debug, explain, and improve code across all languages.

Guidelines:
- Give concise, accurate answers with working code examples
- Format code in markdown code blocks with language specified
- When fixing bugs, explain what was wrong and why the fix works
- Suggest best practices for the language/framework
- Be direct and technical`

  if (fileTree && fileTree.length > 0) {
    prompt += `\n\nProject files:\n${fileTree.slice(0, 30).join("\n")}`
  }
  if (activeFilePath) {
    prompt += `\n\nCurrently editing: ${activeFilePath}`
  }
  if (activeFileContent) {
    const preview = activeFileContent.slice(0, 2000)
    prompt += `\n\nFile content:\n\`\`\`\n${preview}${activeFileContent.length > 2000 ? "\n... (truncated)" : ""}\n\`\`\``
  }
  return prompt
}
