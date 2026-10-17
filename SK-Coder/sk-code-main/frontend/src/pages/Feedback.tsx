import { useState } from "react";
import { Link } from "wouter";

const DESTINATION = "raosaqlaingee@gmail.com";

export default function FeedbackPage() {
    const requestedType = new URLSearchParams(window.location.search).get("type");
    const initialKind = requestedType === "bug" ? "Bug report" : requestedType === "feature" ? "Feature request" : "General feedback";
    const [kind, setKind] = useState<"Feature request" | "Bug report" | "General feedback">(initialKind);
    const [subject, setSubject] = useState("");
    const [replyTo, setReplyTo] = useState("");
    const [details, setDetails] = useState("");
    const [openedMail, setOpenedMail] = useState(false);
    function submit(event: React.FormEvent) {
        event.preventDefault();
        const body = [
            `Type: ${kind}`,
            replyTo.trim() ? `Reply-to email: ${replyTo.trim()}` : "Reply-to email: not supplied",
            "",
            details.trim(),
        ].join("\n");
        window.location.href = `mailto:${DESTINATION}?subject=${encodeURIComponent(`[SK Coder] ${kind}: ${subject.trim()}`)}&body=${encodeURIComponent(body)}`;
        setOpenedMail(true);
    }
    return <main style={{ minHeight: "100vh", background: "radial-gradient(circle at top right, rgba(88,166,255,0.13), transparent 34%), #0d1117", color: "#e6edf3", fontFamily: "var(--font-ui)", padding: "clamp(1rem, 4vw, 3rem)" }}>
      <div style={{ width: "min(760px, 100%)", margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", paddingBottom: "1.2rem", borderBottom: "1px solid #30363d" }}>
          <Link href="/" style={{ color: "#58a6ff", textDecoration: "none", fontWeight: 700 }}>← Back to SK Coder</Link>
          <nav style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }} aria-label="Information pages"><Link href="/guide" style={{ color: "#c9d1d9", textDecoration: "none", fontSize: 12 }}>User Manual</Link><Link href="/privacy" style={{ color: "#c9d1d9", textDecoration: "none", fontSize: 12 }}>Privacy</Link><Link href="/terms" style={{ color: "#c9d1d9", textDecoration: "none", fontSize: 12 }}>Terms</Link></nav>
        </header>
        <section style={{ padding: "clamp(2rem, 7vw, 4.5rem) 0 1.4rem" }}>
          <h1 style={{ margin: "0 0 0.7rem", fontSize: "clamp(2rem, 6vw, 3.4rem)", lineHeight: 1.06 }}>Request a Feature or Report a Bug</h1>
          <p style={{ maxWidth: 650, color: "#a7b0bc", lineHeight: 1.7, margin: 0 }}>Clear reports help prioritize practical improvements. Include what you expected, what happened, and the steps needed to repeat a problem. Your email app will open with this report addressed to the SK Coder contact.</p>
        </section>
        <form onSubmit={submit} style={{ display: "grid", gap: "1rem", padding: "clamp(1rem, 4vw, 1.6rem)", border: "1px solid #30363d", borderRadius: 16, background: "rgba(22,27,34,0.92)", boxShadow: "0 24px 70px rgba(0,0,0,0.24)" }}>
          <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 700 }}>What would you like to share?<select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} style={{ minHeight: 42, padding: "0 0.7rem", borderRadius: 8, border: "1px solid #3a4654", background: "#0d1117", color: "#e6edf3", font: "inherit" }}><option>Feature request</option><option>Bug report</option><option>General feedback</option></select></label>
          <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 700 }}>Short title<input required value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={140} placeholder="Example: Import progress does not update for a large folder" style={{ minHeight: 42, padding: "0 0.7rem", borderRadius: 8, border: "1px solid #3a4654", background: "#0d1117", color: "#e6edf3", font: "inherit" }}/></label>
          <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 700 }}>Your email <span style={{ fontWeight: 400, color: "#8b949e" }}>(optional, for a reply)</span><input type="email" value={replyTo} onChange={(event) => setReplyTo(event.target.value)} placeholder="you@example.com" style={{ minHeight: 42, padding: "0 0.7rem", borderRadius: 8, border: "1px solid #3a4654", background: "#0d1117", color: "#e6edf3", font: "inherit" }}/></label>
          <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 700 }}>Details<textarea required value={details} onChange={(event) => setDetails(event.target.value)} minLength={20} maxLength={6000} rows={8} placeholder="Describe the issue or idea. For a bug, include the file type, the action you chose, what you expected, and what you saw." style={{ resize: "vertical", minHeight: 160, padding: "0.7rem", borderRadius: 8, border: "1px solid #3a4654", background: "#0d1117", color: "#e6edf3", font: "inherit", lineHeight: 1.55 }}/></label>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", paddingTop: "0.25rem" }}><span style={{ color: "#8b949e", fontSize: 12 }}>Addressed to {DESTINATION}</span><button type="submit" style={{ minHeight: 42, padding: "0 1rem", border: 0, borderRadius: 8, background: "#58a6ff", color: "#0d1117", font: "inherit", fontWeight: 800, cursor: "pointer" }}>Open email to send</button></div>
          {openedMail && <div role="status" style={{ padding: "0.7rem 0.8rem", borderRadius: 8, color: "#b7efc5", background: "rgba(46,160,67,0.13)", border: "1px solid rgba(46,160,67,0.34)", fontSize: 12 }}>Your email application was opened with the report addressed to {DESTINATION}. Review it and choose Send in your mail application.</div>}
        </form>
      </div>
    </main>;
}
