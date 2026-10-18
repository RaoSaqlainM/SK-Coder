/**
 * Browser Terminal Engine
 * Runs entirely in browser using WebContainers + Pyodide
 * No server dependency for supported operations
 */

import type { WebContainer } from "@webcontainer/api";
import type { PyodideInterface } from "pyodide";

export type TerminalTier = "browser" | "workspace" | "gui";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

export interface HistoryEntry {
  id: number;
  command: string;
  cwd: string;
  exitCode: number;
  timestamp: number;
}

export class BrowserTerminalEngine {
  private webcontainer: WebContainer | null = null;
  private pyodide: PyodideInterface | null = null;
  private opfsRoot: FileSystemDirectoryHandle | null = null;
  private indexedDB: IDBDatabase | null = null;
  private currentCWD: string = "/";
  private initialized: boolean = false;
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Initialize OPFS (Origin Private File System) - Unlimited browser storage
      this.opfsRoot = await navigator.storage.getDirectory();
      
      // Initialize IndexedDB (Command History - Lifetime storage, no popup)
      this.indexedDB = await this.openIndexedDB();
      
      // Load last session state
      await this.loadSessionState();
      
      // Mark as initialized (WebContainers and Pyodide loaded on-demand)
      this.initialized = true;
      
      console.log("✅ Browser Terminal Engine initialized");
    } catch (error) {
      console.error("Failed to initialize browser terminal:", error);
      throw error;
    }
  }
  
  private async openIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("skcoder-browser-terminal", 2);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = request.result;
        
        // Command history (Lifetime - no auto-cleanup)
        if (!db.objectStoreNames.contains("history")) {
          const historyStore = db.createObjectStore("history", { 
            keyPath: "id", 
            autoIncrement: true 
          });
          historyStore.createIndex("timestamp", "timestamp", { unique: false });
          historyStore.createIndex("command", "command", { unique: false });
        }
        
        // Terminal sessions
        if (!db.objectStoreNames.contains("sessions")) {
          db.createObjectStore("sessions", { keyPath: "id" });
        }
        
        // User preferences
        if (!db.objectStoreNames.contains("preferences")) {
          db.createObjectStore("preferences", { keyPath: "key" });
        }
        
        // API keys (encrypted)
        if (!db.objectStoreNames.contains("apiKeys")) {
          const keyStore = db.createObjectStore("apiKeys", { keyPath: "provider" });
          keyStore.createIndex("addedAt", "addedAt", { unique: false });
        }
      };
    });
  }
  
  // OPFS Operations (Unlimited file storage)
  async opfsList(path: string): Promise<string> {
    const dir = await this.getOPFSDir(path);
    const entries: string[] = [];
    
    for await (const [name, handle] of dir.entries()) {
      const prefix = handle.kind === "directory" ? "d" : "-";
      entries.push(`${prefix} ${name}`);
    }
    
    return entries.length > 0 ? entries.join("\n") : "(empty)";
  }
  
  async opfsRead(path: string): Promise<string> {
    const fileHandle = await this.getOPFSFile(path);
    const file = await fileHandle.getFile();
    return await file.text();
  }
  
  async opfsWrite(path: string, content: string | Blob): Promise<void> {
    const fileHandle = await this.getOPFSFile(path, true);
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }
  
  async opfsMkdir(path: string): Promise<void> {
    const parts = path.split("/").filter(Boolean);
    let current = this.opfsRoot!;
    
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: true });
    }
  }
  
  async opfsRemove(path: string): Promise<void> {
    const parentPath = path.substring(0, path.lastIndexOf("/"));
    const name = path.substring(path.lastIndexOf("/") + 1);
    
    const parentDir = await this.getOPFSDir(parentPath || "/");
    await parentDir.removeEntry(name, { recursive: true });
  }
  
  private async getOPFSDir(path: string): Promise<FileSystemDirectoryHandle> {
    if (!path || path === "/") return this.opfsRoot!;
    
    const parts = path.split("/").filter(Boolean);
    let current = this.opfsRoot!;
    
    for (const part of parts) {
      current = await current.getDirectoryHandle(part);
    }
    
    return current;
  }
  
  private async getOPFSFile(path: string, create = false): Promise<FileSystemFileHandle> {
    const parts = path.split("/").filter(Boolean);
    const fileName = parts.pop()!;
    
    let currentDir = this.opfsRoot!;
    
    // Navigate to parent directory
    for (const part of parts) {
      currentDir = await currentDir.getDirectoryHandle(part, { create });
    }
    
    return await currentDir.getFileHandle(fileName, { create });
  }
  
  // Command History Operations (Lifetime storage)
  async saveCommandToHistory(command: string, cwd: string, exitCode: number): Promise<void> {
    const tx = this.indexedDB!.transaction(["history"], "readwrite");
    const store = tx.objectStore("history");
    
    await store.add({
      command,
      cwd,
      exitCode,
      timestamp: Date.now(),
    });
  }
  
  async getHistory(limit = 1000): Promise<HistoryEntry[]> {
    const tx = this.indexedDB!.transaction(["history"], "readonly");
    const store = tx.objectStore("history");
    const index = store.index("timestamp");
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, "prev"); // Most recent first
      const results: HistoryEntry[] = [];
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  
  async searchHistory(query: string): Promise<HistoryEntry[]> {
    const allHistory = await this.getHistory(5000);
    const lowerQuery = query.toLowerCase();
    
    return allHistory.filter(entry => 
      entry.command.toLowerCase().includes(lowerQuery)
    );
  }
  
  // Session State
  private async loadSessionState(): Promise<void> {
    try {
      const tx = this.indexedDB!.transaction(["sessions"], "readonly");
      const store = tx.objectStore("sessions");
      const request = store.get("current");
      
      return new Promise((resolve) => {
        request.onsuccess = () => {
          if (request.result) {
            this.currentCWD = request.result.cwd || "/";
          }
          resolve();
        };
        request.onerror = () => resolve();
      });
    } catch {
      // Silently fail
    }
  }
  
  async saveSessionState(): Promise<void> {
    const tx = this.indexedDB!.transaction(["sessions"], "readwrite");
    const store = tx.objectStore("sessions");
    
    await store.put({
      id: "current",
      cwd: this.currentCWD,
      timestamp: Date.now(),
    });
  }
  
  // WebContainers (Node.js in browser)
  private async initWebContainers(): Promise<void> {
    if (this.webcontainer) return;
    
    try {
      const { WebContainer } = await import("@webcontainer/api");
      this.webcontainer = await WebContainer.boot();
      console.log("✅ WebContainers initialized");
    } catch (error) {
      console.error("Failed to initialize WebContainers:", error);
      throw new Error("WebContainers not available in this browser");
    }
  }
  
  // Pyodide (Python in browser)
  private async initPyodide(): Promise<void> {
    if (this.pyodide) return;
    
    try {
      const { loadPyodide } = await import("pyodide");
      this.pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/",
      });
      console.log("✅ Pyodide initialized");
    } catch (error) {
      console.error("Failed to initialize Pyodide:", error);
      throw new Error("Pyodide not available");
    }
  }
  
  // Execute command
  async execute(command: string): Promise<CommandResult> {
    const startTime = Date.now();
    const trimmed = command.trim();
    
    if (!trimmed) {
      return { stdout: "", stderr: "", exitCode: 0, executionTime: 0 };
    }
    
    const [cmd, ...args] = trimmed.split(/\s+/);
    
    try {
      let stdout = "";
      let stderr = "";
      let exitCode = 0;
      
      // Shell commands (OPFS operations)
      if (this.isShellCommand(cmd)) {
        const result = await this.executeShell(cmd, args);
        stdout = result;
        exitCode = 0;
      }
      // Python execution
      else if (cmd === "python" || cmd === "python3") {
        const result = await this.executePython(args);
        stdout = result;
        exitCode = 0;
      }
      // Node.js execution
      else if (cmd === "node") {
        const result = await this.executeNodeJS(args);
        stdout = result;
        exitCode = 0;
      }
      // NPM commands
      else if (cmd === "npm" || cmd === "npx") {
        const result = await this.executeNPM(cmd, args);
        stdout = result;
        exitCode = 0;
      }
      // Check if file execution request
      else if (args[0] && await this.opfsFileExists(args[0])) {
        // Try to detect and run file
        const result = await this.executeFile(args[0], cmd);
        stdout = result;
        exitCode = 0;
      }
      else {
        stderr = `Command not found in browser: ${cmd}\nWorkspace connection required for this command.`;
        exitCode = 127;
      }
      
      // Save to history
      await this.saveCommandToHistory(command, this.currentCWD, exitCode);
      await this.saveSessionState();
      
      return { stdout, stderr, exitCode, executionTime: Date.now() - startTime };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.saveCommandToHistory(command, this.currentCWD, 1);
      
      return {
        stdout: "",
        stderr: errorMessage,
        exitCode: 1,
        executionTime: Date.now() - startTime,
      };
    }
  }
  
  private isShellCommand(cmd: string): boolean {
    return ["ls", "pwd", "cd", "cat", "mkdir", "rm", "touch", "clear", "history", "echo"].includes(cmd);
  }
  
  private async executeShell(cmd: string, args: string[]): Promise<string> {
    switch (cmd) {
      case "ls":
        return await this.opfsList(args[0] || this.currentCWD);
        
      case "pwd":
        return this.currentCWD;
        
      case "cd":
        if (!args[0] || args[0] === "~") {
          this.currentCWD = "/";
        } else if (args[0] === "..") {
          const parts = this.currentCWD.split("/").filter(Boolean);
          parts.pop();
          this.currentCWD = "/" + parts.join("/");
        } else if (args[0].startsWith("/")) {
          this.currentCWD = args[0];
        } else {
          this.currentCWD = this.currentCWD.replace(/\/$/, "") + "/" + args[0];
        }
        return "";
        
      case "cat":
        return await this.opfsRead(args[0]);
        
      case "mkdir":
        await this.opfsMkdir(args[0]);
        return "";
        
      case "rm":
        await this.opfsRemove(args[0]);
        return "";
        
      case "touch":
        await this.opfsWrite(args[0], "");
        return "";
        
      case "clear":
        return "\x1b[2J\x1b[H"; // ANSI clear screen
        
      case "history":
        const history = await this.getHistory(50);
        return history.map((entry, idx) => `${history.length - idx}  ${entry.command}`).join("\n");
        
      case "echo":
        return args.join(" ");
        
      default:
        throw new Error(`Unknown shell command: ${cmd}`);
    }
  }
  
  private async executePython(args: string[]): Promise<string> {
    await this.initPyodide();
    
    const filePath = args.find(arg => !arg.startsWith("-"));
    if (!filePath) {
      throw new Error("Python file path required");
    }
    
    const scriptContent = await this.opfsRead(filePath);
    
    try {
      const result = await this.pyodide!.runPythonAsync(scriptContent);
      return result?.toString() || "";
    } catch (error) {
      throw new Error(`Python error: ${error}`);
    }
  }
  
  private async executeNodeJS(args: string[]): Promise<string> {
    await this.initWebContainers();
    
    const filePath = args.find(arg => !arg.startsWith("-"));
    if (!filePath) {
      throw new Error("Node.js file path required");
    }
    
    // Mount file to WebContainer
    const fileContent = await this.opfsRead(filePath);
    const fileName = filePath.split("/").pop()!;
    
    await this.webcontainer!.mount({
      [fileName]: {
        file: {
          contents: fileContent,
        },
      },
    });
    
    // Spawn Node.js process
    const process = await this.webcontainer!.spawn("node", [fileName]);
    
    let output = "";
    process.stdout.pipeTo(new WritableStream({
      write(data) {
        output += data;
      }
    }));
    
    const exitCode = await process.exit;
    
    if (exitCode !== 0) {
      throw new Error(`Node.js process exited with code ${exitCode}: ${output}`);
    }
    
    return output;
  }
  
  private async executeNPM(cmd: string, args: string[]): Promise<string> {
    await this.initWebContainers();
    
    const process = await this.webcontainer!.spawn(cmd, args);
    
    let output = "";
    process.stdout.pipeTo(new WritableStream({
      write(data) {
        output += data;
      }
    }));
    
    const exitCode = await process.exit;
    
    if (exitCode !== 0) {
      throw new Error(`NPM process exited with code ${exitCode}`);
    }
    
    return output;
  }
  
  private async executeFile(filePath: string, interpreter: string): Promise<string> {
    const ext = filePath.split(".").pop()?.toLowerCase();
    
    // Determine language by extension
    const interpreters: Record<string, string[]> = {
      ".py": ["python", "python3"],
      ".js": ["node"],
      ".mjs": ["node"],
      ".ts": ["npx", "tsx"],
    };
    
    // Check if interpreter matches
    const expected = interpreters[`.${ext}`] || [];
    if (expected.includes(interpreter)) {
      // Re-execute with correct interpreter
      return await this.execute(`${interpreter} ${filePath}`);
    }
    
    throw new Error(`Cannot execute file: ${filePath}`);
  }
  
  private async opfsFileExists(path: string): Promise<boolean> {
    try {
      await this.getOPFSFile(path);
      return true;
    } catch {
      return false;
    }
  }
  
  // File operations (for external use)
  async readFile(path: string): Promise<string> {
    return await this.opfsRead(path);
  }
  
  async writeFile(path: string, content: string): Promise<void> {
    await this.opfsWrite(path, content);
  }
  
  async listFiles(path: string): Promise<string[]> {
    const dir = await this.getOPFSDir(path);
    const files: string[] = [];
    
    for await (const [name] of dir.entries()) {
      files.push(name);
    }
    
    return files;
  }
  
  getCWD(): string {
    return this.currentCWD;
  }
  
  async destroy(): Promise<void> {
    if (this.webcontainer) {
      // WebContainers doesn't have a teardown method
      this.webcontainer = null;
    }
    
    if (this.pyodide) {
      this.pyodide = null;
    }
    
    await this.saveSessionState();
    this.initialized = false;
  }
}
