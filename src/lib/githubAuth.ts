const tokenName = "sk-coder-github-token"
const clientId = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_GITHUB_CLIENT_ID

export function getGithubToken() { return localStorage.getItem(tokenName) }
export function clearGithubToken() { localStorage.removeItem(tokenName) }

export async function fetchGithubUser(token: string) {
  const response = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } })
  if (!response.ok) throw new Error("GitHub authentication failed.")
  return await response.json() as { login: string; avatar_url: string }
}

export async function startDeviceFlow() {
  if (!clientId) throw new Error("Set VITE_GITHUB_CLIENT_ID to enable GitHub Device Flow.")
  const response = await fetch("https://github.com/login/device/code", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, scope: "repo codespace" }) })
  if (!response.ok) throw new Error("Could not start GitHub Device Flow.")
  return await response.json() as { device_code: string; user_code: string; verification_uri: string; interval: number; expires_in: number }
}

export async function pollForToken(deviceCode: string, interval: number, expiresIn: number, onWait?: (seconds: number) => void) {
  if (!clientId) throw new Error("Set VITE_GITHUB_CLIENT_ID to enable GitHub Device Flow.")
  const until = Date.now() + expiresIn * 1000
  while (Date.now() < until) {
    const response = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, device_code: deviceCode, grant_type: "urn:ietf:params:oauth:grant-type:device_code" }) })
    const data = await response.json() as { access_token?: string; error?: string }
    if (data.access_token) { localStorage.setItem(tokenName, data.access_token); return data.access_token }
    if (data.error && data.error !== "authorization_pending" && data.error !== "slow_down") throw new Error(data.error)
    await new Promise((resolve) => window.setTimeout(resolve, interval * 1000))
    onWait?.(Math.max(0, Math.ceil((until - Date.now()) / 1000)))
  }
  throw new Error("GitHub device authorization expired.")
}
