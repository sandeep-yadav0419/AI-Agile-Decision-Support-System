import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, Sparkles, User } from "lucide-react";
import AuthShell from "../components/AuthShell.jsx";
import { useAuth } from "../context/auth-context.js";
import { describeError } from "../services/api";

function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email.trim(), password, fullName.trim());
      navigate("/", { replace: true });
    } catch (err) {
      setError(describeError(err, "Could not create your account."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="rounded-2xl border border-line bg-surface p-8 sm:p-10 shadow-xs">
        {/* Header Badge & Title */}
        <div className="space-y-2 mb-6">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-signal-soft px-2.5 py-1 font-mono text-[11px] font-semibold text-signal uppercase tracking-wider">
            <Sparkles size={12} />
            Workspace Onboarding
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Create an account</h1>
          <p className="text-xs text-muted">
            Start tracking sprints, predicting delivery risk, and optimizing workload.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="fullName" className="field-label flex items-center gap-1.5 text-xs font-semibold">
              <User size={13} className="text-muted" />
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              required
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="field-input text-xs"
              placeholder="Alex Morgan"
            />
          </div>

          <div>
            <label htmlFor="email" className="field-label flex items-center gap-1.5 text-xs font-semibold">
              <Mail size={13} className="text-muted" />
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field-input text-xs"
              placeholder="alex@company.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="field-label flex items-center gap-1.5 text-xs font-semibold">
              <Lock size={13} className="text-muted" />
              Password (min 8 characters)
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="field-input pr-10 text-xs font-mono"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-muted hover:text-ink transition"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="field-label flex items-center gap-1.5 text-xs font-semibold">
              <Lock size={13} className="text-muted" />
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="field-input text-xs font-mono"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-900 leading-relaxed animate-fadeIn">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full py-2.5 text-xs font-semibold tracking-wide shadow-xs"
          >
            {isSubmitting ? "Creating workspace account…" : "Create account & Get started"}
          </button>
        </form>

        {/* Footer Link */}
        <div className="mt-8 pt-6 border-t border-line text-center text-xs text-muted">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-ink hover:text-signal underline underline-offset-4 transition">
            Sign in
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}

export default Register;
