const definitions = {
  python: { id: "python", label: "Python 3.11", image: "python:3.11-alpine", fileName: "main.py", command: ["python", "/workspace/main.py"] },
  node: { id: "node", label: "Node.js 20", image: "node:20-alpine", fileName: "main.mjs", command: ["node", "/workspace/main.mjs"] },
  bash: { id: "bash", label: "Bash 5", image: "bash:5.2", fileName: "main.sh", command: ["bash", "/workspace/main.sh"] },
  c: { id: "c", label: "C", image: "gcc:13", fileName: "main.c", command: ["sh", "-lc", "gcc /workspace/main.c -o /tmp/program && /tmp/program"] },
  cpp: { id: "cpp", label: "C++", image: "gcc:13", fileName: "main.cpp", command: ["sh", "-lc", "g++ /workspace/main.cpp -O2 -o /tmp/program && /tmp/program"] },
  java: { id: "java", label: "Java 21", image: "eclipse-temurin:21-jdk-alpine", fileName: "Main.java", command: ["sh", "-lc", "javac -d /tmp /workspace/Main.java && java -cp /tmp Main"] },
  go: { id: "go", label: "Go 1.22", image: "golang:1.22-alpine", fileName: "main.go", command: ["go", "run", "/workspace/main.go"] },
  rust: { id: "rust", label: "Rust 1.78", image: "rust:1.78-alpine", fileName: "main.rs", command: ["sh", "-lc", "rustc /workspace/main.rs -O -o /tmp/program && /tmp/program"] },
  php: { id: "php", label: "PHP 8.3", image: "php:8.3-cli-alpine", fileName: "main.php", command: ["php", "/workspace/main.php"] }
}

const aliases = { py: "python", python3: "python", js: "node", mjs: "node", cjs: "node", sh: "bash", shell: "bash", "c++": "cpp", cc: "cpp", rs: "rust" }

export function resolveRuntime(language) {
  const normalized = String(language || "").trim().toLowerCase()
  return definitions[aliases[normalized] || normalized]
}

export function publicRuntimes() {
  return Object.values(definitions).map(({ id, label }) => ({ id, label }))
}

export function sourceForRuntime(runtime, source) {
  if (runtime.id !== "java") return source
  return source.replace(/public\s+(?:(?:abstract|final)\s+)?class\s+[A-Za-z_$][\w$]*/, (declaration) => declaration.replace(/class\s+[A-Za-z_$][\w$]*/, "class Main"))
}
