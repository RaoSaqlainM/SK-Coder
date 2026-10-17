import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import type { AuthState, AuthUser, LoginRequest, LoginResponse } from "@/types/auth";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

interface AuthContextValue extends AuthState {
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true,
    error: null,
  });

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        credentials: "include",
      });

      if (response.ok) {
        const user: AuthUser = await response.json();
        setState({ isAuthenticated: true, user, loading: false, error: null });
      } else {
        setState({ isAuthenticated: false, user: null, loading: false, error: null });
      }
    } catch (error) {
      setState({ isAuthenticated: false, user: null, loading: false, error: null });
    }
  };

  const login = async (username: string, password: string, rememberMe = true) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password, rememberMe } as LoginRequest),
      });

      const data: LoginResponse = await response.json();

      if (data.success && data.user) {
        setState({
          isAuthenticated: true,
          user: data.user,
          loading: false,
          error: null,
        });
      } else {
        setState({
          isAuthenticated: false,
          user: null,
          loading: false,
          error: data.error || "Login failed",
        });
      }
    } catch (error) {
      setState({
        isAuthenticated: false,
        user: null,
        loading: false,
        error: "Network error. Please try again.",
      });
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      // Ignore logout errors
    }

    setState({ isAuthenticated: false, user: null, loading: false, error: null });
  };

  useEffect(() => {
    void checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
