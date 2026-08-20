import { Navigate } from "react-router-dom";
import { useAuth } from "../context/auth-context.js";

/** Wrap /login and /register with this so a signed-in user is bounced to "/". */
function RedirectIfAuthed({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;

  return children;
}

export default RedirectIfAuthed;
