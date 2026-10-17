import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export function PrivateRoute({ component: Component, path }: { component: React.ComponentType; path: string }) {
  const { isAuthenticated, loading } = useAuth();
  const [match] = useRoute(path);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated && match) {
      setLocation("/login?redirect=" + encodeURIComponent(location));
    }
  }, [loading, isAuthenticated, match, location, setLocation]);

  if (!match) return null;
  if (loading) return <div style={{ padding: "2rem", textAlign: "center" }}>Loading...</div>;
  if (!isAuthenticated) return null;

  return <Component />;
}
