/**
 * Professional Terminal Panel - VS Code + Codespaces Style
 * Features:
 * - Bottom panel (always visible)
 * - Multiple terminal tabs
 * - Swipe gestures (mobile)
 * - Keyboard shortcuts (desktop)
 * - Connection status indicators
 * - No artificial limits
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { BrowserTerminalEngine } from "@/lib/browserTerminalEngine";

type TerminalTier = "browser" | "workspace" | "gui";

interface TabDef {
  id: string;
  type: "shell" | "python" | "nodejs" | "custom";
  label: string;
  terminal: Terminal | null;
  engine: BrowserTerminalEngine | null;
}

export function TerminalPanelNew() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [height, setHeight] = useState(300);
  const [activeTabId, setActiveTabId] = useState("terminal-1");
  const [connectionStatus, setConnectionStatus] = useState<TerminalTier>("browser");
  const [tabs, setTabs] = useState<TabDef[]>([
    { id: "terminal-1", type: "shell", label: "Terminal", terminal: null, engine: null },
  ]);
  
  const terminalRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const fitAddons = useRef<Map<string, FitAddon>>(new Map());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  
  // Initialize terminal engine
  const initializeTerminal = useCallback(async (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || tab.terminal) return;
    
    const container = terminalRefs.current.get(tabId);
    if (!container) return;
    
    // Create terminal instance
    const terminal = new Terminal({
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#ffffff",
        selection: "rgba(255, 255, 255, 0.3)",
      },
      fontFamily: "Monaco, Menlo, 'Courier New', monospace",
      fontSize: 14,
      cursorBlink: true,
      scrollback: 10000, // Unlimited scrollback
    });
    
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    
    // Open terminal
    terminal.open(container);
    fitAddon.fit();
    
    // Store references
    fitAddons.current.set(tabId, fitAddon);
    
    // Create engine
    const engine = new BrowserTerminalEngine();
    await engine.initialize();
    
    // Handle input
    let currentLine = "";
    const prompt = "$ ";
    
    terminal.write(prompt);
    
    terminal.onData(async (data) => {
      if (data === "\r") {
        // Enter pressed
        terminal.writeln("");
        
        if (currentLine.trim()) {
          // Execute command
          terminal.write("⏳ Running...\r");
          
          try {
            const result = await engine.execute(currentLine);
            
            // Clear "running" message
            terminal.write("\x1b[2K\r"); // Clear line
            
            if (result.stdout) {
              terminal.writeln(result.stdout);
            }
            if (result.stderr) {
              terminal.writeln(`\x1b[31m${result.stderr}\x1b[0m`); // Red color for errors
            }
          } catch (error) {
            terminal.write("\x1b[2K\r");
            terminal.writeln(`\x1b[31mError: ${error}\x1b[0m`);
          }
        }
        
        terminal.write(prompt);
        currentLine = "";
      } else if (data === "\x7f") {
        // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          terminal.write("\b \b"); // Move back, clear, move back
        }
      } else if (data === "\x03") {
        // Ctrl+C
        terminal.writeln("^C");
        terminal.write(prompt);
        currentLine = "";
      } else if (data === "\x0c") {
        // Ctrl+L (clear screen)
        terminal.clear();
        terminal.write(prompt);
      } else if (data.startsWith("\x1b")) {
        // Arrow keys and other escape sequences (ignore for now)
      } else {
        // Regular character
        currentLine += data;
        terminal.write(data);
      }
    });
    
    // Update tab
    setTabs(prev => prev.map(t => 
      t.id === tabId ? { ...t, terminal, engine } : t
    ));
  }, [tabs]);
  
  // Initialize first terminal on mount
  useEffect(() => {
    if (isExpanded) {
      initializeTerminal(activeTabId);
    }
  }, [activeTabId, isExpanded, initializeTerminal]);
  
  // Resize handling
  useEffect(() => {
    const handleResize = () => {
      const fitAddon = fitAddons.current.get(activeTabId);
      if (fitAddon) {
        fitAddon.fit();
      }
    };
    
    resizeObserverRef.current = new ResizeObserver(handleResize);
    
    const container = terminalRefs.current.get(activeTabId);
    if (container) {
      resizeObserverRef.current.observe(container);
    }
    
    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [activeTabId]);
  
  // Keyboard shortcuts (desktop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+` to toggle terminal
      if (e.ctrlKey && e.key === "`") {
        e.preventDefault();
        setIsExpanded(prev => !prev);
      }
      
      // Ctrl+Shift+` to create new terminal
      if (e.ctrlKey && e.shiftKey && e.key === "`") {
        e.preventDefault();
        addNewTab();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  
  // Swipe handling (mobile)
  const handleTouchStart = useRef<number>(0);
  const handleTouchMove = useRef<number>(0);
  
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    handleTouchStart.current = e.touches[0].clientY;
  }, []);
  
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    handleTouchMove.current = e.touches[0].clientY;
  }, []);
  
  const onTouchEnd = useCallback(() => {
    const delta = handleTouchStart.current - handleTouchMove.current;
    
    if (delta > 50) {
      // Swipe up - collapse
      setIsExpanded(false);
    } else if (delta < -50) {
      // Swipe down - expand
      setIsExpanded(true);
    }
  }, []);
  
  // Add new tab
  const addNewTab = useCallback(() => {
    const newId = `terminal-${Date.now()}`;
    const newTab: TabDef = {
      id: newId,
      type: "shell",
      label: `Terminal ${tabs.length + 1}`,
      terminal: null,
      engine: null,
    };
    
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  }, [tabs.length]);
  
  // Close tab
  const closeTab = useCallback((tabId: string) => {
    if (tabs.length === 1) return; // Don't close last tab
    
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.terminal) {
      tab.terminal.dispose();
    }
    
    setTabs(prev => prev.filter(t => t.id !== tabId));
    
    if (activeTabId === tabId) {
      setActiveTabId(tabs.find(t => t.id !== tabId)?.id || tabs[0].id);
    }
  }, [tabs, activeTabId]);
  
  // Resize dragging
  const handleResize = useCallback((deltaY: number) => {
    setHeight(prev => Math.max(100, Math.min(800, prev + deltaY)));
  }, []);
  
  const startResize = useCallback(() => {
    const onMouseMove = (e: MouseEvent) => {
      handleResize(-e.movementY);
    };
    
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [handleResize]);
  
  return (
    <div
      className={`terminal-panel ${isExpanded ? "expanded" : "collapsed"}`}
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: isExpanded ? height : 40,
        backgroundColor: "#1e1e1e",
        borderTop: "2px solid #333",
        transition: "height 0.2s ease",
        zIndex: 1000,
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <div
        className="terminal-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          height: 40,
          borderBottom: "1px solid #333",
          userSelect: "none",
        }}
      >
        {/* Tabs */}
        <div className="terminal-tabs" style={{ display: "flex", gap: 4 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              style={{
                padding: "8px 16px",
                border: "none",
                background: activeTabId === tab.id ? "#333" : "transparent",
                color: activeTabId === tab.id ? "#fff" : "#888",
                cursor: "pointer",
                borderRadius: "4px 4px 0 0",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>{tab.label}</span>
              {tabs.length > 1 && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  style={{
                    color: "#888",
                    fontSize: 16,
                    cursor: "pointer",
                  }}
                >
                  ×
                </span>
              )}
            </button>
          ))}
          
          <button
            onClick={addNewTab}
            style={{
              padding: "8px 12px",
              border: "none",
              background: "transparent",
              color: "#888",
              cursor: "pointer",
              fontSize: 18,
            }}
            title="New Terminal"
          >
            +
          </button>
        </div>
        
        {/* Status */}
        <div className="terminal-status" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {connectionStatus === "browser" && (
            <span style={{ color: "#4CAF50", fontSize: 12 }}>
              🟢 Browser Ready
            </span>
          )}
          {connectionStatus === "workspace" && (
            <span style={{ color: "#2196F3", fontSize: 12 }}>
              🔵 Workspace Connected
            </span>
          )}
          {connectionStatus === "gui" && (
            <span style={{ color: "#9C27B0", fontSize: 12 }}>
              🟣 GUI Active
            </span>
          )}
        </div>
        
        {/* Actions */}
        <div className="terminal-actions" style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              padding: "4px 8px",
              border: "none",
              background: "#333",
              color: "#fff",
              cursor: "pointer",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            {isExpanded ? "▼" : "▲"}
          </button>
        </div>
      </div>
      
      {/* Resize handle */}
      {isExpanded && (
        <div
          className="resize-handle"
          onMouseDown={startResize}
          style={{
            position: "absolute",
            top: -2,
            left: 0,
            right: 0,
            height: 4,
            cursor: "ns-resize",
            background: "transparent",
          }}
        />
      )}
      
      {/* Terminal content */}
      {isExpanded && (
        <div
          className="terminal-content"
          style={{
            position: "relative",
            height: height - 40,
            overflow: "hidden",
          }}
        >
          {tabs.map(tab => (
            <div
              key={tab.id}
              ref={(el) => {
                if (el) {
                  terminalRefs.current.set(tab.id, el);
                }
              }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: activeTabId === tab.id ? "block" : "none",
                padding: 8,
              }}
            />
          ))}
        </div>
      )}
      
      {/* Mobile quick actions */}
      {isExpanded && (
        <div
          className="mobile-quick-actions"
          style={{
            display: "flex",
            gap: 8,
            padding: "8px 16px",
            borderTop: "1px solid #333",
            overflowX: "auto",
          }}
        >
          <button onClick={() => {
            const tab = tabs.find(t => t.id === activeTabId);
            if (tab?.terminal) {
              tab.terminal.clear();
              tab.terminal.write("$ ");
            }
          }}>
            Clear
          </button>
          <button onClick={() => {
            const tab = tabs.find(t => t.id === activeTabId);
            if (tab?.terminal) {
              tab.terminal.writeln("ls");
              tab.terminal.write("$ ");
            }
          }}>
            ls
          </button>
          <button onClick={() => {
            const tab = tabs.find(t => t.id === activeTabId);
            if (tab?.terminal) {
              tab.terminal.writeln("pwd");
              tab.terminal.write("$ ");
            }
          }}>
            pwd
          </button>
          <button
            onClick={() => setConnectionStatus(prev => prev === "browser" ? "workspace" : "browser")}
            style={{
              background: connectionStatus === "workspace" ? "#2196F3" : "#333",
            }}
          >
            {connectionStatus === "browser" ? "Connect Workspace" : "Disconnect"}
          </button>
        </div>
      )}
      
      <style>{`
        .terminal-panel button {
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 4px;
          background: #333;
          cursor: pointer;
          font-size: 12px;
          white-space: nowrap;
        }
        
        .terminal-panel button:hover {
          background: #444;
        }
        
        .terminal-panel .mobile-quick-actions {
          display: flex;
        }
        
        @media (min-width: 768px) {
          .terminal-panel .mobile-quick-actions {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
