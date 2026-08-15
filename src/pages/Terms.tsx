import { useLocation } from "wouter"

export default function TermsPage() {
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

        <h1>Terms of Service</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>Last updated: May 2026</p>

        <h2>Acceptance</h2>
        <p>By using SK Coder, you agree to these terms. If you do not agree, please stop using the application.</p>

        <h2>License</h2>
        <p>SK Coder is made available for personal and commercial use. You may use it to write, run, and export code freely.</p>

        <h2>Acceptable Use</h2>
        <p>You agree not to use SK Coder to:</p>
        <ul>
          <li>Violate any applicable laws or regulations</li>
          <li>Infringe on intellectual property rights</li>
          <li>Create malicious software or code intended to harm others</li>
          <li>Circumvent security features of third-party services</li>
        </ul>

        <h2>Third-Party Services</h2>
        <p>
          SK Coder integrates with third-party services (AI providers, GitHub, Piston). Your use of those services is subject to their own terms of service. SK Coder is not responsible for actions taken by those services.
        </p>

        <h2>No Warranty</h2>
        <p>
          SK Coder is provided "as is" without warranty of any kind. The developer makes no guarantees about availability, accuracy, or fitness for any particular purpose. Use at your own risk.
        </p>

        <h2>Limitation of Liability</h2>
        <p>
          The developer of SK Coder shall not be liable for any damages arising from your use of the application, including but not limited to loss of data, loss of profits, or service interruptions.
        </p>

        <h2>Your Responsibility</h2>
        <p>
          You are responsible for all code you write and run using SK Coder. You are also responsible for securing your API keys and GitHub tokens.
        </p>

        <h2>Changes</h2>
        <p>These terms may be updated at any time. Continued use of SK Coder after updates constitutes acceptance of the new terms.</p>

        <h2>Contact</h2>
        <p>For questions about these terms, use the AI assistant in SK Coder or open an issue on the project's GitHub page.</p>
      </div>
    </div>
  )
}
