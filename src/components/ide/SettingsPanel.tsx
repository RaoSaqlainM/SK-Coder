import { useIDEStore } from "@/store/ideStore";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Code, Monitor, Cpu, HardDrive, Info, ChevronRight, KeyRound, CheckCircle2, XCircle, Loader2, Cloud, Smartphone, Bell } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { clearStoredKey, getBaseUrl, getModel, getStoredKey, isKeyValidated, setModel, validateKey } from "@/lib/aiClient";
import TermuxSetup from "@/components/ide/TermuxSetup";
import { clearGithubToken, fetchGithubUser, getGithubToken } from "@/lib/githubAuth";
import { notificationsEnabled, requestWebPermission, setNotificationsEnabled } from "@/lib/notifications";

type SettingsSection = "editor" | "preview" | "ai" | "storage" | "cloudshell" | "termux" | "notifications" | "about" | null;

export default function SettingsPanel() {
  const { settings, updateSettings } = useIDEStore();
  const { editor, preview, ai, storage, backend } = settings;
  const [activeSection, setActiveSection] = useState<SettingsSection>(null);

  const updateEditor = (partial: Partial<typeof editor>) =>
    updateSettings({ editor: { ...editor, ...partial } });
  const updatePreview = (partial: Partial<typeof preview>) =>
    updateSettings({ preview: { ...preview, ...partial } });

  const sections = [
    { id: "editor" as const, icon: Code, label: "Editor", desc: "Font, tabs, minimap, wrap" },
    { id: "preview" as const, icon: Monitor, label: "Preview", desc: "Viewport, auto-refresh" },
    { id: "ai" as const, icon: Cpu, label: "AI Assistant", desc: "Your own API key, model" },
    { id: "cloudshell" as const, icon: Cloud, label: "Cloud Shell", desc: "GitHub Codespaces sign-in" },
    { id: "termux" as const, icon: Smartphone, label: "Termux (Android)", desc: "On-device Linux runtime" },
    { id: "notifications" as const, icon: Bell, label: "Notifications", desc: "Build/run completion alerts" },
    { id: "storage" as const, icon: HardDrive, label: "Storage", desc: "SD card, workspace path" },
    { id: "about" as const, icon: Info, label: "About", desc: "Version, credits, legal" },
  ];

  if (activeSection === null) {
    return (
      <div className="h-full overflow-y-auto scrollbar-thin bg-editor-bg">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Settings</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Configure your development environment</p>
        </div>
        <div className="py-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <s.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-foreground">{s.label}</p>
                <p className="text-[11px] text-muted-foreground">{s.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  const renderBack = (title: string) => (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
      <button onClick={() => setActiveSection(null)} className="text-primary text-xs font-medium">
        ← Back
      </button>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );

  if (activeSection === "editor") {
    return (
      <div className="h-full overflow-y-auto scrollbar-thin bg-editor-bg">
        {renderBack("Editor")}
        <div className="p-4 space-y-5">
          <div>
            <Label className="text-xs text-muted-foreground">Font Size: {editor.fontSize}px</Label>
            <Slider value={[editor.fontSize]} onValueChange={([v]) => updateEditor({ fontSize: v })} min={10} max={28} step={1} className="mt-2" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Tab Size</Label>
            <Select value={String(editor.tabSize)} onValueChange={(v) => updateEditor({ tabSize: Number(v) })}>
              <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 spaces</SelectItem>
                <SelectItem value="4">4 spaces</SelectItem>
                <SelectItem value="8">8 spaces</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Theme</Label>
            <Select value={editor.theme} onValueChange={(v) => updateEditor({ theme: v as any })}>
              <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vs-dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Cursor Style</Label>
            <Select value={editor.cursorStyle} onValueChange={(v) => updateEditor({ cursorStyle: v as any })}>
              <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="line">Line</SelectItem>
                <SelectItem value="block">Block</SelectItem>
                <SelectItem value="underline">Underline</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Line Numbers</Label>
            <Select value={editor.lineNumbers} onValueChange={(v) => updateEditor({ lineNumbers: v as any })}>
              <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="on">On</SelectItem>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="relative">Relative</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Whitespace</Label>
            <Select value={editor.renderWhitespace} onValueChange={(v) => updateEditor({ renderWhitespace: v as any })}>
              <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="boundary">Boundary</SelectItem>
                <SelectItem value="selection">Selection</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SettingsToggle label="Word Wrap" checked={editor.wordWrap === "on"} onChange={(v) => updateEditor({ wordWrap: v ? "on" : "off" })} />
          <SettingsToggle label="Minimap" checked={editor.minimap} onChange={(v) => updateEditor({ minimap: v })} />
          <SettingsToggle label="Bracket Pairs" checked={editor.bracketPairs} onChange={(v) => updateEditor({ bracketPairs: v })} />
          <SettingsToggle label="Auto Save" checked={editor.autoSave} onChange={(v) => updateEditor({ autoSave: v })} />
          <SettingsToggle label="Smooth Scrolling" checked={editor.smoothScrolling} onChange={(v) => updateEditor({ smoothScrolling: v })} />
        </div>
      </div>
    );
  }

  if (activeSection === "preview") {
    return (
      <div className="h-full overflow-y-auto scrollbar-thin bg-editor-bg">
        {renderBack("Preview")}
        <div className="p-4 space-y-5">
          <div>
            <Label className="text-xs text-muted-foreground">Default Viewport</Label>
            <Select value={preview.viewport} onValueChange={(v) => updatePreview({ viewport: v as any })}>
              <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mobile">Mobile (375px)</SelectItem>
                <SelectItem value="tablet">Tablet (768px)</SelectItem>
                <SelectItem value="desktop">Desktop (100%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SettingsToggle label="Auto Refresh" checked={preview.autoRefresh} onChange={(v) => updatePreview({ autoRefresh: v })} />
          <SettingsToggle label="Show Errors" checked={preview.showErrors} onChange={(v) => updatePreview({ showErrors: v })} />
        </div>
      </div>
    );
  }

  if (activeSection === "ai") {
    return (
      <div className="h-full overflow-y-auto scrollbar-thin bg-editor-bg">
        {renderBack("AI Code Analyzer")}
        <AIKeySection />
        <div className="p-4 space-y-5 border-t border-border">
          <SettingsToggle label="Auto scan after edits" checked={ai.autoAnalyze} onChange={(v) => updateSettings({ ai: { ...ai, autoAnalyze: v } })} />
          <div className="bg-secondary/30 rounded-lg p-3">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              AI calls go directly from your browser using your own key.
              Your key never touches our servers. Conversation memory is stored only on this device.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === "cloudshell") {
    return (
      <div className="h-full overflow-y-auto scrollbar-thin bg-editor-bg">
        {renderBack("Cloud Shell")}
        <CloudShellSection />
      </div>
    );
  }

  if (activeSection === "termux") {
    return (
      <div className="h-full overflow-y-auto scrollbar-thin bg-editor-bg">
        {renderBack("Termux (Android)")}
        <TermuxSetup />
      </div>
    );
  }

  if (activeSection === "notifications") {
    return (
      <div className="h-full overflow-y-auto scrollbar-thin bg-editor-bg">
        {renderBack("Notifications")}
        <NotificationsSection />
      </div>
    );
  }

  if (activeSection === "storage") {
    return (
      <div className="h-full overflow-y-auto scrollbar-thin bg-editor-bg">
        {renderBack("Storage")}
        <div className="p-4 space-y-5">
          <SettingsToggle
            label="Mobile: Use External Storage (SD Card)"
            checked={storage.useExternalStorage}
            onChange={(v) => updateSettings({ storage: { ...storage, useExternalStorage: v } })}
          />
          <div>
            <Label className="text-xs text-muted-foreground">Mobile Workspace Path</Label>
            <input
              type="text"
              value={storage.mobileWorkspacePath}
              onChange={(e) => updateSettings({ storage: { ...storage, mobileWorkspacePath: e.target.value, workspacePath: e.target.value } })}
              className="w-full bg-secondary text-xs text-foreground px-3 py-2 rounded-md mt-1 outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Browser Download Folder</Label>
            <input
              type="text"
              value={storage.browserDownloadPath}
              onChange={(e) => updateSettings({ storage: { ...storage, browserDownloadPath: e.target.value } })}
              className="w-full bg-secondary text-xs text-foreground px-3 py-2 rounded-md mt-1 outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <SettingsToggle
            label="Use Temporary Cloud Storage"
            checked={backend.enabled}
            onChange={(v) => updateSettings({ backend: { ...backend, enabled: v } })}
          />
          <div>
            <Label className="text-xs text-muted-foreground">Backend URL</Label>
            <input
              type="url"
              value={backend.url}
              placeholder="https://api.example.com"
              onChange={(e) => updateSettings({ backend: { ...backend, url: e.target.value } })}
              className="w-full bg-secondary text-xs text-foreground px-3 py-2 rounded-md mt-1 outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="bg-secondary/30 rounded-lg p-3">
            <p className="text-[11px] text-muted-foreground">
              Imported workspaces use the configured server until it reaches its 100 GB offload threshold.
              The latest workspace snapshot then stays in this browser’s IndexedDB. Server copies expire after 72 hours.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === "about") {
    return (
      <div className="h-full overflow-y-auto scrollbar-thin bg-editor-bg">
        {renderBack("About")}
        <div className="p-4 space-y-4">
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full overflow-hidden mx-auto mb-3 ring-2 ring-primary/30">
              <img src="/saqlain.jpg" alt="Saqlain King" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display="none"; }} />
            </div>
            <h3 className="text-base font-bold text-foreground">SK Coder</h3>
            <p className="text-xs text-muted-foreground">Version 2.0.0</p>
            <p className="text-xs text-muted-foreground mt-1">by Saqlain King</p>
          </div>
          <div className="border-t border-border pt-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              A professional mobile-first integrated development environment.
              Write, edit, and preview code on any device.
            </p>
          </div>
          <div className="border-t border-border pt-4 space-y-2">
            <Link to="/privacy" className="block text-xs text-primary hover:underline">Privacy Policy</Link>
            <Link to="/terms" className="block text-xs text-primary hover:underline">Terms of Service</Link>
            <Link to="/guide" className="block text-xs text-primary hover:underline">User Guide</Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function SettingsToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function AIKeySection() {
  const [keyInput, setKeyInput] = useState("");
  const [baseUrl, setBaseUrlState] = useState(getBaseUrl());
  const [model, setModelState] = useState(getModel());
  const [status, setStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [message, setMessage] = useState("");
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (isKeyValidated()) {
      setStatus("valid");
      const k = getStoredKey();
      setKeyInput(k ? `${k.slice(0, 10)}${"\u2022".repeat(Math.max(0, k.length - 14))}${k.slice(-4)}` : "");
      setMessage("Connected");
    }
  }, []);

  const handleConnect = async () => {
    const raw = keyInput.includes("\u2022") ? getStoredKey() : keyInput;
    setStatus("checking");
    setMessage("Validating key...");
    const result = await validateKey(raw, baseUrl);
    if (result.ok) {
      setStatus("valid");
      setMessage(result.message);
      setCredits(result.remainingCredits ?? null);
    } else {
      setStatus("invalid");
      setMessage(result.message);
      setCredits(null);
    }
  };

  const handleDisconnect = () => {
    clearStoredKey();
    setStatus("idle");
    setMessage("");
    setKeyInput("");
    setCredits(null);
  };

  const handleModelChange = (m: string) => {
    setModelState(m);
    setModel(m);
  };

  return (
    <div className="p-4 space-y-3 bg-secondary/20">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-primary" />
        <Label className="text-xs font-semibold text-foreground">AI API Key</Label>
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">API Base URL</Label>
        <input
          type="url"
          value={baseUrl}
          onChange={(e) => { setBaseUrlState(e.target.value); setStatus("idle"); setMessage(""); }}
          className="w-full bg-background text-xs text-foreground px-3 py-2 rounded-md mt-1 outline-none focus:ring-1 focus:ring-primary border border-border"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={keyInput}
          onChange={(e) => { setKeyInput(e.target.value); setStatus("idle"); setMessage(""); }}
          placeholder=""
          className="flex-1 bg-background text-xs text-foreground px-3 py-2 rounded-md outline-none focus:ring-1 focus:ring-primary border border-border"
          autoComplete="off"
          spellCheck={false}
        />
        {status === "valid" ? (
          <button onClick={handleDisconnect} className="px-3 py-2 rounded-md bg-secondary text-xs font-medium hover:bg-secondary/80">
            Disconnect
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={status === "checking" || !keyInput.trim()}
            className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40 flex items-center gap-1.5"
          >
            {status === "checking" && <Loader2 className="w-3 h-3 animate-spin" />}
            Connect
          </button>
        )}
      </div>
      {message && (
        <div className={`flex items-center gap-1.5 text-[11px] ${status === "valid" ? "text-success" : status === "invalid" ? "text-destructive" : "text-muted-foreground"}`}>
          {status === "valid" && <CheckCircle2 className="w-3.5 h-3.5" />}
          {status === "invalid" && <XCircle className="w-3.5 h-3.5" />}
          {message}
          {credits !== null && status === "valid" && ` · $${credits.toFixed(2)} remaining`}
        </div>
      )}
      {status === "valid" && (
        <div>
          <Label className="text-[11px] text-muted-foreground">Model</Label>
          <input
            type="text"
            value={model}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full bg-background text-xs text-foreground px-3 py-2 rounded-md mt-1 outline-none focus:ring-1 focus:ring-primary border border-border"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      )}
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Works with any OpenAI-compatible API. Key is stored only on this device.
      </p>
    </div>
  );
}

function CloudShellSection() {
  const [token, setToken] = useState<string | null>(getGithubToken());
  const [user, setUser] = useState<{ login: string; avatar_url: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchGithubUser(token).then(setUser);
  }, [token]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start gap-2">
        <Cloud className="w-4 h-4 text-primary mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">GitHub Codespaces</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Real Linux VM in your browser. Run npm, node, python, gcc, git — anything. Each user pays $0; Codespaces uses your free 60 hours/month under your own GitHub account. SK Coder never sees your code.
          </p>
        </div>
      </div>
      {token ? (
        <div className="bg-success/10 border border-success/30 rounded-lg p-3 space-y-2">
          <p className="text-xs text-success flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Signed in {user ? `as @${user.login}` : ""}
          </p>
          <p className="text-[11px] text-muted-foreground">Open the Terminal panel and switch to the Cloud Shell tab to attach to a codespace.</p>
          <button
            onClick={() => { clearGithubToken(); setToken(null); setUser(null); }}
            className="px-3 py-1.5 rounded bg-secondary text-xs hover:bg-secondary/80"
          >Sign out</button>
        </div>
      ) : (
        <div className="bg-info/10 border border-info/30 rounded-lg p-3 space-y-2">
          <p className="text-xs text-foreground">Not signed in.</p>
          <p className="text-[11px] text-muted-foreground">Open the Terminal → Cloud Shell tab to sign in with your GitHub account using device code flow.</p>
        </div>
      )}
      <div className="bg-secondary/30 rounded-lg p-3">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Don't have a codespace? Create one free at{" "}
          <a href="https://github.com/codespaces/new" target="_blank" rel="noopener noreferrer" className="text-primary underline">github.com/codespaces/new</a>.
        </p>
      </div>
    </div>
  );
}

function NotificationsSection() {
  const [enabled, setEnabled] = useState(notificationsEnabled());

  const toggle = async (v: boolean) => {
    setEnabled(v);
    setNotificationsEnabled(v);
    if (v) await requestWebPermission();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start gap-2">
        <Bell className="w-4 h-4 text-primary mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">Background alerts</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Get notified when long builds, dev servers, or AI responses finish — even when SK Coder is in the background.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Enable notifications</Label>
        <Switch checked={enabled} onCheckedChange={toggle} />
      </div>
      <div className="bg-secondary/30 rounded-lg p-3">
        <p className="text-[11px] text-muted-foreground">
          On Android, allow notification permission when prompted. Notifications fire only when the app is in the background — they will not interrupt active coding.
        </p>
      </div>
    </div>
  );
}
