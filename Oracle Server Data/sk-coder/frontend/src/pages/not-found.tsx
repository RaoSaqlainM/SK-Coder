import { useLocation } from "wouter";
export default function NotFound() {
    const [, navigate] = useLocation();
    return (<div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            height: "100dvh", background: "var(--bg-base)", color: "var(--text-primary)",
            fontFamily: "var(--font-ui)", padding: "2rem", gap: "1.5rem", textAlign: "center",
        }}>
      <div style={{ width: 120, height: 120, borderRadius: 24, display: "grid", placeItems: "center", background: "rgba(203,166,247,0.18)", boxShadow: "0 0 24px rgba(203,166,247,0.35)", color: "var(--accent)" }}>
        <svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3c-4.4 0-8 3.6-8 8v2.5c0 1.2.5 2.4 1.4 3.2l.7.6v2.7h12.8v-2.7l.7-.6c.9-.8 1.4-2 1.4-3.2V11c0-4.4-3.6-8-8-8Z"/>
          <path d="M9 10h.01M15 10h.01"/>
          <path d="M9 15h6"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, background: "linear-gradient(135deg, #cba6f7, #89b4fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>404</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginTop: "0.5rem" }}>Workspace Not Found</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: "0.4rem", maxWidth: 280 }}>
          The page you're looking for doesn't exist or has been moved.
        </div>
      </div>
      <button onClick={() => navigate("/")} style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.5rem 1.25rem", borderRadius: "var(--radius)",
            background: "var(--accent)", color: "white",
            fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500,
            border: "none", cursor: "pointer", transition: "background 0.12s ease",
        }} onMouseEnter={e => (e.currentTarget.style.background = "var(--accent-hover)")} onMouseLeave={e => (e.currentTarget.style.background = "var(--accent)")}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back to SK Coder
      </button>
    </div>);
}
