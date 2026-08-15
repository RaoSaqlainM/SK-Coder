import { useState, useEffect, useRef } from "react"
import { useIDEStore } from "@/store/ideStore"

function getFileTemplate(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || ""
  switch (ext) {
    case "html":
    case "htm":
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name.replace(/\.[^.]+$/, "")}</title>
</head>
<body>

</body>
</html>`
    case "css":
      return `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  line-height: 1.6;
}
`
    case "scss":
    case "sass":
      return `// Variables
$primary: #007acc;
$bg: #ffffff;

body {
  font-family: system-ui, sans-serif;
  background: $bg;
}
`
    case "js":
    case "mjs":
      return `"use strict";

`
    case "jsx":
      return `export default function ${toPascalCase(name.replace(/\.[^.]+$/, ""))}() {
  return (
    <div>

    </div>
  )
}
`
    case "ts":
      return `export {}
`
    case "tsx":
      return `import { useState } from "react"

interface Props {}

export default function ${toPascalCase(name.replace(/\.[^.]+$/, ""))}({}: Props) {
  return (
    <div>

    </div>
  )
}
`
    case "py":
      return `def main():
    pass


if __name__ == "__main__":
    main()
`
    case "cpp":
    case "cc":
    case "cxx":
      return `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}
`
    case "c":
      return `#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}
`
    case "h":
      return `#pragma once

`
    case "java":
      return `public class ${toPascalCase(name.replace(/\.[^.]+$/, ""))} {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
`
    case "kt":
      return `fun main() {
    println("Hello, World!")
}
`
    case "rs":
      return `fn main() {
    println!("Hello, World!");
}
`
    case "go":
      return `package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}
`
    case "rb":
      return `puts "Hello, World!"
`
    case "php":
      return `<?php

echo "Hello, World!";
`
    case "swift":
      return `import Foundation

print("Hello, World!")
`
    case "dart":
      return `void main() {
  print('Hello, World!');
}
`
    case "sh":
    case "bash":
      return `#!/bin/bash

echo "Hello, World!"
`
    case "md":
    case "markdown":
      return `# ${name.replace(/\.[^.]+$/, "")}

`
    case "json":
      return `{

}
`
    case "yaml":
    case "yml":
      return `# ${name}

`
    case "xml":
      return `<?xml version="1.0" encoding="UTF-8"?>
<root>

</root>
`
    case "sql":
      return `-- SQL Query

SELECT * FROM table_name;
`
    case "env":
      return `# Environment Variables
# Do not commit this file to git

`
    case "gitignore":
      return `node_modules/
dist/
.env
.DS_Store
*.log
`
    default:
      return ""
  }
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "") || "Component"
}

const TEMPLATE_CHIPS: { ext: string; label: string; icon: string }[] = [
  { ext: "html", label: "HTML", icon: "#e34c26" },
  { ext: "css", label: "CSS", icon: "#264de4" },
  { ext: "js", label: "JS", icon: "#f7df1e" },
  { ext: "ts", label: "TS", icon: "#3178c6" },
  { ext: "tsx", label: "TSX", icon: "#61dafb" },
  { ext: "py", label: "Python", icon: "#3572a5" },
  { ext: "cpp", label: "C++", icon: "#00599c" },
  { ext: "java", label: "Java", icon: "#b07219" },
  { ext: "json", label: "JSON", icon: "#cbcb41" },
  { ext: "md", label: "MD", icon: "#083fa1" },
  { ext: "sh", label: "Shell", icon: "#4eaa25" },
  { ext: "php", label: "PHP", icon: "#4f5d95" },
]

export default function NewFileDialog() {
  const { newItemParentId, newItemType, setNewItem, addFile, fileTree } = useIDEStore()
  const [name, setName] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (newItemType) {
      setName("")
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [newItemType])

  if (!newItemType) return null

  function findParentPath(id: string | null, nodes: typeof fileTree): string {
    if (!id) return ""
    for (const n of nodes) {
      if (n.id === id) return n.path
      if (n.children) {
        const found = findParentPath(id, n.children)
        if (found) return found
      }
    }
    return ""
  }

  function handleConfirm() {
    const trimmed = name.trim()
    if (!trimmed) return
    const parentPath = findParentPath(newItemParentId, fileTree)
    const template = newItemType === "file" ? getFileTemplate(trimmed) : ""
    addFile(parentPath, trimmed, newItemType!, template)
    setNewItem(null, null)
    setName("")
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleConfirm()
    if (e.key === "Escape") { setNewItem(null, null); setName("") }
  }

  function handleChip(ext: string) {
    const base = name.split(".")[0] || (ext === "md" ? "README" : ext === "json" ? "config" : "index")
    setName(`${base}.${ext}`)
    inputRef.current?.focus()
  }

  return (
    <div className="new-file-dialog" onClick={() => setNewItem(null, null)}>
      <div className="new-file-dialog-box" onClick={(e) => e.stopPropagation()}>
        <div className="new-file-dialog-title">
          {newItemType === "file" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#e8a853" stroke="none" style={{ flexShrink: 0 }}>
              <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
            </svg>
          )}
          {newItemType === "file" ? "New File" : "New Folder"}
        </div>

        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={newItemType === "file" ? "filename.js" : "folder-name"}
          autoFocus
          style={{ marginBottom: "0.6rem" }}
        />

        {newItemType === "file" && (
          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>
              Quick select
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
              {TEMPLATE_CHIPS.map((chip) => (
                <button
                  key={chip.ext}
                  onClick={() => handleChip(chip.ext)}
                  style={{
                    padding: "0.15rem 0.5rem",
                    borderRadius: "10px",
                    fontSize: 11,
                    background: "var(--bg-hover)",
                    border: `1px solid var(--border)`,
                    color: chip.icon,
                    cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.borderColor = chip.icon }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.borderColor = "var(--border)" }}
                >
                  .{chip.ext}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="new-file-dialog-actions">
          <button className="btn btn-secondary" onClick={() => { setNewItem(null, null); setName("") }}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={!name.trim()}>
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
