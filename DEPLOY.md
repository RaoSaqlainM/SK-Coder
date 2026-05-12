# SK Coder v2.0 — Deployment Guide

## Deploy Web App to Vercel (5 minutes)

1. Extract SK-Coder-WebApp-v4.zip
2. Open terminal in the folder
3. Run:
   npm install
   npm run build
   npx vercel --prod

4. Copy your Vercel URL (e.g. https://sk-coder-abc.vercel.app)
5. Open the APK folder → lib/main.dart
6. Replace _url with your Vercel URL
7. Build the APK

## Add Your API Key

Open the deployed app → Settings → AI Assistant
Paste any key — Groq (free), Gemini, or OpenRouter
Get a free Groq key: https://console.groq.com

## What Works

Editor:
- Monaco Editor (VS Code engine)
- 40+ languages with syntax highlighting
- Auto-save, find/replace, multiple tabs

File Management:
- Single Open button → picks files, folders, or ZIPs
- ZIP auto-extraction preserving folder structure
- Workspace saved across sessions (IndexedDB)
- Download project as ZIP

Running Code:
- HTML/CSS/JS → live preview with inlined assets
- Python → Pyodide (in-browser) + cloud fallback
- JavaScript → in-browser sandbox + cloud
- C/C++/Go/Rust/Java/C#/PHP/Ruby/Kotlin → cloud runner (Piston)
- Right-click any file/folder → Run or Preview

Terminals:
- Shell, Python, JS, Node.js, Bash, C/C++, Git Bash, Kali
- Cloud Shell → GitHub Codespaces (requires GitHub account)
- Termux → real npm/python/gcc on Android (requires Termux app)

AI:
- Works without a key (built-in fallback)
- Add your own key for unlimited chat
- Detect Issues, Fix by AI, Explain, Analyze Project
- Chat unlocks after adding API key

## What Requires External Setup

npm run dev / React / Next.js servers:
  These need a real Node.js environment.
  Option A: GitHub Codespaces (Cloud Shell tab in Terminal)
  Option B: Termux on Android (Terminal → Termux tab)
  Option C: Export ZIP → run locally on PC

SD Card / USB Storage:
  On Android, use the Termux app which can access SD card paths.
  The web app stores workspace in browser IndexedDB.
  For true external storage, build via Capacitor (see capacitor docs).
