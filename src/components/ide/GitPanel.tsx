import { useMemo, useState } from "react"
import { CheckSquare, Download, GitBranch, Loader2, Square, Upload } from "lucide-react"
import { getGithubToken } from "@/lib/githubAuth"
import { flattenWorkspaceFiles, pullWorkspaceFiles, pushWorkspaceFiles, type GithubRepository } from "@/lib/githubGit"
import { useIDEStore } from "@/store/ideStore"

const preferencesKey = "sk-coder-git-preferences"

function readPreferences() {
  const saved = localStorage.getItem(preferencesKey)
  if (!saved) return { repository: "", branch: "main" }
  try {
    const value = JSON.parse(saved) as { repository?: string; branch?: string }
    return { repository: value.repository ?? "", branch: value.branch ?? "main" }
  } catch {
    return { repository: "", branch: "main" }
  }
}

function parseRepository(value: string, branch: string): GithubRepository | null {
  const [owner, name] = value.trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "").split("/")
  if (!owner || !name) return null
  return { owner, name, branch: branch.trim() || "main" }
}

export default function GitPanel() {
  const { fileTree, setFileTree, addTerminalLine } = useIDEStore()
  const initial = useMemo(readPreferences, [])
  const [repository, setRepository] = useState(initial.repository)
  const [branch, setBranch] = useState(initial.branch)
  const [staged, setStaged] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState("Update workspace from SK Coder")
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("")
  const files = useMemo(() => flattenWorkspaceFiles(fileTree), [fileTree])
  const token = getGithubToken()
  const persist = (nextRepository: string, nextBranch: string) => localStorage.setItem(preferencesKey, JSON.stringify({ repository: nextRepository, branch: nextBranch }))
  const toggle = (path: string) => setStaged((current) => {
    const next = new Set(current)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    return next
  })
  const stageAll = () => setStaged(new Set(files.map((file) => file.path)))
  const clearStage = () => setStaged(new Set())
  const repositoryConfig = () => {
    const parsed = parseRepository(repository, branch)
    if (!parsed) throw new Error("Enter a repository as owner/name and a branch.")
    if (!token) throw new Error("Sign in through Cloud Shell before using GitHub workspace actions.")
    persist(repository, branch)
    return parsed
  }
  const commitAndPush = async () => {
    setBusy(true)
    try {
      const config = repositoryConfig()
      const selected = files.filter((file) => staged.has(file.path))
      if (!selected.length) throw new Error("Stage at least one file before committing.")
      if (!message.trim()) throw new Error("Enter a commit message.")
      const sha = await pushWorkspaceFiles(token!, config, selected, message.trim())
      const detail = `Pushed ${selected.length} staged file${selected.length === 1 ? "" : "s"} to ${config.owner}/${config.name}@${config.branch} (${sha.slice(0, 7)}).`
      setStatus(detail)
      addTerminalLine({ text: detail, type: "success" })
      clearStage()
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      setStatus(detail)
      addTerminalLine({ text: detail, type: "error" })
    } finally {
      setBusy(false)
    }
  }
  const pull = async () => {
    setBusy(true)
    try {
      const config = repositoryConfig()
      const remoteTree = await pullWorkspaceFiles(token!, config)
      setFileTree(remoteTree)
      clearStage()
      const detail = `Pulled ${flattenWorkspaceFiles(remoteTree).length} file${flattenWorkspaceFiles(remoteTree).length === 1 ? "" : "s"} from ${config.owner}/${config.name}@${config.branch}.`
      setStatus(detail)
      addTerminalLine({ text: detail, type: "success" })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      setStatus(detail)
      addTerminalLine({ text: detail, type: "error" })
    } finally {
      setBusy(false)
    }
  }
  return <div className="h-full overflow-y-auto bg-editor-bg p-3 sm:p-5">
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary"><GitBranch className="h-5 w-5" /></div>
        <div><h2 className="text-base font-semibold text-foreground">GitHub workspace</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Stage local files, commit and push them through the authenticated GitHub API, or pull the selected repository branch into this workspace.</p></div>
      </div>
      {!token && <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">GitHub is not connected in this browser. Open Terminal, select Cloud Shell, and finish the existing device-flow sign-in before using these actions.</div>}
      <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
        <label className="space-y-1 text-xs font-medium text-muted-foreground"><span>Repository</span><input value={repository} onChange={(event) => setRepository(event.target.value)} placeholder="owner/repository" className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" /></label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground"><span>Branch</span><input value={branch} onChange={(event) => setBranch(event.target.value)} placeholder="main" className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" /></label>
      </div>
      <div className="rounded-lg border border-border bg-card/40">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2"><span className="mr-auto text-xs font-semibold text-foreground">Staging area</span><button type="button" onClick={stageAll} className="min-h-9 rounded px-2 text-xs text-primary hover:bg-secondary">Stage all</button><button type="button" onClick={clearStage} className="min-h-9 rounded px-2 text-xs text-muted-foreground hover:bg-secondary">Clear</button></div>
        <div className="max-h-[35dvh] overflow-y-auto divide-y divide-border/70">{files.length ? files.map((file) => <button key={file.path} type="button" onClick={() => toggle(file.path)} className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-secondary/60"><span className="text-primary">{staged.has(file.path) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}</span><span className="min-w-0 flex-1 truncate font-mono text-foreground">{file.path}</span><span className="text-[10px] uppercase text-muted-foreground">{file.encoding === "base64" ? "binary" : file.language}</span></button>) : <div className="px-3 py-4 text-xs text-muted-foreground">No workspace files are available to stage.</div>}</div>
      </div>
      <label className="block space-y-1 text-xs font-medium text-muted-foreground"><span>Commit message</span><input value={message} onChange={(event) => setMessage(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" /></label>
      <div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => void commitAndPush()} disabled={busy || !token} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Commit and push staged</button><button type="button" onClick={() => void pull()} disabled={busy || !token} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-border bg-secondary/50 px-3 text-sm font-medium text-foreground disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Pull branch into workspace</button></div>
      {status && <div className="rounded-md border border-border bg-card/50 px-3 py-2 text-xs text-muted-foreground">{status}</div>}
    </div>
  </div>
}
