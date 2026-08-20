import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth-context.js";

/** Wrap a protected page with this. Redirects to /login if not signed in. */
function RequireAuth({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

export default RequireAuth;
