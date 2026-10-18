/**
 * Universal File Execution Engine
 * Handles 100+ file types across all categories
 * Routes to appropriate execution tier (browser, workspace, or GUI)
 */

import type { FileNode } from "@/types/ide";

export type ExecutionTier = 
  | "browser-preview"
  | "browser-runtime"
  | "workspace-staging"
  | "workspace-direct"
  | "gui-display";

export type FileCategory =
  | "markup"
  | "interpreted"
  | "compiled"
  | "bytecode"
  | "hardware"
  | "data"
  | "style"
  | "config"
  | "media"
  | "document"
  | "build";

export interface ExecutionPlan {
  category: FileCategory;
  tier: ExecutionTier;
  runtime: string;
  command: string;
  dependencies: string[];
  connectedFiles: string[];
  estimatedTime: number;
  requiredCapacity: number;
  isGUI: boolean;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  outputType: "text" | "preview" | "gui" | "error";
  previewUrl?: string;
  guiUrl?: string;
}

// All supported extensions mapping
const EXTENSION_MAP: Record<string, { category: FileCategory; runtime?: string; isGUI?: boolean }> = {
  // Markup (browser-preview)
  ".html": { category: "markup" },
  ".htm": { category: "markup" },
  ".xhtml": { category: "markup" },
  ".svg": { category: "markup" },
  
  // Interpreted (browser-runtime or workspace-direct)
  ".py": { category: "interpreted", runtime: "python3" },
  ".pyw": { category: "interpreted", runtime: "python3" },
  ".js": { category: "interpreted", runtime: "node" },
  ".mjs": { category: "interpreted", runtime: "node" },
  ".cjs": { category: "interpreted", runtime: "node" },
  ".ts": { category: "interpreted", runtime: "npx tsx" },
  ".rb": { category: "interpreted", runtime: "ruby" },
  ".php": { category: "interpreted", runtime: "php" },
  ".pl": { category: "interpreted", runtime: "perl" },
  ".pl6": { category: "interpreted", runtime: "raku" },
  ".raku": { category: "interpreted", runtime: "raku" },
  ".lua": { category: "interpreted", runtime: "lua" },
  ".r": { category: "interpreted", runtime: "Rscript" },
  ".R": { category: "interpreted", runtime: "Rscript" },
  ".jl": { category: "interpreted", runtime: "julia" },
  ".sh": { category: "interpreted", runtime: "bash" },
  ".bash": { category: "interpreted", runtime: "bash" },
  ".zsh": { category: "interpreted", runtime: "zsh" },
  ".fish": { category: "interpreted", runtime: "fish" },
  ".ksh": { category: "interpreted", runtime: "ksh" },
  ".ps1": { category: "interpreted", runtime: "pwsh" },
  ".tcl": { category: "interpreted", runtime: "tclsh" },
  ".awk": { category: "interpreted", runtime: "awk" },
  ".groovy": { category: "interpreted", runtime: "groovy" },
  ".kts": { category: "interpreted", runtime: "kotlin" },
  ".sc": { category: "interpreted", runtime: "scala" },
  ".exs": { category: "interpreted", runtime: "elixir" },
  ".dart": { category: "interpreted", runtime: "dart" },
  ".swift": { category: "interpreted", runtime: "swift" },
  ".hs": { category: "interpreted", runtime: "runghc" },
  ".ml": { category: "interpreted", runtime: "ocaml" },
  ".fsx": { category: "interpreted", runtime: "dotnet fsi" },
  ".lisp": { category: "interpreted", runtime: "sbcl" },
  ".lsp": { category: "interpreted", runtime: "sbcl" },
  ".cl": { category: "interpreted", runtime: "sbcl" },
  ".scm": { category: "interpreted", runtime: "racket" },
  ".rkt": { category: "interpreted", runtime: "racket" },
  ".clj": { category: "interpreted", runtime: "clojure" },
  ".pro": { category: "interpreted", runtime: "swipl" },
  ".4th": { category: "interpreted", runtime: "gforth" },
  ".fs": { category: "interpreted", runtime: "gforth" },
  
  // Compiled (workspace-staging)
  ".c": { category: "compiled", runtime: "gcc" },
  ".cpp": { category: "compiled", runtime: "g++" },
  ".cc": { category: "compiled", runtime: "g++" },
  ".cxx": { category: "compiled", runtime: "g++" },
  ".rs": { category: "compiled", runtime: "rustc" },
  ".go": { category: "compiled", runtime: "go run" },
  ".java": { category: "compiled", runtime: "javac && java" },
  ".kt": { category: "compiled", runtime: "kotlinc" },
  ".cs": { category: "compiled", runtime: "dotnet run" },
  ".vb": { category: "compiled", runtime: "dotnet run" },
  ".zig": { category: "compiled", runtime: "zig run" },
  ".nim": { category: "compiled", runtime: "nim c -r" },
  ".cr": { category: "compiled", runtime: "crystal" },
  ".d": { category: "compiled", runtime: "dmd" },
  ".odin": { category: "compiled", runtime: "odin run" },
  ".f": { category: "compiled", runtime: "gfortran" },
  ".f90": { category: "compiled", runtime: "gfortran" },
  ".f95": { category: "compiled", runtime: "gfortran" },
  ".for": { category: "compiled", runtime: "gfortran" },
  ".cob": { category: "compiled", runtime: "cobc" },
  ".cbl": { category: "compiled", runtime: "cobc" },
  ".pas": { category: "compiled", runtime: "fpc" },
  ".pp": { category: "compiled", runtime: "fpc" },
  ".adb": { category: "compiled", runtime: "gnatmake" },
  ".asm": { category: "compiled", runtime: "nasm" },
  ".s": { category: "compiled", runtime: "nasm" },
  ".m": { category: "compiled", runtime: "clang -framework Cocoa" },
  ".mm": { category: "compiled", runtime: "clang -framework Cocoa" },
  
  // Bytecode (browser-runtime or workspace-direct)
  ".wasm": { category: "bytecode", runtime: "wasmer" },
  ".jar": { category: "bytecode", runtime: "java -jar" },
  ".class": { category: "bytecode", runtime: "java" },
  
  // Hardware (workspace-staging)
  ".v": { category: "hardware", runtime: "iverilog" },
  ".sv": { category: "hardware", runtime: "iverilog" },
  ".vhd": { category: "hardware", runtime: "ghdl" },
  ".vhdl": { category: "hardware", runtime: "ghdl" },
  
  // Data (browser-preview)
  ".json": { category: "data" },
  ".yaml": { category: "data" },
  ".yml": { category: "data" },
  ".toml": { category: "data" },
  ".xml": { category: "data" },
  ".ini": { category: "data" },
  ".env": { category: "data" },
  ".csv": { category: "data" },
  ".txt": { category: "data" },
  ".proto": { category: "data" },
  
  // Style (browser-preview)
  ".css": { category: "style" },
  ".scss": { category: "style" },
  ".sass": { category: "style" },
  ".less": { category: "style" },
  
  // Config (browser-preview)
  ".gitignore": { category: "config" },
  ".dockerignore": { category: "config" },
  ".editorconfig": { category: "config" },
  
  // Media (browser-preview)
  ".png": { category: "media" },
  ".jpg": { category: "media" },
  ".jpeg": { category: "media" },
  ".gif": { category: "media" },
  ".webp": { category: "media" },
  ".bmp": { category: "media" },
  ".ico": { category: "media" },
  ".mp4": { category: "media" },
  ".webm": { category: "media" },
  ".ogg": { category: "media" },
  ".mp3": { category: "media" },
  ".wav": { category: "media" },
  ".flac": { category: "media" },
  
  // Document (browser-preview)
  ".md": { category: "document" },
  ".pdf": { category: "document" },
  ".rst": { category: "document" },
  ".adoc": { category: "document" },
  
  // Headers (cannot run)
  ".h": { category: "data" },
  ".hpp": { category: "data" },
  ".hh": { category: "data" },
  ".pyi": { category: "data" },
  ".ads": { category: "data" },
  ".d.ts": { category: "data" },
  
  // Build files (need build tool)
  ".jsx": { category: "build", runtime: "npm run build" },
  ".tsx": { category: "build", runtime: "npm run build" },
  ".vue": { category: "build", runtime: "npm run build" },
  ".svelte": { category: "build", runtime: "npm run build" },
  ".astro": { category: "build", runtime: "npm run build" },
};

