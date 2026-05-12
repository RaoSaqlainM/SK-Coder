import { useEffect, useRef, useState } from "react";
import { Terminal as XTerminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";
import { Loader2, ExternalLink, LogOut, Power, Cloud } from "lucide-react";
import { clearGithubToken, fetchGithubUser, getGithubToken, pollForToken, startDeviceFlow } from "@/lib/githubAuth";
import { buildWebTerminalUrl, getCodespace, listCodespaces, startCodespace, waitUntilAvailable, type Codespace } from "@/lib/codespacesClient";

export default function CloudShell() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [token, setToken] = useState<string | null>(getGithubToken());
  const [user, setUser] = useState<{ login: string; avatar_url: string } | null>(null);
  const [codespaces, setCodespaces] = useState<Codespace[]>([]);
  const [active, setActive] = useState<Codespace | null>(null);
  const [busy, setBusy] = useState(false);
  const [deviceCode, setDeviceCode] = useState<{ user_code: string; verification_uri: string } | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!containerRef.current) return;
    const term = new XTerminal({
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 12,
      theme: { background: "#1e1e2e", foreground: "#cdd6f4", cursor: "#f5e0dc" },
      cursorBlink: true,
      convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;
    term.writeln("\x1b[36mSK Coder Cloud Shell\x1b[0m");
    term.writeln("Sign in with GitHub to attach to your Codespace.");
    term.writeln("Each user pays $0 — Codespaces uses your free 60 hours/month.");
    term.writeln("");
    const onResize = () => { try { fit.fit(); } catch {} };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); term.dispose(); termRef.current = null; };
  }, []);

  useEffect(() => {
    if (!token) { setUser(null); return; }
    fetchGithubUser(token).then((u) => setUser(u));
  }, [token]);

  const log = (msg: string, color = "37") => termRef.current?.writeln(`\x1b[${color}m${msg}\x1b[0m`);

  const handleSignIn = async () => {
    setBusy(true);
    setStatus("Starting GitHub device flow...");
    try {
      const dc = await startDeviceFlow();
      setDeviceCode({ user_code: dc.user_code, verification_uri: dc.verification_uri });
      log(`Open ${dc.verification_uri} and enter code: ${dc.user_code}`, "33");
      window.open(dc.verification_uri, "_blank", "noopener");
      const t = await pollForToken(dc.device_code, dc.interval, dc.expires_in, (s) => setStatus(`Waiting for approval... ${s}s left`));
      setToken(t);
      setDeviceCode(null);
      setStatus("Connected.");
      log(`Signed in.`, "32");
    } catch (e) {
      log(e instanceof Error ? e.message : String(e), "31");
      setStatus(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const handleSignOut = () => {
    clearGithubToken();
    setToken(null);
    setActive(null);
    setCodespaces([]);
    log("Signed out.", "33");
  };

  const loadList = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const list = await listCodespaces(token);
      setCodespaces(list);
      log(`Found ${list.length} codespace(s).`, "36");
    } catch (e) {
      log(e instanceof Error ? e.message : String(e), "31");
    } finally { setBusy(false); }
  };

  const launch = async (cs: Codespace) => {
    if (!token) return;
    setBusy(true);
    setStatus(`Starting ${cs.name}...`);
    log(`Starting ${cs.name}...`, "36");
    try {
      let current = cs;
      if (cs.state !== "Available") {
        await startCodespace(token, cs.name);
        current = await waitUntilAvailable(token, cs.name, (s) => { setStatus(`State: ${s}`); log(`  ${s}`, "90"); });
      } else {
        current = await getCodespace(token, cs.name);
      }
      setActive(current);
      log(`Ready. Opening web terminal...`, "32");
      log(`If the new tab is blocked, click the link below.`, "90");
      window.open(buildWebTerminalUrl(current), "_blank", "noopener");
    } catch (e) {
      log(e instanceof Error ? e.message : String(e), "31");
    } finally { setBusy(false); setStatus(""); }
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e2e]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/50 text-xs">
        <Cloud className="w-4 h-4 text-foreground" />
        {!token ? (
          <button onClick={handleSignIn} disabled={busy} className="px-3 py-1 rounded bg-primary text-primary-foreground font-medium disabled:opacity-50 flex items-center gap-1.5">
            {busy && <Loader2 className="w-3 h-3 animate-spin" />}
            Sign in with GitHub
          </button>
        ) : (
          <>
            {user && <span className="text-muted-foreground">@{user.login}</span>}
            <button onClick={loadList} disabled={busy} className="px-2 py-1 rounded bg-secondary hover:bg-secondary/80 disabled:opacity-50">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh"}
            </button>
            <button onClick={handleSignOut} className="ml-auto p-1 hover:bg-secondary rounded text-muted-foreground" title="Sign out">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
      {deviceCode && (
        <div className="px-3 py-2 bg-info/10 text-xs border-b border-border">
          Enter code <span className="font-mono font-bold text-foreground">{deviceCode.user_code}</span> at{" "}
          <a href={deviceCode.verification_uri} target="_blank" rel="noopener noreferrer" className="text-primary underline">
            {deviceCode.verification_uri}
          </a>
        </div>
      )}
      {token && codespaces.length > 0 && (
        <div className="px-2 py-2 border-b border-border max-h-[35%] overflow-y-auto scrollbar-thin space-y-1">
          {codespaces.map((cs) => (
            <button
              key={cs.name}
              onClick={() => launch(cs)}
              disabled={busy}
              className="w-full text-left px-2 py-1.5 rounded text-xs bg-secondary/40 hover:bg-secondary disabled:opacity-50 flex items-center gap-2"
            >
              <Power className={`w-3 h-3 ${cs.state === "Available" ? "text-success" : "text-muted-foreground"}`} />
              <span className="flex-1 truncate">{cs.display_name || cs.name}</span>
              <span className="text-[10px] text-muted-foreground">{cs.state}</span>
              <ExternalLink className="w-3 h-3 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
      {token && codespaces.length === 0 && !busy && (
        <div className="px-3 py-2 text-[11px] text-muted-foreground border-b border-border">
          No codespaces yet. Create one at{" "}
          <a href="https://github.com/codespaces/new" target="_blank" rel="noopener noreferrer" className="text-primary underline">github.com/codespaces/new</a>, then tap Refresh.
        </div>
      )}
      {status && <div className="px-3 py-1 text-[11px] text-muted-foreground border-b border-border">{status}</div>}
      <div ref={containerRef} className="flex-1 min-h-0 px-2 py-1" />
    </div>
  );
}
