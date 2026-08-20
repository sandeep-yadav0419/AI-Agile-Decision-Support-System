import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import AuthShell from "../components/AuthShell.jsx";
import { useAuth } from "../context/auth-context.js";
import { describeError } from "../services/api";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || "";

function Login() {
  const { login, completeMFALogin, loginWithGoogle, loginWithGitHub } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  // MFA Challenge State
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaTicket, setMfaTicket] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

  // Check for GitHub OAuth callback code in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.history.replaceState({}, document.title, window.location.pathname);
      handleGitHubCode(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGitHubCode(code) {
    setError("");
    setOauthLoading(true);
    try {
      await loginWithGitHub({ code });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(describeError(err, "GitHub authentication failed on server."));
    } finally {
      setOauthLoading(false);
    }
  }

  function handleGitHubClick() {
    setError("");
    if (!GITHUB_CLIENT_ID) return;
    const redirectUri = window.location.origin + "/login";
    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=read:user,user:email`;
    window.location.href = githubUrl;
  }

  // Initialize Google Identity Services (GIS)
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGoogleCredentialResponse(response) {
    if (!response.credential) return;
    setError("");
    setOauthLoading(true);
    try {
      await loginWithGoogle({ id_token: response.credential });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(describeError(err, "Google sign-in verification failed on server."));
    } finally {
      setOauthLoading(false);
    }
  }

  function handleGoogleClick() {
    setError("");
    if (!GOOGLE_CLIENT_ID) return;

    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          try {
            const client = window.google.accounts.oauth2.initTokenClient({
              client_id: GOOGLE_CLIENT_ID,
              scope: "email profile openid",
              callback: async (tokenResponse) => {
                if (tokenResponse?.access_token) {
                  setOauthLoading(true);
                  try {
                    await loginWithGoogle({
                      id_token: tokenResponse.id_token || tokenResponse.access_token,
                    });
                    navigate(redirectTo, { replace: true });
                  } catch (err) {
                    setError(describeError(err, "Google authentication failed."));
                  } finally {
                    setOauthLoading(false);
                  }
                }
              },
            });
            client.requestAccessToken();
          } catch (e) {
            console.error("GIS fallback error:", e);
          }
        }
      });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      if (result?.mfa_required) {
        setMfaTicket(result.mfa_ticket);
        setMfaRequired(true);
      } else {
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      setError(describeError(err, "Could not sign in. Check your details and try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMFASubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await completeMFALogin({
        mfa_ticket: mfaTicket,
        totp_code: !useRecoveryCode ? totpCode.trim() : undefined,
        recovery_code: useRecoveryCode ? recoveryCode.trim() : undefined,
      });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(describeError(err, "Invalid two-factor authentication code or recovery code."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="rounded-2xl border border-line bg-surface p-8 sm:p-10 shadow-xs">
        {/* MFA Challenge Screen */}
        {mfaRequired ? (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-md bg-signal-soft px-2.5 py-1 font-mono text-[11px] font-semibold text-signal uppercase tracking-wider">
                <ShieldCheck size={13} /> Two-Factor Verification
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-ink">Security Challenge</h1>
              <p className="text-xs text-muted leading-relaxed">
                {useRecoveryCode
                  ? "Enter one of your 8-character backup recovery codes."
                  : "Enter the 6-digit security code generated by your authenticator app."}
              </p>
            </div>

            <form onSubmit={handleMFASubmit} className="space-y-4">
              {!useRecoveryCode ? (
                <div>
                  <label className="field-label flex items-center gap-1.5 text-xs font-semibold">
                    <KeyRound size={13} className="text-signal" /> 6-Digit Authenticator Code
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={7}
                    pattern="[0-9]{6}"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="000000"
                    className="field-input font-mono text-center text-lg tracking-widest font-bold"
                  />
                </div>
              ) : (
                <div>
                  <label className="field-label flex items-center gap-1.5 text-xs font-semibold">
                    <KeyRound size={13} className="text-signal" /> Backup Recovery Code
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                    placeholder="XXXX-XXXX"
                    className="field-input font-mono text-center text-base tracking-wider font-semibold"
                  />
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-900 leading-relaxed animate-fadeIn">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || (!useRecoveryCode ? totpCode.length < 6 : !recoveryCode.trim())}
                className="btn-primary w-full py-2.5 text-xs font-semibold tracking-wide shadow-xs"
              >
                {isSubmitting ? "Verifying Token..." : "Verify & Enter Workspace"}
              </button>

              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setUseRecoveryCode(!useRecoveryCode);
                    setError("");
                  }}
                  className="text-signal hover:underline font-medium"
                >
                  {useRecoveryCode ? "Use Authenticator app code" : "Use a backup recovery code"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMfaRequired(false);
                    setTotpCode("");
                    setRecoveryCode("");
                    setError("");
                  }}
                  className="text-muted hover:text-ink flex items-center gap-1"
                >
                  <ArrowLeft size={12} /> Back
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Standard Login Screen */
          <>
            {/* Header Badge & Title */}
            <div className="space-y-2 mb-8">
              <div className="inline-flex items-center gap-1.5 rounded-md bg-signal-soft px-2.5 py-1 font-mono text-[11px] font-semibold text-signal uppercase tracking-wider">
                <Sparkles size={12} />
                AI-DSS Workspace
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-ink">Welcome back</h1>
              <p className="text-xs text-muted">
                Enter your account credentials to access your agile project workspace.
              </p>
            </div>

            <div className="space-y-5">
              {/* OAuth Buttons (Google & GitHub) */}
              {GOOGLE_CLIENT_ID || GITHUB_CLIENT_ID ? (
                <div className="space-y-2.5">
                  {GOOGLE_CLIENT_ID && (
                    <button
                      type="button"
                      onClick={handleGoogleClick}
                      disabled={oauthLoading || isSubmitting}
                      className="flex w-full items-center justify-center gap-3 rounded-lg border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink shadow-2xs transition hover:bg-canvas active:bg-line/40 disabled:opacity-50"
                    >
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>{oauthLoading ? "Authenticating..." : "Continue with Google"}</span>
                    </button>
                  )}

                  {GITHUB_CLIENT_ID && (
                    <button
                      type="button"
                      onClick={handleGitHubClick}
                      disabled={oauthLoading || isSubmitting}
                      className="flex w-full items-center justify-center gap-3 rounded-lg border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink shadow-2xs transition hover:bg-canvas active:bg-line/40 disabled:opacity-50"
                    >
                      <svg className="h-4 w-4 shrink-0 fill-current" viewBox="0 0 24 24">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                      </svg>
                      <span>{oauthLoading ? "Connecting to GitHub..." : "Continue with GitHub"}</span>
                    </button>
                  )}

                  <div className="relative flex items-center justify-center my-4">
                    <div className="w-full border-t border-line" />
                    <span className="bg-surface px-3 text-[11px] font-medium text-muted uppercase tracking-wider whitespace-nowrap">
                      or continue with email
                    </span>
                    <div className="w-full border-t border-line" />
                  </div>
                </div>
              ) : null}

              {/* Email / Password Form */}
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="email" className="field-label flex items-center gap-1.5 text-xs font-semibold">
                    <Mail size={13} className="text-muted" />
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="field-input text-xs"
                    placeholder="developer@company.com"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="field-label mb-0 flex items-center gap-1.5 text-xs font-semibold">
                      <Lock size={13} className="text-muted" />
                      Password
                    </label>
                    <Link
                      to="/register"
                      className="text-[11px] font-medium text-muted hover:text-signal transition"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="field-input pr-10 text-xs font-mono"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-muted hover:text-ink transition"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-900 leading-relaxed animate-fadeIn">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || oauthLoading}
                  className="btn-primary w-full py-2.5 text-xs font-semibold tracking-wide shadow-xs"
                >
                  {isSubmitting ? "Signing in to workspace…" : "Sign in to Dashboard"}
                </button>
              </form>
            </div>

            {/* Footer Link */}
            <div className="mt-8 pt-6 border-t border-line text-center text-xs text-muted">
              Don&rsquo;t have an account?{" "}
              <Link to="/register" className="font-semibold text-ink hover:text-signal underline underline-offset-4 transition">
                Create account
              </Link>
            </div>
          </>
        )}
      </div>
    </AuthShell>
  );
}

export default Login;
