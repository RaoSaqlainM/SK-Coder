import { useIDEStore } from "@/store/ideStore";
export type ErrorEntry = {
    id: string;
    line: number;
    col?: number;
    message: string;
    severity: "error" | "warning" | "info";
    file?: string;
};
export function parseErrors(stderr: string, filename?: string): ErrorEntry[] {
    const entries: ErrorEntry[] = [];
    const lines = stderr.split("\n");
    for (const line of lines) {
        if (!line.trim())
            continue;
        const javaMatch = line.match(/^(.+\.java):(\d+):\s*(error|warning):\s*(.+)/);
        if (javaMatch) {
            entries.push({
                id: Math.random().toString(36).slice(2),
                file: javaMatch[1],
                line: parseInt(javaMatch[2]),
                message: javaMatch[4],
                severity: javaMatch[3] === "error" ? "error" : "warning",
            });
            continue;
        }
        const cppMatch = line.match(/^(.+?):(\d+):(\d+):\s*(error|warning|note):\s*(.+)/);
        if (cppMatch) {
            entries.push({
                id: Math.random().toString(36).slice(2),
                file: cppMatch[1],
                line: parseInt(cppMatch[2]),
                col: parseInt(cppMatch[3]),
                message: cppMatch[5],
                severity: cppMatch[4] === "error" ? "error" : cppMatch[4] === "warning" ? "warning" : "info",
            });
            continue;
        }
        const pyMatch = line.match(/File "(.+)", line (\d+)/);
        if (pyMatch) {
            const msgLine = lines[lines.indexOf(line) + 2] || line;
            entries.push({
                id: Math.random().toString(36).slice(2),
                file: pyMatch[1],
                line: parseInt(pyMatch[2]),
                message: msgLine.trim(),
                severity: "error",
            });
            continue;
        }
        if (line.toLowerCase().includes("error") && filename) {
            entries.push({
                id: Math.random().toString(36).slice(2),
                file: filename,
                line: 1,
                message: line.trim(),
                severity: "error",
            });
        }
    }
    return entries.slice(0, 50);
}
export default function ErrorPanel() {
    const { errors, setErrors, setActivePanel, openTab, flatFiles } = useIDEStore();
    if (!errors.length)
        return null;
    const counts = { error: 0, warning: 0, info: 0 };
    for (const e of errors)
        counts[e.severity]++;
    function jumpToLine(entry: ErrorEntry) {
        if (!entry.file)
            return;
        for (const [, node] of flatFiles) {
            if (node.type === "file" && (node.name === entry.file || node.path.endsWith(entry.file) || node.path === entry.file)) {
                openTab(node);
                setActivePanel("editor");
                return;
            }
        }
    }
    return (<div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "var(--bg-secondary)", borderTop: "1px solid var(--border)",
            maxHeight: 180, display: "flex", flexDirection: "column", zIndex: 10,
        }}>
      <div style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.25rem 0.5rem", borderBottom: "1px solid var(--border-subtle)",
            fontSize: 11, fontFamily: "var(--font-ui)",
        }}>
        <span style={{ color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Problems
        </span>
        {counts.error > 0 && (<span style={{ display: "flex", alignItems: "center", gap: 3, color: "#f38ba8" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {counts.error}
          </span>)}
        {counts.warning > 0 && (<span style={{ display: "flex", alignItems: "center", gap: 3, color: "#fab387" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            {counts.warning}
          </span>)}
        <div style={{ flex: 1 }}/>
        <button onClick={() => setErrors([])} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "0 0.25rem", fontSize: 12 }} title="Clear">
          ✕
        </button>
      </div>
      <div style={{ overflowY: "auto", flex: 1 }}>
        {errors.map((err) => (<div key={err.id} onClick={() => jumpToLine(err)} style={{
                display: "flex", alignItems: "flex-start", gap: "0.5rem",
                padding: "0.25rem 0.75rem", cursor: err.file ? "pointer" : "default",
                borderBottom: "1px solid var(--border-subtle)",
                fontSize: 11, fontFamily: "var(--font-mono)",
            }} className="error-panel-row">
            <span style={{
                flexShrink: 0, color: err.severity === "error" ? "#f38ba8" : err.severity === "warning" ? "#fab387" : "#89b4fa",
                marginTop: 1,
            }}>
              {err.severity === "error" ? "✕" : err.severity === "warning" ? "⚠" : "ℹ"}
            </span>
            <span style={{ color: "var(--text-primary)", flex: 1, wordBreak: "break-word" }}>
              {err.message}
            </span>
            {(err.file || err.line) && (<span style={{ flexShrink: 0, color: "var(--text-muted)", fontSize: 10 }}>
                {err.file && <span>{err.file.split("/").pop()}</span>}
                {err.line && <span>:{err.line}</span>}
                {err.col && <span>:{err.col}</span>}
              </span>)}
          </div>))}
      </div>
    </div>);
}
