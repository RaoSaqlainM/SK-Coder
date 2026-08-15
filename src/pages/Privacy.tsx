import { useLocation } from "wouter"

export default function PrivacyPage() {
  const [, navigate] = useLocation()

  return (
    <div className="page-layout">
      <div className="page-content">
        <button className="page-back" onClick={() => navigate("/")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to SK Coder
        </button>

        <h1>Privacy Policy</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>Last updated: May 2026</p>

        <h2>Overview</h2>
        <p>
          SK Coder is a browser-based IDE built by Saqlain King. Your privacy is important. This policy explains what data is stored and how it's used.
        </p>

        <h2>Data Storage</h2>
        <p>
          All your project files and settings are stored <strong>locally in your browser</strong> using localStorage. Your code never leaves your device unless you explicitly use a feature that requires a network call (AI assistant, Piston code runner, GitHub Codespaces).
        </p>
        <ul>
          <li>File contents are saved with the key prefix <code style={{ color: "var(--orange)" }}>sk-file:</code> in localStorage</li>
          <li>Settings (including API keys) are encrypted in localStorage under <code style={{ color: "var(--orange)" }}>sk-coder-ide-v2</code></li>
          <li>No accounts, no sign-in, no servers storing your data</li>
        </ul>

        <h2>API Keys</h2>
        <p>
          If you add an AI API key, it is stored only in your browser's localStorage. It is never sent to any server other than the AI provider you chose when making AI requests.
        </p>

        <h2>Third-Party Services</h2>
        <p>SK Coder may make requests to the following third-party services based on your actions:</p>
        <ul>
          <li><strong>Your AI provider</strong> — only when you send a chat message. Subject to the provider's own privacy policy.</li>
          <li><strong>Piston API (emkc.org)</strong> — only when you run C++/Java/Rust/Go code. Only the code you submit is sent.</li>
          <li><strong>GitHub API</strong> — only when you connect a GitHub token and use SK Git.</li>
          <li><strong>Pyodide CDN (jsDelivr)</strong> — the Python runtime is downloaded from a CDN on first use.</li>
        </ul>

        <h2>Analytics</h2>
        <p>SK Coder does not use any analytics, tracking pixels, or telemetry of any kind.</p>

        <h2>Children's Privacy</h2>
        <p>SK Coder does not knowingly collect personal data from children under 13.</p>

        <h2>Changes</h2>
        <p>If this policy changes, the updated version will be posted at this URL with a new date.</p>

        <h2>Contact</h2>
        <p>Questions about this policy? Open the AI assistant in SK Coder and ask, or reach out through the project's GitHub page.</p>
      </div>
    </div>
  )
}