export class FileExecutionEngine {
  
  async planExecution(
    filePath: string,
    fileTree: FileNode[],
    fileContent?: string
  ): Promise<ExecutionPlan> {
    const ext = this.getExtension(filePath);
    const content = fileContent || "";
    
    // Get base execution info
    const execInfo = EXTENSION_MAP[ext] || { category: "data" as FileCategory };
    
    // Detect connected files
    const connectedFiles = await this.detectConnectedFiles(filePath, fileTree, content);
    
    // Determine execution tier
    const tier = this.determineExecutionTier(
      execInfo.category,
      ext,
      content,
      execInfo.runtime
    );
    
    // Build command
    const command = this.buildCommand(execInfo.runtime || "", filePath, connectedFiles);
    
    // Estimate resources
    const estimatedTime = this.estimateExecutionTime(execInfo.category, fileTree.length);
    const requiredCapacity = this.estimateCapacity(filePath, connectedFiles, content);
    
    // Check for GUI
    const isGUI = this.detectsGUI(content) || execInfo.isGUI === true;
    
    return {
      category: execInfo.category,
      tier,
      runtime: execInfo.runtime || "preview",
      command,
      dependencies: [],
      connectedFiles,
      estimatedTime,
      requiredCapacity,
      isGUI,
    };
  }
  
