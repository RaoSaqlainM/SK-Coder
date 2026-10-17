import { useState, useEffect, useRef } from "react";
import { useIDEStore } from "@/store/ideStore";
import { validateGitHubToken, listCodespaces, startCodespace, stopCodespace, deleteCodespace, getCodespaceWebUrl, listUserRepos, createCodespace, createRepo, renameRepo, pushFilesToRepo, importRepositoryToTree, } from "@/lib/githubClient";
import type { Codespace } from "@/types/ide";
import { toast } from "sonner";
type Tab = "codespaces" | "repositories" | "push";
export default function CloudShell() {
    const { settings, updateGithubSettings, setShowSettings, setSettingsTab, fileTree, importFiles, setActivePanel, setSidebarOpen } = useIDEStore();
    const [tab, setTab] = useState<Tab>("codespaces");
    const [codespaces, setCodespaces] = useState<Codespace[]>([]);
    const [repos, setRepos] = useState<{
        id: number;
        full_name: string;
        name: string;
        default_branch: string;
        private: boolean;
        html_url: string;
    }[]>([]);
    const [loading, setLoading] = useState(false);
    const [username, setUsername] = useState(settings.github.username || "");
    const [newRepoName, setNewRepoName] = useState("");
    const [newRepoDesc, setNewRepoDesc] = useState("");
    const [newRepoPrivate, setNewRepoPrivate] = useState(true);
    const [creatingRepo, setCreatingRepo] = useState(false);
    const [renamingRepo, setRenamingRepo] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const [selectedRepo, setSelectedRepo] = useState("");
    const [creatingCodespace, setCreatingCodespace] = useState(false);
    const [pushRepo, setPushRepo] = useState("");
    const [pushing, setPushing] = useState(false);
    const [pushProgress, setPushProgress] = useState({ done: 0, total: 0 });
    const [commitMessage, setCommitMessage] = useState("Update via SK Coder");
    const [importingRepo, setImportingRepo] = useState<string | null>(null);
    const token = settings.github.token;
    useEffect(() => {
        if (token)
            loadAll();
    }, [token]);
    async function loadAll() {
        if (!token)
            return;
        setLoading(true);
        try {
            const [csList, repoList] = await Promise.all([listCodespaces(token), listUserRepos(token)]);
            setCodespaces(csList);
            setRepos(repoList);
            if (!settings.github.username) {
                const { valid, username: uname } = await validateGitHubToken(token);
                if (valid) {
                    updateGithubSettings({ username: uname });
                    setUsername(uname);
                }
            }
            else {
                setUsername(settings.github.username);
            }
        }
        finally {
            setLoading(false);
        }
    }
    function openCodespaceTab(tab: Window | null, url: string) {
        if (!tab) {
            toast.error("Your browser blocked the Codespace tab. Allow pop-ups for SK Coder, then try again.");
            return;
        }
        tab.location.assign(url);
    }
    async function handleOpenCodespace(cs: Codespace) {
        const tab = window.open("", "_blank");
        if (!tab) {
            toast.error("Your browser blocked the Codespace tab. Allow pop-ups for SK Coder, then try again.");
            return;
        }
        if (cs.state === "Shutdown") {
            toast.info("Starting codespace, please wait...");
            await startCodespace(token, cs.name);
            await new Promise((r) => setTimeout(r, 4000));
            const refreshed = await listCodespaces(token);
            setCodespaces(refreshed);
            const updated = refreshed.find((c) => c.name === cs.name);
            if (updated)
                cs = updated;
        }
        const url = getCodespaceWebUrl(cs);
        updateGithubSettings({ codespaceActive: cs.name });
        openCodespaceTab(tab, url);
    }
    async function handleStopCodespace(cs: Codespace) {
        await stopCodespace(token, cs.name);
        toast.success("Codespace stopped");
        await loadAll();
    }
    async function handleDeleteCodespace(cs: Codespace) {
        if (!confirm(`Delete codespace "${cs.display_name || cs.name}"?`))
            return;
        await deleteCodespace(token, cs.name);
        toast.success("Codespace deleted");
        await loadAll();
    }
    async function handleCreateCodespace() {
        if (!selectedRepo) {
            toast.error("Select a repository first");
            return;
        }
        const tab = window.open("", "_blank");
        if (!tab) {
            toast.error("Your browser blocked the Codespace tab. Allow pop-ups for SK Coder, then try again.");
            return;
        }
        setCreatingCodespace(true);
        try {
            const repo = repos.find((r) => r.full_name === selectedRepo);
            const cs = await createCodespace(token, selectedRepo, repo?.default_branch || "main");
            if (cs) {
                toast.success("Codespace created! Opening…");
                await new Promise((r) => setTimeout(r, 2000));
                openCodespaceTab(tab, getCodespaceWebUrl(cs));
                await loadAll();
            }
            else {
                toast.error("Failed to create codespace. Check your GitHub plan and permissions.");
            }
        }
        finally {
            setCreatingCodespace(false);
        }
    }
    async function handleCreateRepo() {
        const name = newRepoName.trim();
        if (!name) {
            toast.error("Enter a repository name");
            return;
        }
        if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
            toast.error("Repo name can only contain letters, numbers, dashes, dots, underscores");
            return;
        }
        setCreatingRepo(true);
        try {
            const result = await createRepo(token, name, newRepoDesc.trim(), newRepoPrivate);
            if (result) {
                toast.success(`Repo "${result.full_name}" created!`);
                setNewRepoName("");
                setNewRepoDesc("");
                await loadAll();
                setPushRepo(result.full_name);
                setTab("push");
            }
        }
        catch (e) {
            toast.error(`Failed: ${(e as Error).message}`);
        }
        finally {
            setCreatingRepo(false);
        }
    }
    async function handleRenameRepo(fullName: string) {
        const newName = renameValue.trim();
        if (!newName)
            return;
        const [owner, repo] = fullName.split("/");
        const ok = await renameRepo(token, owner, repo, newName);
        if (ok) {
            toast.success(`Renamed to ${owner}/${newName}`);
            setRenamingRepo(null);
            setRenameValue("");
            await loadAll();
        }
        else {
            toast.error("Rename failed — check permissions");
        }
    }
    async function handleImportRepo(repo: {
        full_name: string;
        name: string;
        default_branch: string;
    }) {
        setImportingRepo(repo.full_name);
        try {
            const existingNames = new Set(fileTree.map((node) => node.name));
            let rootName = repo.name;
            let counter = 2;
            while (existingNames.has(rootName)) {
                rootName = `${repo.name}-import-${counter}`;
                counter += 1;
            }
            const result = await importRepositoryToTree(token, repo.full_name, repo.default_branch || "main", rootName);
            importFiles([result.root]);
            setActivePanel("files");
            setSidebarOpen(true);
            toast.success(`Imported ${result.imported} file${result.imported === 1 ? "" : "s"}${result.skipped ? ` · ${result.skipped} skipped` : ""}`);
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Repository import failed");
        }
        finally {
            setImportingRepo(null);
        }
    }
    async function handlePush() {
        if (!pushRepo) {
            toast.error("Select a repository");
            return;
        }
        if (fileTree.length === 0) {
            toast.error("No files in your project to push");
            return;
        }
        const [owner, repo] = pushRepo.split("/");
        const msg = commitMessage.trim() || "Update via SK Coder";
        setPushing(true);
        setPushProgress({ done: 0, total: 0 });
        try {
            const result = await pushFilesToRepo(token, owner, repo, fileTree, (done, total) => {
                setPushProgress({ done, total });
            }, msg);
            if (result.success > 0)
                toast.success(`Committed & pushed ${result.success} file${result.success === 1 ? "" : "s"} to ${pushRepo}`);
            if (result.failed > 0)
                toast.error(`${result.failed} file${result.failed === 1 ? " failed" : "s failed"}: ${result.failures[0]?.reason || "GitHub rejected the request"}`);
            if (result.skipped.length > 0)
                toast.message(`${result.skipped.length} file${result.skipped.length === 1 ? " was" : "s were"} skipped: ${result.skipped[0]?.reason || "not available in this browser workspace"}`);
        }
        catch {
            toast.error("Push failed");
        }
        finally {
            setPushing(false);
        }
    }
    if (!token) {
        return (<div className="cloud-panel">
        <div className="cloud-header">
          <h3>GitHub</h3>
            <p>Connect selected repositories to import, export, and open a GitHub workspace</p>
        </div>
        <div className="cloud-body">
          <div className="panel-placeholder">
            <div style={{ width: 56, height: 56, borderRadius: 16, display: "grid", placeItems: "center", background: "rgba(167,139,250,0.14)", boxShadow: "0 0 14px rgba(203,166,247,0.24)", marginBottom: "0.5rem" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
              </svg>
            </div>
            <p style={{ fontWeight: 600, color: "var(--text-primary)" }}>GitHub Token Required</p>
            <p style={{ fontSize: 12, maxWidth: 280, textAlign: "center" }}>
              Use a fine-grained token for only the repositories you choose. Grant Contents read to import, Contents write to push, and Codespaces access only when you use Codespaces.
            </p>
            <button className="btn btn-primary" style={{ marginTop: "0.75rem" }} onClick={() => { setSettingsTab("github"); setShowSettings(true); }}>
              Add GitHub Token
            </button>
            <a href="https://github.com/settings/personal-access-tokens/new?name=SK-Coder&description=Selected+repository+access" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--accent)", marginTop: "0.5rem" }}>
              Create fine-grained token →
            </a>
          </div>
        </div>
      </div>);
    }
    return (<div className="cloud-panel">
      <div className="cloud-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3>GitHub {username && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>@{username}</span>}</h3>
            <p>Codespaces · Repositories · Push files</p>
          </div>
          <button className="btn btn-secondary" onClick={loadAll} disabled={loading} style={{ fontSize: 11, padding: "0.2rem 0.6rem" }}>
            {loading ? "..." : "↺ Refresh"}
          </button>
        </div>
        <div className="cloud-tabs">
          {([["codespaces", "Codespaces"], ["repositories", "Repositories"], ["push", "Push Files"]] as [
            Tab,
            string
        ][]).map(([id, label]) => (<button key={id} className={`cloud-tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
              {label}
            </button>))}
        </div>
      </div>

      <div className="cloud-body">
        {tab === "codespaces" && (<>
            <div style={{ marginBottom: "1.25rem", padding: "0.75rem", background: "var(--bg-elevated)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
              <p style={{ fontSize: 12, fontWeight: 600, marginBottom: "0.5rem", color: "var(--text-primary)" }}>Create Codespace from Repo</p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <select value={selectedRepo} onChange={(e) => setSelectedRepo(e.target.value)} style={{ flex: 1, minWidth: 160 }}>
                  <option value="">Select repository...</option>
                  {repos.map((r) => <option key={r.full_name} value={r.full_name}>{r.full_name}</option>)}
                </select>
                <button className="btn btn-primary" onClick={handleCreateCodespace} disabled={creatingCodespace || !selectedRepo}>
                  {creatingCodespace ? "Creating..." : "Create & Open"}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Your Codespaces ({codespaces.length})
              </p>
            </div>

            <div style={{ background: "var(--yellow-bg)", border: "1px solid rgba(249,226,175,0.3)", borderRadius: "var(--radius-sm)", padding: "0.5rem 0.75rem", marginBottom: "0.75rem", fontSize: 11, color: "var(--yellow)", display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>GitHub Codespaces blocks embedding for security. Clicking "Open" will open in a browser tab — this is the correct behavior.</span>
            </div>

            {loading && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</p>}

            {!loading && codespaces.length === 0 && (<div className="panel-placeholder" style={{ padding: "1.5rem 1rem" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                <p>No codespaces found</p>
                <p style={{ fontSize: 12 }}>Create one above from your repositories</p>
              </div>)}

            {codespaces.map((cs) => (<div key={cs.id} className="cloud-card">
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cloud-card-name">{cs.display_name || cs.name}</div>
                    <div className="cloud-card-meta">
                      <span>{cs.repository.full_name}</span>
                      <span className={`cloud-state-badge ${cs.state}`}>{cs.state}</span>
                    </div>
                  </div>
                </div>
                <div className="cloud-card-actions">
                  <button className="btn btn-primary" style={{ fontSize: 11, padding: "0.2rem 0.65rem" }} onClick={() => handleOpenCodespace(cs)}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    {cs.state === "Shutdown" ? "Start & Open" : "Open in Browser"}
                  </button>
                  {cs.state === "Available" && (<button className="btn btn-secondary" style={{ fontSize: 11, padding: "0.2rem 0.55rem" }} onClick={() => handleStopCodespace(cs)}>
                      Stop
                    </button>)}
                  <button className="btn btn-danger" style={{ fontSize: 11, padding: "0.2rem 0.55rem" }} onClick={() => handleDeleteCodespace(cs)}>
                    Delete
                  </button>
                </div>
              </div>))}
          </>)}

        {tab === "repositories" && (<>
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.85rem", marginBottom: "1rem" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.6rem" }}>Create New Repository</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <input value={newRepoName} onChange={(e) => setNewRepoName(e.target.value)} placeholder="repository-name" onKeyDown={(e) => e.key === "Enter" && handleCreateRepo()}/>
                <input value={newRepoDesc} onChange={(e) => setNewRepoDesc(e.target.value)} placeholder="Description (optional)"/>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: 12, cursor: "pointer" }}>
                    <input type="radio" checked={newRepoPrivate} onChange={() => setNewRepoPrivate(true)}/>
                    Private
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: 12, cursor: "pointer" }}>
                    <input type="radio" checked={!newRepoPrivate} onChange={() => setNewRepoPrivate(false)}/>
                    Public
                  </label>
                  <button className="btn btn-primary" onClick={handleCreateRepo} disabled={creatingRepo || !newRepoName.trim()} style={{ marginLeft: "auto" }}>
                    {creatingRepo ? "Creating..." : "Create Repo"}
                  </button>
                </div>
              </div>
            </div>

            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
              Your Repositories ({repos.length})
            </p>

            {loading && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</p>}

            {repos.map((repo) => (<div key={repo.id} className="cloud-card">
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {renamingRepo === repo.full_name ? (<div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.25rem" }}>
                        <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter")
                    handleRenameRepo(repo.full_name); if (e.key === "Escape")
                    setRenamingRepo(null); }} placeholder="new-name" autoFocus style={{ flex: 1, fontSize: 12, height: 28 }}/>
                        <button className="btn btn-primary" onClick={() => handleRenameRepo(repo.full_name)} style={{ fontSize: 11, padding: "0.2rem 0.5rem" }}>Save</button>
                        <button className="btn btn-secondary" onClick={() => setRenamingRepo(null)} style={{ fontSize: 11, padding: "0.2rem 0.4rem" }}>✕</button>
                      </div>) : (<div className="cloud-card-name">{repo.full_name}</div>)}
                    <div className="cloud-card-meta">
                      <span className={`cloud-state-badge ${repo.private ? "Shutdown" : "Available"}`}>{repo.private ? "Private" : "Public"}</span>
                      <a href={repo.html_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", fontSize: 11 }}>View on GitHub ↗</a>
                    </div>
                  </div>
                </div>
                <div className="cloud-card-actions">
                  <button className="btn btn-primary" style={{ fontSize: 11, padding: "0.2rem 0.55rem" }} onClick={() => handleImportRepo(repo)} disabled={importingRepo === repo.full_name}>
                    {importingRepo === repo.full_name ? "Importing..." : "Import to Explorer"}
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: 11, padding: "0.2rem 0.55rem" }} onClick={() => { setPushRepo(repo.full_name); setTab("push"); }}>
                    Push Files
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: "0.2rem 0.55rem" }} onClick={() => { setRenamingRepo(repo.full_name); setRenameValue(repo.name); }}>
                    Rename
                  </button>
                </div>
              </div>))}
          </>)}

        {tab === "push" && (<>
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.85rem", marginBottom: "1rem" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.6rem" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: "middle", marginRight: 4 }}><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                Commit &amp; Push to GitHub
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <select value={pushRepo} onChange={(e) => setPushRepo(e.target.value)}>
                  <option value="">Select repository...</option>
                  {repos.map((r) => <option key={r.full_name} value={r.full_name}>{r.full_name}</option>)}
                </select>
                <input value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} placeholder="Commit message..." style={{ fontSize: 12 }} onKeyDown={(e) => e.key === "Enter" && handlePush()}/>
                <button className="btn btn-primary" onClick={handlePush} disabled={pushing || !pushRepo || fileTree.length === 0} style={{ justifyContent: "center" }}>
                  {pushing
                ? `Committing ${pushProgress.done}/${pushProgress.total}...`
                : (<>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                        Commit &amp; Push
                      </>)}
                </button>
              </div>
              {pushing && pushProgress.total > 0 && (<div style={{ height: 4, background: "var(--bg-hover)", borderRadius: 2, overflow: "hidden", marginTop: "0.5rem" }}>
                  <div style={{ height: "100%", background: "var(--accent)", width: `${(pushProgress.done / pushProgress.total) * 100}%`, transition: "width 0.2s" }}/>
                </div>)}
            </div>

            <div style={{ background: "var(--accent-muted)", border: "1px solid rgba(0,122,204,0.2)", borderRadius: "var(--radius-sm)", padding: "0.6rem 0.75rem", fontSize: 11, color: "var(--accent)" }}>
              <strong>{fileTree.reduce((acc, n) => acc + countFiles(n), 0)}</strong> file(s) will be committed from your project
            </div>

            {fileTree.length === 0 && (<p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: "0.75rem" }}>No files in your project. Create or import files first.</p>)}
          </>)}
      </div>
    </div>);
}
function countFiles(node: {
    type: string;
    children?: {
        type: string;
        children?: unknown[];
    }[];
}): number {
    if (node.type === "file")
        return 1;
    return (node.children || []).reduce((acc, c) => acc + countFiles(c as {
        type: string;
        children?: {
            type: string;
            children?: unknown[];
        }[];
    }), 0);
}
