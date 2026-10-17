import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const { login, loading, error } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("Admin-SK");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    await login(username, password, rememberMe);

    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect") || "/";
    setLocation(redirect);
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      fontFamily: "var(--font-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
      padding: "1rem",
    }}>
      <div style={{
        background: "var(--bg-primary, #1e1e2e)",
        borderRadius: "16px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        maxWidth: "420px",
        width: "100%",
        padding: "2.5rem",
      }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            fontSize: "2.5rem",
            fontWeight: "700",
            color: "var(--accent, #cba6f7)",
            marginBottom: "0.5rem",
          }}>
            SK-Coder
          </div>
          <div style={{
            fontSize: "0.9rem",
            color: "var(--text-muted, #a6adc8)",
          }}>
            Administration Portal
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: "500",
              color: "var(--text-primary, #cdd6f4)",
              marginBottom: "0.5rem",
            }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              readOnly
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                fontSize: "0.95rem",
                background: "var(--bg-secondary, #181825)",
                border: "1px solid var(--border, #313244)",
                borderRadius: "8px",
                color: "var(--text-muted, #a6adc8)",
                outline: "none",
                cursor: "not-allowed",
              }}
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: "500",
              color: "var(--text-primary, #cdd6f4)",
              marginBottom: "0.5rem",
            }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoFocus
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  paddingRight: "3rem",
                  fontSize: "0.95rem",
                  background: "var(--bg-secondary, #181825)",
                  border: "1px solid var(--border, #313244)",
                  borderRadius: "8px",
                  color: "var(--text-primary, #cdd6f4)",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "var(--text-muted, #a6adc8)",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                }}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              cursor: "pointer",
            }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{
                  width: "1.1rem",
                  height: "1.1rem",
                  cursor: "pointer",
                }}
              />
              <span style={{
                fontSize: "0.9rem",
                color: "var(--text-primary, #cdd6f4)",
              }}>
                Remember me for 7 days
              </span>
            </label>
          </div>

          {(error || submitError) && (
            <div style={{
              padding: "0.75rem 1rem",
              marginBottom: "1.5rem",
              background: "rgba(243, 139, 168, 0.1)",
              border: "1px solid rgba(243, 139, 168, 0.3)",
              borderRadius: "8px",
              color: "#f38ba8",
              fontSize: "0.9rem",
            }}>
              {error || submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.85rem",
              fontSize: "1rem",
              fontWeight: "600",
              background: loading
                ? "var(--bg-secondary, #181825)"
                : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              border: "none",
              borderRadius: "8px",
              color: "white",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              transition: "all 0.2s",
            }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div style={{
          marginTop: "2rem",
          paddingTop: "1.5rem",
          borderTop: "1px solid var(--border, #313244)",
          textAlign: "center",
        }}>
          <div style={{
            fontSize: "0.85rem",
            color: "var(--text-muted, #a6adc8)",
            marginBottom: "0.5rem",
          }}>
            Secure admin access
          </div>
          <div style={{
            fontSize: "0.75rem",
            color: "var(--text-muted, #a6adc8)",
          }}>
            Session-based authentication with JWT
          </div>
        </div>
      </div>
    </div>
  );
}