  private getExtension(path: string): string {
    const parts = path.split(".");
    if (parts.length > 2 && parts[parts.length - 2] === "d") {
      return `.${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    }
    return "." + parts[parts.length - 1];
  }
  
  private determineExecutionTier(
    category: FileCategory,
    ext: string,
    content: string,
    runtime?: string
  ): ExecutionTier {
    // Preview-only files
    if (["markup", "data", "style", "media", "document", "config"].includes(category)) {
      return "browser-preview";
    }
    
    // Hardware
    if (category === "hardware") {
      return "workspace-staging";
    }
    
    // GUI applications
    if (this.detectsGUI(content)) {
      return "gui-display";
    }
    
    // Interpreted languages
    if (category === "interpreted") {
      // Check browser runtime availability
      if (this.hasBrowserRuntime(ext, content)) {
        return "browser-runtime";
      }
      return "workspace-direct";
    }
    
    // Compiled languages
    if (category === "compiled") {
      return "workspace-staging";
    }
    
    // Bytecode
    if (category === "bytecode") {
      if (ext === ".wasm") {
        return "browser-runtime";
      }
      return "workspace-direct";
    }
    
    // Build files
    if (category === "build") {
      return "workspace-staging";
    }
    
    return "browser-preview";
  }
  
  private hasBrowserRuntime(ext: string, content: string): boolean {
    // JavaScript/TypeScript/Node.js → WebContainers
    if ([".js", ".mjs", ".cjs", ".ts"].includes(ext)) {
      return true;
    }
    
    // Python → Pyodide (check for GUI)
    if (ext === ".py" && !this.detectsGUI(content)) {
      // Basic package check (could be enhanced)
      const restrictedPackages = ["pygame", "tkinter", "gtk", "qt"];
      const hasRestricted = restrictedPackages.some(pkg => 
        content.includes(`import ${pkg}`) || content.includes(`from ${pkg}`)
      );
      
      return !hasRestricted;
    }
    
    return false;
  }
  
  private detectsGUI(content: string): boolean {
    const guiPatterns = [
      "import pygame",
      "from pygame",
      "import tkinter",
      "from tkinter",
      "import matplotlib.pyplot",
      "from matplotlib",
      "import gtk",
      "import qt",
      "SDL_",
      "glfw",
      "OpenGL",
    ];
    
    return guiPatterns.some(pattern => content.includes(pattern));
  }
  
  private async detectConnectedFiles(
    mainFile: string,
    fileTree: FileNode[],
    content: string
  ): Promise<string[]> {
    const connected: string[] = [];
    const mainExt = this.getExtension(mainFile);
    const mainDir = mainFile.substring(0, mainFile.lastIndexOf("/"));
    
    // Walk file tree
    const walk = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.path === mainFile) continue;
        
        // Check connection
        if (node.path.startsWith(mainDir)) {
          const nodeExt = this.getExtension(node.path);
          
          // HTML connects to CSS, JS, images
          if (mainExt === ".html") {
            if ([".css", ".js", ".json", ".png", ".jpg", ".svg"].includes(nodeExt)) {
              // Check if referenced in content
              if (content.includes(node.name) || content.includes(node.path)) {
                connected.push(node.path);
              }
            }
          }
          
          // Python connects to other .py files (imports)
          else if (mainExt === ".py") {
            if (nodeExt === ".py") {
              const moduleName = node.name.replace(".py", "");
              if (content.includes(`import ${moduleName}`) || content.includes(`from ${moduleName}`)) {
                connected.push(node.path);
              }
            }
          }
          
          // C/C++ connects to headers
          else if ([".c", ".cpp"].includes(mainExt)) {
            if ([".h", ".hpp"].includes(nodeExt)) {
              if (content.includes(`#include "${node.name}"`) || content.includes(`#include <${node.name}>`)) {
                connected.push(node.path);
              }
            }
          }
          
          // Java connects to other .java files (same package)
          else if (mainExt === ".java") {
            if (nodeExt === ".java") {
              // Same package detection (basic)
              connected.push(node.path);
            }
          }
        }
        
        // Recurse
        if (node.children) {
          walk(node.children);
        }
      }
    };
    
    walk(fileTree);
    return connected;
  }
  
  private buildCommand(runtime: string, filePath: string, connectedFiles: string[]): string {
    if (!runtime) return "";
    
    const fileName = filePath.split("/").pop()!;
    const baseName = fileName.substring(0, fileName.lastIndexOf("."));
    
    return runtime
      .replace("{file}", filePath)
      .replace("{output}", baseName)
      .replace("{class}", baseName);
  }
  
  private estimateExecutionTime(category: FileCategory, fileCount: number): number {
    const baseTime: Record<FileCategory, number> = {
      "markup": 100,
      "interpreted": 2000,
      "compiled": 10000,
      "bytecode": 5000,
      "hardware": 15000,
      "data": 50,
      "style": 50,
      "config": 50,
      "media": 100,
      "document": 100,
      "build": 30000,
    };
    
    const multiplier = Math.max(1, Math.min(5, fileCount / 10));
    return baseTime[category] * multiplier;
  }
  
  private estimateCapacity(filePath: string, connectedFiles: string[], content: string): number {
    const fileSize = content.length + 1024; // Content + header overhead
    const connectedSize = connectedFiles.length * 100 * 1024; // Estimate 100KB per connected file
    const overhead = 1024 * 1024; // 1MB compilation overhead
    
    return fileSize + connectedSize + overhead;
  }
  
  getExtensionInfo(ext: string): { category: FileCategory; runtime?: string; isGUI?: boolean } | undefined {
    return EXTENSION_MAP[ext];
  }
  
  getAllSupportedExtensions(): string[] {
    return Object.keys(EXTENSION_MAP);
  }
}
