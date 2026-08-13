export type MemoryEntry = { role: "user" | "assistant"; content: string; ts: number }

const keyName = "sk-coder-ai-key"
const endpointName = "sk-coder-ai-endpoint"
const modelName = "sk-coder-ai-model"
const memoryName = "sk-coder-ai-memory"

export function getStoredKey() { return localStorage.getItem(keyName) ?? "" }
export function clearStoredKey() { localStorage.removeItem(keyName) }
export function getBaseUrl() { return localStorage.getItem(endpointName) ?? "https://api.openai.com/v1" }
export function getModel() { return localStorage.getItem(modelName) ?? "gpt-4o-mini" }
export function setModel(model: string) { localStorage.setItem(modelName, model) }
export function isKeyValidated() { return Boolean(getStoredKey()) }

export async function validateKey(key: string, endpoint = getBaseUrl(), model = getModel()) {
  const base = endpoint.replace(/\/$/, "")
  try {
    const response = await fetch(`${base}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages: [{ role: "user", content: "ping" }], max_tokens: 1 }) })
    if (!response.ok) return { ok: false, message: "The AI key or endpoint could not be validated.", remainingCredits: null }
    localStorage.setItem(keyName, key)
    localStorage.setItem(endpointName, base)
    localStorage.setItem(modelName, model)
    return { ok: true, message: "Connected", remainingCredits: null }
  } catch {
    return { ok: false, message: "The AI service could not be reached.", remainingCredits: null }
  }
}

export async function chat(messages: { role: "system" | "user" | "assistant"; content: string }[]) {
  const key = getStoredKey()
  if (!key) throw new Error("Add and validate an AI API key in Settings.")
  const response = await fetch(`${getBaseUrl().replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: getModel(), messages }) })
  if (!response.ok) throw new Error(await response.text())
  const body = await response.json() as { choices?: { message?: { content?: string } }[] }
  return { reply: body.choices?.[0]?.message?.content ?? "" }
}

export function loadMemory(): MemoryEntry[] { try { return JSON.parse(localStorage.getItem(memoryName) ?? "[]") as MemoryEntry[] } catch { return [] } }
export function saveMemory(entries: MemoryEntry[]) { localStorage.setItem(memoryName, JSON.stringify(entries.slice(-100))) }
export function clearMemory() { localStorage.removeItem(memoryName) }
