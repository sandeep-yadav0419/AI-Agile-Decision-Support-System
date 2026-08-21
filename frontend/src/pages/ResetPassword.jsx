import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthShell from "../components/AuthShell.jsx";
import { describeError, resetPassword } from "../services/api.js";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const token = params.get("token") || "";

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ token, new_password: password, confirm_new_password: confirmPassword });
      navigate("/login", { replace: true, state: { passwordReset: true } });
    } catch (err) {
      setError(describeError(err, "Unable to reset password."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="rounded-2xl border border-line bg-surface p-8 sm:p-10 shadow-xs">
        <h1 className="text-2xl font-bold text-ink">Choose a new password</h1>
        {!token ? (
          <p className="mt-4 text-xs text-rose-800">This reset link is incomplete or invalid.</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <input className="field-input" type="password" minLength="8" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" />
            <input className="field-input" type="password" minLength="8" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
            {error && <p className="text-xs text-rose-800">{error}</p>}
            <button className="btn-primary w-full py-2.5" disabled={loading} type="submit">{loading ? "Resetting…" : "Reset password"}</button>
          </form>
        )}
        <Link className="mt-6 block text-center text-xs text-muted underline" to="/login">Back to sign in</Link>
      </div>
    </AuthShell>
  );
}
