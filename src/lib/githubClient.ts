import type { Codespace, FileNode } from "../types/ide"

const GH_API = "https://api.github.com"

export async function validateGitHubToken(token: string): Promise<{ valid: boolean; username: string }> {
  if (!token) return { valid: false, username: "" }
  try {
    const res = await fetch(`${GH_API}/user`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    })
    if (!res.ok) return { valid: false, username: "" }
    const data = await res.json()
    return { valid: true, username: data.login || "" }
  } catch {
    return { valid: false, username: "" }
  }
}

export async function listCodespaces(token: string): Promise<Codespace[]> {
  if (!token) return []
  try {
    const res = await fetch(`${GH_API}/user/codespaces`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.codespaces as Codespace[]) || []
  } catch {
    return []
  }
}

export async function createCodespace(token: string, repoFullName: string, branch = "main"): Promise<Codespace | null> {
  if (!token) return null
  try {
    const [owner, repo] = repoFullName.split("/")
    const res = await fetch(`${GH_API}/repos/${owner}/${repo}/codespaces`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: branch, machine: "basicLinux32gb" }),
    })
    if (!res.ok) return null
    return (await res.json()) as Codespace
  } catch {
    return null
  }
}

export async function startCodespace(token: string, name: string): Promise<boolean> {
  if (!token || !name) return false
  try {
    const res = await fetch(`${GH_API}/user/codespaces/${name}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    })
    return res.ok
  } catch {
    return false
  }
}

export async function stopCodespace(token: string, name: string): Promise<boolean> {
  if (!token || !name) return false
  try {
    const res = await fetch(`${GH_API}/user/codespaces/${name}/stop`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    })
    return res.ok
  } catch {
    return false
  }
}

export async function deleteCodespace(token: string, name: string): Promise<boolean> {
  if (!token || !name) return false
  try {
    const res = await fetch(`${GH_API}/user/codespaces/${name}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    })
    return res.ok
  } catch {
    return false
  }
}

export function getCodespaceWebUrl(codespace: Codespace): string {
  return codespace.web_url || `https://${codespace.name}.github.dev`
}

export async function listUserRepos(token: string): Promise<{ id: number; full_name: string; name: string; default_branch: string; private: boolean; html_url: string }[]> {
  if (!token) return []
  try {
    const res = await fetch(`${GH_API}/user/repos?per_page=100&sort=updated`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export async function createRepo(
  token: string,
  name: string,
  description: string,
  isPrivate: boolean
): Promise<{ full_name: string; name: string; html_url: string } | null> {
  if (!token || !name) return null
  try {
    const res = await fetch(`${GH_API}/user/repos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        description,
        private: isPrivate,
        auto_init: true,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error((err as { message?: string }).message || `HTTP ${res.status}`)
    }
    return await res.json()
  } catch (e) {
    throw e
  }
}

export async function renameRepo(token: string, owner: string, repo: string, newName: string): Promise<boolean> {
  if (!token || !owner || !repo || !newName) return false
  try {
    const res = await fetch(`${GH_API}/repos/${owner}/${repo}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: newName }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function pushFilesToRepo(
  token: string,
  owner: string,
  repo: string,
  files: FileNode[],
  onProgress?: (done: number, total: number) => void,
  commitMessage = "Update via SK Coder"
): Promise<{ success: number; failed: number }> {
  const flatFiles: { path: string; content: string }[] = []
  function flatten(nodes: FileNode[], base = "") {
    for (const node of nodes) {
      if (node.type === "file") {
        const filePath = node.path.replace(/^\//, "").replace(/^[^/]+\//, "")
        flatFiles.push({ path: filePath || node.name, content: node.content || "" })
      }
      if (node.children) flatten(node.children, base)
    }
  }
  flatten(files)

  let success = 0
  let failed = 0
  let done = 0

  for (const file of flatFiles) {
    try {
      const encoded = btoa(unescape(encodeURIComponent(file.content)))
      let sha: string | undefined
      const checkRes = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${file.path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      })
      if (checkRes.ok) {
        const existing = await checkRes.json()
        sha = existing.sha
      }

      const body: Record<string, string> = {
        message: commitMessage,
        content: encoded,
      }
      if (sha) body.sha = sha

      const putRes = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${file.path}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
      if (putRes.ok) success++
      else failed++
    } catch {
      failed++
    }
    done++
    onProgress?.(done, flatFiles.length)
  }

  return { success, failed }
}
