import { useEffect, useMemo, useState } from "react";
import api, {
  googleLogin,
  logoutAuth,
  setAuthToken,
  setCsrfToken,
  setUnauthorizedHandler,
  verifyMFALogin,
} from "../services/api";
import { AuthContext } from "./auth-context.js";

const TOKEN_KEY = "aidss_token";
const USER_KEY = "aidss_user";

function readStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(readStoredUser);
  const [isLoading, setIsLoading] = useState(() => !!localStorage.getItem(TOKEN_KEY));

  function persistSession(nextToken, nextUser, nextCsrf) {
    if (nextToken) {
      localStorage.setItem(TOKEN_KEY, nextToken);
      setAuthToken(nextToken);
      setToken(nextToken);
    }
    if (nextUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
    }
    if (nextCsrf) {
      setCsrfToken(nextCsrf);
    }
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setAuthToken(null);
    setCsrfToken(null);
    setToken(null);
    setUser(null);
  }

  useEffect(() => {
    setUnauthorizedHandler(clearSession);

    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    setAuthToken(storedToken);
    api
      .get("/api/auth/me")
      .then(({ data }) => {
        setUser(data);
        localStorage.setItem(USER_KEY, JSON.stringify(data));
      })
      .catch(() => {
        clearSession();
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email, password) {
    const { data } = await api.post("/api/auth/login", { email, password });
    if (data.mfa_required) {
      return data;
    }
    persistSession(data.access_token, data.user, data.csrf_token);
    return data;
  }

  async function completeMFALogin(payload) {
    const data = await verifyMFALogin(payload);
    persistSession(data.access_token, data.user, data.csrf_token);
    return data.user;
  }

  async function register(email, password, fullName, confirmPassword) {
    const { data } = await api.post("/api/auth/register", {
      email,
      password,
      confirm_password: confirmPassword,
      full_name: fullName,
    });
    persistSession(data.access_token, data.user, data.csrf_token);
    return data.user;
  }

  async function loginWithGoogle(payload) {
    const data = await googleLogin(payload);
    persistSession(data.access_token, data.user, data.csrf_token);
    return data.user;
  }

  async function loginWithGitHub(payload) {
    const { data } = await api.post("/api/auth/github", payload);
    persistSession(data.access_token, data.user, data.csrf_token);
    return data.user;
  }

  async function logout() {
    try {
      await logoutAuth();
    } catch {
      // ignore
    } finally {
      clearSession();
    }
  }

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: !!token,
      login,
      completeMFALogin,
      register,
      loginWithGoogle,
      loginWithGitHub,
      logout,
    }),
    [user, token, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
