import { useEffect, useState } from "react";

type ScriptCategory = "analytics" | "ads" | "chat" | "marketing" | "custom";

type Script = {
    id: string;
    name: string;
    code: string;
    placement: "head" | "body";
    scope: "site" | "route" | "routes" | "exclude" | "pattern";
    route?: string;
    routes?: string[];
    exclude?: string;
    pattern?: string;
    priority: number;
    category: ScriptCategory;
    enabled: boolean;
    version: number;
    updatedAt: number;
};

const API_BASE = import.meta.env.VITE_OWNER_DASHBOARD_HOST && window.location.hostname === import.meta.env.VITE_OWNER_DASHBOARD_HOST ? "/api" : import.meta.env.VITE_API_URL || "/api";

export default function AdminScriptsPage() {
    const [scripts, setScripts] = useState<Script[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [editing, setEditing] = useState<Script | null>(null);
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [placement, setPlacement] = useState<Script["placement"]>("head");
    const [scope, setScope] = useState<Script["scope"]>("site");
    const [route, setRoute] = useState("");
    const [routes, setRoutes] = useState("");
    const [exclude, setExclude] = useState("");
    const [pattern, setPattern] = useState("");
    const [priority, setPriority] = useState(10);
    const [category, setCategory] = useState<ScriptCategory>("custom");
    const [filterCategory, setFilterCategory] = useState<ScriptCategory | "all">("all");
    const [searchQuery, setSearchQuery] = useState("");

    const headers = { "Content-Type": "application/json" } as const;

    async function load() {
        setLoading(true);
        setError("");
        try {
            const response = await fetch(`${API_BASE}/scripts`, { headers, credentials: "include" });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.error || "Scripts could not be loaded.");
            }
            setScripts((await response.json()).scripts || []);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : "Owner authentication is required.");
        }
        finally {
            setLoading(false);
        }
    }

    useEffect(() => { void load(); }, []);

    function resetForm(script?: Script) {
        setEditing(script ?? null);
        setName(script?.name || "");
        setCode(script?.code || "");
        setPlacement(script?.placement || "head");
        setScope(script?.scope || "site");
        setRoute(script?.route || "");
        setRoutes(script?.routes?.join("\n") || "");
        setExclude(script?.exclude || "");
        setPattern(script?.pattern || "");
        setPriority(script?.priority ?? 10);
        setCategory(script?.category || "custom");
    }

    async function save() {
        if (!name.trim() || !code.trim()) {
            setError("A script name and code are required.");
            return;
        }
        if (scope === "route" && !route.trim()) {
            setError("Route-scoped scripts require a route such as /guide or /feedback.");
            return;
        }
        if (scope === "routes" && !routes.trim()) {
            setError("Multi-route scripts require at least one route.");
            return;
        }
        if (scope === "exclude" && !exclude.trim()) {
            setError("Exclude-scoped scripts require an exclusion route.");
            return;
        }
        if (scope === "pattern" && !pattern.trim()) {
            setError("Pattern-scoped scripts require a regex pattern.");
            return;
        }
        if (code.length > 100_000) {
            setError("A script must be smaller than 100 KB.");
            return;
        }
        const body = {
            name: name.trim(),
            code: code.trim(),
            placement,
            scope,
            route: scope === "route" ? route.trim() : undefined,
            routes: scope === "routes" ? routes.split("\n").map(r => r.trim()).filter(Boolean) : undefined,
            exclude: scope === "exclude" ? exclude.trim() : undefined,
            pattern: scope === "pattern" ? pattern.trim() : undefined,
            priority,
            category,
            enabled: editing?.enabled ?? true
        };
        const response = await fetch(editing ? `${API_BASE}/scripts/${encodeURIComponent(editing.id)}` : `${API_BASE}/scripts`, {
            method: editing ? "PATCH" : "POST",
            headers,
            credentials: "include",
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            setError(result.error || "The script could not be saved.");
            return;
        }
        resetForm();
        await load();
    }

    async function toggle(script: Script) {
        const response = await fetch(`${API_BASE}/scripts/${encodeURIComponent(script.id)}`, {
            method: "PATCH",
            headers: { ...headers, "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ enabled: !script.enabled }),
        });
        if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            setError(result.error || "The script status could not be changed.");
            return;
        }
        await load();
    }

    async function remove(script: Script) {
        if (!window.confirm(`Delete ${script.name}? This cannot be undone.`))
            return;
        const response = await fetch(`${API_BASE}/scripts/${encodeURIComponent(script.id)}`, { method: "DELETE", headers, credentials: "include" });
        if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            setError(result.error || "The script could not be deleted.");
            return;
        }
        await load();
    }

    async function duplicate(script: Script) {
        resetForm();
        setName(`${script.name} (copy)`);
        setCode(script.code);
        setPlacement(script.placement);
        setScope(script.scope);
        setRoute(script.route || "");
        setRoutes(script.routes?.join("\n") || "");
        setExclude(script.exclude || "");
        setPattern(script.pattern || "");
        setPriority(script.priority);
        setCategory(script.category);
    }

    const filteredScripts = scripts
        .filter(s => filterCategory === "all" || s.category === filterCategory)
        .filter(s => !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => b.priority - a.priority);

    return (
        <main className="info-page">
            <header className="info-header">
                <h1>Site Scripts</h1>
                <p>Manage scripts for the complete site or selected routes. Scripts execute in visitors' browsers and never run on the server.</p>
            </header>
            
            <section className="info-section">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                    <button className="btn btn-primary" onClick={() => resetForm()}>New script</button>
                    <button className="btn btn-ghost" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button>
                </div>
                {error && <p style={{ color: "var(--red)", marginBottom: 12 }}>{error}</p>}
            </section>

            <section className="info-section">
                <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                    <input 
                        className="input" 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                        placeholder="Search scripts..." 
                        style={{ flex: 1, minWidth: "200px" }} 
                    />
                    <select 
                        className="select" 
                        value={filterCategory} 
                        onChange={(e) => setFilterCategory(e.target.value as ScriptCategory | "all")}
                    >
                        <option value="all">All categories</option>
                        <option value="analytics">Analytics</option>
                        <option value="ads">Advertisements</option>
                        <option value="chat">Chat & Support</option>
                        <option value="marketing">Marketing</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>

                <h2>Script editor</h2>
                <div style={{ display: "grid", gap: 12 }}>
                    <label>Name
                        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Google Analytics" maxLength={120} />
                    </label>
                    
                    <label>Category
                        <select className="select" value={category} onChange={(e) => setCategory(e.target.value as ScriptCategory)}>
                            <option value="analytics">Analytics</option>
                            <option value="ads">Advertisements</option>
                            <option value="chat">Chat & Support</option>
                            <option value="marketing">Marketing</option>
                            <option value="custom">Custom</option>
                        </select>
                    </label>
                    
                    <label>Priority (1-1000, higher loads first)
                        <input className="input" type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} min={1} max={1000} style={{ width: "150px" }} />
                    </label>
                    
                    <label>Placement
                        <select className="select" value={placement} onChange={(e) => setPlacement(e.target.value as Script["placement"])}>
                            <option value="head">Document head</option>
                            <option value="body">Document body</option>
                        </select>
                    </label>
                    
                    <label>Scope
                        <select className="select" value={scope} onChange={(e) => setScope(e.target.value as Script["scope"])}>
                            <option value="site">Whole site</option>
                            <option value="route">Specific route</option>
                            <option value="routes">Multiple routes</option>
                            <option value="exclude">All except route</option>
                            <option value="pattern">Regex pattern</option>
                        </select>
                    </label>
                    
                    {scope === "route" && (
                        <label>Route path
                            <input className="input" value={route} onChange={(e) => setRoute(e.target.value)} placeholder="/guide or /feedback" maxLength={2048} />
                        </label>
                    )}
                    
                    {scope === "routes" && (
                        <label>Route paths (one per line)
                            <textarea className="textarea" value={routes} onChange={(e) => setRoutes(e.target.value)} placeholder="/guide&#10;/feedback&#10;/about" style={{ minHeight: "100px" }} />
                        </label>
                    )}
                    
                    {scope === "exclude" && (
                        <label>Exclude route
                            <input className="input" value={exclude} onChange={(e) => setExclude(e.target.value)} placeholder="/admin" maxLength={2048} />
                        </label>
                    )}
                    
                    {scope === "pattern" && (
                        <label>Regex pattern
                            <input className="input" value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="^\/guide\/.*" maxLength={2048} />
                        </label>
                    )}
                    
                    <label>Script code
                        <textarea 
                            className="textarea" 
                            value={code} 
                            onChange={(e) => setCode(e.target.value)} 
                            placeholder={"<!-- Google tag (gtag.js) -->\n<script async src='https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX'></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n  gtag('config', 'G-XXXXXXXXXX');\n</script>"} 
                            spellCheck={false} 
                            style={{ minHeight: "250px", fontFamily: "var(--font-mono)", fontSize: "0.9rem" }} 
                        />
                    </label>
                    
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="btn btn-primary" onClick={() => void save()} disabled={loading}>{editing ? "Save changes" : "Add script"}</button>
                        {editing && <button className="btn btn-ghost" onClick={() => resetForm()}>Cancel</button>}
                    </div>
                </div>
            </section>

            <section className="info-section">
                <h2>Scripts ({filteredScripts.length})</h2>
                {filteredScripts.length === 0 ? (
                    <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No scripts found. Click "New script" to add one.</p>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table className="info-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Category</th>
                                    <th>Priority</th>
                                    <th>Placement</th>
                                    <th>Scope</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredScripts.map((script) => (
                                    <tr key={script.id}>
                                        <td><strong>{script.name}</strong></td>
                                        <td><span style={{ textTransform: "capitalize" }}>{script.category}</span></td>
                                        <td>{script.priority}</td>
                                        <td>{script.placement}</td>
                                        <td>
                                            <span style={{ fontSize: "0.85rem" }}>
                                                {script.scope === "site" && "Site-wide"}
                                                {script.scope === "route" && `Route: ${script.route}`}
                                                {script.scope === "routes" && `${script.routes?.length || 0} routes`}
                                                {script.scope === "exclude" && `Except: ${script.exclude}`}
                                                {script.scope === "pattern" && `Pattern: ${script.pattern}`}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ color: script.enabled ? "var(--green)" : "var(--text-muted)" }}>
                                                {script.enabled ? "● Enabled" : "○ Disabled"}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                                <button className="btn btn-ghost" onClick={() => toggle(script)} style={{ fontSize: "0.85rem" }}>
                                                    {script.enabled ? "Disable" : "Enable"}
                                                </button>
                                                <button className="btn btn-ghost" onClick={() => resetForm(script)} style={{ fontSize: "0.85rem" }}>Edit</button>
                                                <button className="btn btn-ghost" onClick={() => duplicate(script)} style={{ fontSize: "0.85rem" }}>Duplicate</button>
                                                <button className="btn btn-ghost" onClick={() => remove(script)} style={{ fontSize: "0.85rem" }}>Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </main>
    );
}
