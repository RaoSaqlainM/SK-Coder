import { useState, useRef, useEffect, useCallback } from "react";
import { useIDEStore } from "@/store/ideStore";
import { X, Send, Trash2, Bot, Loader2, Sparkles, Bug, Wand2, KeyRound } from "lucide-react";
import { chat, isKeyValidated, loadMemory, saveMemory, clearMemory, type MemoryEntry } from "@/lib/aiClient";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router-dom";

export default function AIChatPanel() {
  const { aiChatOpen, setAiChatOpen, fileTree, openTabs, activeTabId, setActivePanel } = useIDEStore();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<MemoryEntry[]>(() => loadMemory());
  const [hasKey, setHasKey] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aiChatOpen) setHasKey(isKeyValidated());
    const sync = () => setHasKey(isKeyValidated());
    window.addEventListener("sk-ai-key-state", sync);
    return () => window.removeEventListener("sk-ai-key-state", sync);
  }, [aiChatOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getProjectContext = useCallback(() => {
    const activeTab = openTabs.find((t) => t.id === activeTabId);
    let context = "";
    if (activeTab) {
      context += `Current file: ${activeTab.path}\n\`\`\`${activeTab.language}\n${activeTab.content.slice(0, 3500)}\n\`\`\`\n\n`;
    }
    const listFiles = (nodes: typeof fileTree, prefix = ""): string => nodes.map((n) => {
      const path = prefix ? `${prefix}/${n.name}` : n.name;
      if (n.type === "folder" && n.children) return `${path}/\n${listFiles(n.children, path)}`;
      return path;
    }).join("\n");
    if (fileTree.length > 0) context += `Workspace files:\n${listFiles(fileTree)}\n`;
    return context;
  }, [openTabs, activeTabId, fileTree]);

  const handleSend = useCallback(async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || loading) return;
    setInput("");
    const userMsg: MemoryEntry = { role: "user", content: text, ts: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    saveMemory(next);
    setLoading(true);
    try {
      const { reply } = await chat([
        {
          role: "system",
          content: `You are SK Coder's code analyzer and fixer. Read the workspace context, point out bugs with line references when possible, suggest exact fixes as code blocks, and detect the right run strategy. Be concise.\n\n${getProjectContext()}`,
        },
        ...next.slice(-12).map((m) => ({ role: m.role, content: m.content })),
      ]);
      const assistantMsg: MemoryEntry = { role: "assistant", content: reply, ts: Date.now() };
      const updated = [...next, assistantMsg];
      setMessages(updated);
      saveMemory(updated);
    } catch (err) {
      const msg: MemoryEntry = { role: "assistant", content: err instanceof Error ? err.message : "Unknown error", ts: Date.now() };
      const updated = [...next, msg];
      setMessages(updated);
      saveMemory(updated);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, getProjectContext]);

  const handleClear = useCallback(() => {
    setMessages([]);
    clearMemory();
  }, []);

  if (!aiChatOpen) return null;

  if (!hasKey) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/70" onClick={() => setAiChatOpen(false)}>
        <div className="bg-card border border-border rounded-t-lg sm:rounded-md w-full sm:max-w-md p-6 flex flex-col gap-4 shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Connect your AI key</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            AI features stay off until you connect your own compatible API key.
            Your key is stored only on this device and used directly from your browser.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => { setAiChatOpen(false); setActivePanel("settings"); }}
              className="w-full py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              Open Settings
            </button>
            <Link
              to="/guide"
              onClick={() => setAiChatOpen(false)}
              className="text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Setup guide
            </Link>
            <button onClick={() => setAiChatOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/70" onClick={() => setAiChatOpen(false)}>
      <div
        className="bg-card border border-border rounded-t-lg sm:rounded-md w-full sm:max-w-2xl h-[76vh] sm:h-[72vh] flex flex-col shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Bot className="w-4 h-4 text-primary shrink-0" />
            <h3 className="text-sm font-semibold text-foreground truncate">Code Analyzer</h3>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleClear} className="p-2 rounded hover:bg-secondary transition-colors" aria-label="Clear">
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button onClick={() => setAiChatOpen(false)} className="p-2 rounded hover:bg-secondary transition-colors" aria-label="Close">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
          {messages.length === 0 && (
            <div className="h-full flex flex-col justify-end gap-3 text-muted-foreground">
              <div className="rounded-md border border-border bg-secondary/30 p-3 text-xs leading-relaxed">
                Ask for analysis, fixes, or run strategy. Conversation memory is kept on this device.
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Analyze", icon: Sparkles, q: "Analyze the opened workspace and list the run strategy, likely bugs, and next fixes." },
                  { label: "Find bugs", icon: Bug, q: "Scan the current file for bugs and risky code. Include line references." },
                  { label: "Fix file", icon: Wand2, q: "Return a corrected version of the current file and explain exactly what changed." },
                  { label: "Run help", icon: Bot, q: "Detect how this project should run and what command/runtime should be used." },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleSend(item.q)}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-secondary text-xs text-foreground hover:bg-secondary/80 transition-colors min-h-10"
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[92%] rounded-md px-3 py-2 text-xs leading-relaxed break-words ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-invert prose-xs max-w-none [&_pre]:bg-[hsl(var(--terminal-bg))] [&_pre]:p-2 [&_pre]:rounded [&_pre]:overflow-x-auto [&_code]:text-[11px] [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-sans break-words">{msg.content}</pre>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-secondary rounded-md px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Processing
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="px-3 py-2 border-t border-border shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for analysis, fixes, or run strategy..."
              rows={1}
              className="flex-1 bg-secondary text-sm text-foreground px-3 py-2 rounded-md outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary resize-none max-h-24"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="p-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-40 transition-colors shrink-0"
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
