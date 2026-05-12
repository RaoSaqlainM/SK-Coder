import { useEffect, useState } from "react";
import { Smartphone, CheckCircle2, ExternalLink, Copy, Check, Terminal as TerminalIcon } from "lucide-react";
import { isAndroid, isTermuxInstalled, openTermuxInstall, runTermuxCommand, TERMUX_FDROID_URL, TERMUX_SETUP_SCRIPT } from "@/lib/termuxBridge";

export default function TermuxSetup({ onClose }: { onClose?: () => void }) {
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    isTermuxInstalled().then(setInstalled);
  }, []);

  const copyScript = async () => {
    await navigator.clipboard.writeText(TERMUX_SETUP_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const testBridge = async () => {
    setTesting(true);
    try {
      const res = await runTermuxCommand("echo", ["SK Coder bridge OK"]);
      setTestResult(res.exitCode === 0 ? `✓ ${res.stdout.trim() || "Connected"}` : `✗ ${res.stderr || `exit ${res.exitCode}`}`);
    } catch (e) {
      setTestResult(`✗ ${e instanceof Error ? e.message : String(e)}`);
    } finally { setTesting(false); }
  };

  if (!isAndroid()) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Smartphone className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Termux is Android-only</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              On the web, use Cloud Shell (GitHub Codespaces) instead. Install the SK Coder Android APK to get a real on-device bash, npm, gcc, python.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start gap-2">
        <TerminalIcon className="w-4 h-4 text-primary mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Native Linux Runtime via Termux</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Termux is a free, open-source Linux environment that runs on your device. SK Coder uses it to execute real npm, python, gcc, and bash commands. Packages and cache are stored on your phone or SD card — never on our servers.
          </p>
        </div>
      </div>

      <div className={`rounded-lg p-3 text-xs ${installed ? "bg-success/10 border border-success/30" : "bg-info/10 border border-info/30"}`}>
        {installed === null ? (
          <p className="text-muted-foreground">Checking for Termux...</p>
        ) : installed ? (
          <p className="text-success flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Termux is installed</p>
        ) : (
          <div className="space-y-2">
            <p className="text-foreground font-medium">Step 1 — Install Termux</p>
            <p className="text-[11px] text-muted-foreground">Use F-Droid (the Play Store version is outdated and broken).</p>
            <button onClick={openTermuxInstall} className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5">
              Open F-Droid <ExternalLink className="w-3 h-3" />
            </button>
            <a href={TERMUX_FDROID_URL} className="text-[10px] text-muted-foreground underline block">{TERMUX_FDROID_URL}</a>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Step 2 — One-time setup</p>
        <p className="text-[11px] text-muted-foreground">Open Termux and paste this. It enables SD card access and installs the runtimes you need.</p>
        <div className="bg-card border border-border rounded-md p-2 font-mono text-[10px] text-foreground whitespace-pre overflow-x-auto scrollbar-thin">
{TERMUX_SETUP_SCRIPT}
        </div>
        <button onClick={copyScript} className="px-3 py-1.5 rounded bg-secondary text-xs flex items-center gap-1.5 hover:bg-secondary/80">
          {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy script"}
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Step 3 — Allow SK Coder to call Termux</p>
        <p className="text-[11px] text-muted-foreground">
          The setup script above already adds <code className="font-mono text-foreground">allow-external-apps=true</code> to <code className="font-mono text-foreground">~/.termux/termux.properties</code>. After running it, fully close and reopen Termux once.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Step 4 — Test the bridge</p>
        <button onClick={testBridge} disabled={testing} className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
          {testing ? "Testing..." : "Run echo test"}
        </button>
        {testResult && <p className={`text-[11px] font-mono ${testResult.startsWith("✓") ? "text-success" : "text-destructive"}`}>{testResult}</p>}
      </div>

      {onClose && (
        <button onClick={onClose} className="w-full mt-2 px-3 py-2 rounded bg-secondary text-xs font-medium hover:bg-secondary/80">Close</button>
      )}
    </div>
  );
}
