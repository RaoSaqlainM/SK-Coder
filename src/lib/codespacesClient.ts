export type Codespace = { name: string; display_name: string; state: string; web_url: string; repository: { full_name: string } }
type CodespacesResponse = { total_count: number; codespaces: Codespace[] }

async function request<T>(token: string, path: string, options: RequestInit = {}) {
  const response = await fetch(`https://api.github.com${path}`, { ...options, headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2026-03-10", ...(options.headers ?? {}) } })
  if (!response.ok) throw new Error(await response.text())
  return await response.json() as T
}

export async function listCodespaces(token: string) { return (await request<CodespacesResponse>(token, "/user/codespaces?per_page=100")).codespaces }
export function getCodespace(token: string, name: string) { return request<Codespace>(token, `/user/codespaces/${encodeURIComponent(name)}`) }
export function startCodespace(token: string, name: string) { return request<Codespace>(token, `/user/codespaces/${encodeURIComponent(name)}/start`, { method: "POST" }) }
export async function waitUntilAvailable(token: string, name: string, onState?: (state: string) => void) { for (let count = 0; count < 45; count += 1) { const result = await getCodespace(token, name); onState?.(result.state); if (result.state === "Available") return result; await new Promise((resolve) => window.setTimeout(resolve, 4000)) } throw new Error("Codespace did not become available in time.") }
export function buildWebTerminalUrl(codespace: Codespace) { return codespace.web_url }
