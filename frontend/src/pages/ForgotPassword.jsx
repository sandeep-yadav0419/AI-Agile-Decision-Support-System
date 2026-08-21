import { useState } from "react";
import { Link } from "react-router-dom";
import AuthShell from "../components/AuthShell.jsx";
import { describeError, requestPasswordReset } from "../services/api.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setResetUrl("");
    try {
      const result = await requestPasswordReset(email.trim());
      setMessage(result.message);
      if (result.reset_token) {
        setResetUrl(`/reset-password?token=${encodeURIComponent(result.reset_token)}`);
      }
    } catch (error) {
      setMessage(describeError(error, "Unable to start password reset."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="rounded-2xl border border-line bg-surface p-8 sm:p-10 shadow-xs">
        <h1 className="text-2xl font-bold text-ink">Reset your password</h1>
        <p className="mt-2 text-xs text-muted">Enter your account email to request a short-lived reset link.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input className="field-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <button className="btn-primary w-full py-2.5" disabled={loading} type="submit">
            {loading ? "Preparing reset…" : "Request reset link"}
          </button>
        </form>
        {message && <p className="mt-4 rounded-lg border border-line bg-canvas p-3 text-xs text-ink">{message}</p>}
        {resetUrl && <Link className="mt-3 block text-xs font-semibold text-signal underline" to={resetUrl}>Continue with development reset link</Link>}
        <Link className="mt-6 block text-center text-xs text-muted underline" to="/login">Back to sign in</Link>
      </div>
    </AuthShell>
  );
}
