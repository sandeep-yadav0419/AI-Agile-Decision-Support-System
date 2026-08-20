import React, { useEffect, useState } from "react";
import {
  Check,
  Copy,
  History,
  KeyRound,
  LogOut,
  RefreshCw,
  Shield,
  ShieldCheck,
  User,
} from "lucide-react";
import { useAuth } from "../context/auth-context.js";
import {
  changePassword,
  describeError,
  disableMFA,
  enableMFA,
  getSecurityAuditLogs,
  regenerateRecoveryCodes,
  setupMFA,
  updateMyProfile,
} from "../services/api";
import { Modal } from "../components/ui/Modal.jsx";

const ROLES = [
  "Project Manager",
  "Developer",
  "Designer",
  "QA Engineer",
  "Business Analyst",
  "Scrum Master",
];

function Settings() {
  const { user, logout } = useAuth();

  // Profile Form
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [role, setRole] = useState(user?.role || "Developer");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Password Form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // MFA State
  const [isMfaEnabled, setIsMfaEnabled] = useState(user?.is_mfa_enabled || false);
  const [isMfaSetupOpen, setIsMfaSetupOpen] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState("");
  const [mfaSetupError, setMfaSetupError] = useState("");
  const [isEnablingMfa, setIsEnablingMfa] = useState(false);

  // Recovery Codes Modal
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Disable MFA Modal
  const [isDisableMfaOpen, setIsDisableMfaOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableMfaError, setDisableMfaError] = useState("");
  const [isDisablingMfa, setIsDisablingMfa] = useState(false);

  // Security Audit Logs
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchAuditLogs = async () => {
    try {
      setLoadingLogs(true);
      const data = await getSecurityAuditLogs(20);
      setAuditLogs(data || []);
    } catch (err) {
      console.error("Failed to load audit logs", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileSuccess("");
    setProfileError("");
    setIsUpdatingProfile(true);

    try {
      await updateMyProfile({ full_name: fullName, role });
      setProfileSuccess("Profile details updated successfully.");
    } catch (err) {
      setProfileError(describeError(err, "Failed to update profile"));
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordSuccess("");
    setPasswordError("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_new_password: confirmPassword,
      });
      setPasswordSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      fetchAuditLogs();
    } catch (err) {
      setPasswordError(describeError(err, "Failed to change password"));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Start MFA Setup Flow
  const handleOpenMfaSetup = async () => {
    setMfaSetupError("");
    setTotpVerifyCode("");
    try {
      const data = await setupMFA();
      setMfaSetupData(data);
      setIsMfaSetupOpen(true);
    } catch (err) {
      alert(describeError(err, "Failed to initiate MFA setup"));
    }
  };

  // Verify and Enable MFA
  const handleVerifyAndEnableMfa = async (e) => {
    e.preventDefault();
    if (!mfaSetupData || !totpVerifyCode) return;
    setMfaSetupError("");
    setIsEnablingMfa(true);

    try {
      const res = await enableMFA({
        secret: mfaSetupData.secret,
        totp_code: totpVerifyCode.trim(),
      });
      setIsMfaSetupOpen(false);
      setIsMfaEnabled(true);
      setRecoveryCodes(res.recovery_codes || []);
      setIsRecoveryModalOpen(true);
      fetchAuditLogs();
    } catch (err) {
      setMfaSetupError(describeError(err, "Invalid code. Please try again."));
    } finally {
      setIsEnablingMfa(false);
    }
  };

  // Regenerate Recovery Codes
  const handleRegenerateCodes = async () => {
    try {
      const res = await regenerateRecoveryCodes();
      setRecoveryCodes(res.recovery_codes || []);
      setIsRecoveryModalOpen(true);
      fetchAuditLogs();
    } catch (err) {
      alert(describeError(err, "Failed to regenerate recovery codes"));
    }
  };

  // Disable MFA
  const handleDisableMfaSubmit = async (e) => {
    e.preventDefault();
    setDisableMfaError("");
    setIsDisablingMfa(true);

    try {
      await disableMFA({ password: disablePassword });
      setIsDisableMfaOpen(false);
      setIsMfaEnabled(false);
      setDisablePassword("");
      fetchAuditLogs();
    } catch (err) {
      setDisableMfaError(describeError(err, "Failed to disable MFA"));
    } finally {
      setIsDisablingMfa(false);
    }
  };

  const handleCopyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Security & Account Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Manage your account security, multi-factor authentication (MFA), password credentials, and audit telemetry.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <div className="rounded-xl border border-line bg-surface p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <User size={18} className="text-signal" />
            <h2 className="text-sm font-semibold text-ink">User Profile</h2>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4 text-xs">
            <div>
              <label className="field-label">Email Address</label>
              <input
                type="email"
                disabled
                value={user?.email || ""}
                className="field-input cursor-not-allowed bg-canvas text-muted"
              />
              <span className="text-[10px] text-muted mt-1 block">
                Email identifier is verified and locked to your workspace.
              </span>
            </div>

            <div>
              <label className="field-label">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="field-input"
              />
            </div>

            <div>
              <label className="field-label">Primary Agile Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="field-input"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {profileSuccess && (
              <p className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
                {profileSuccess}
              </p>
            )}
            {profileError && (
              <p className="rounded-lg bg-critical-soft px-3 py-2 text-xs text-critical">
                {profileError}
              </p>
            )}

            <button
              type="submit"
              disabled={isUpdatingProfile}
              className="btn-primary w-full py-2"
            >
              {isUpdatingProfile ? "Saving..." : "Save Profile Details"}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="rounded-xl border border-line bg-surface p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <KeyRound size={18} className="text-signal" />
            <h2 className="text-sm font-semibold text-ink">Change Password</h2>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="field-label">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="field-input font-mono"
              />
            </div>

            <div>
              <label className="field-label">New Password (min 8 chars)</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="field-input font-mono"
              />
            </div>

            <div>
              <label className="field-label">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="field-input font-mono"
              />
            </div>

            {passwordSuccess && (
              <p className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
                {passwordSuccess}
              </p>
            )}
            {passwordError && (
              <p className="rounded-lg bg-critical-soft px-3 py-2 text-xs text-critical">
                {passwordError}
              </p>
            )}

            <button
              type="submit"
              disabled={isUpdatingPassword}
              className="btn-primary w-full py-2"
            >
              {isUpdatingPassword ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>

      {/* Two-Factor Authentication (MFA / TOTP) */}
      <div className="rounded-xl border border-line bg-surface p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-signal" />
            <div>
              <h2 className="text-sm font-semibold text-ink">Two-Factor Authentication (MFA)</h2>
              <p className="text-[11px] text-muted">
                Protect your account with standard TOTP authenticator apps (Google Authenticator, Authy, 1Password).
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold ${
              isMfaEnabled
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-canvas text-muted border border-line"
            }`}
          >
            {isMfaEnabled ? "ACTIVE (TOTP)" : "DISABLED"}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-canvas p-4 rounded-xl border border-line text-xs">
          <div className="space-y-1">
            <strong className="text-ink text-sm">
              {isMfaEnabled
                ? "Two-factor authentication is active on this account."
                : "MFA is currently not enabled."}
            </strong>
            <p className="text-muted text-[11px] leading-relaxed">
              {isMfaEnabled
                ? "When logging in, you will be prompted for a 6-digit TOTP code or single-use backup recovery code."
                : "Add a layer of security to prevent unauthorized access even if your password is compromised."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isMfaEnabled ? (
              <>
                <button
                  type="button"
                  onClick={handleRegenerateCodes}
                  className="btn-secondary py-1.5 px-3 text-xs"
                >
                  Regenerate Backup Codes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDisablePassword("");
                    setDisableMfaError("");
                    setIsDisableMfaOpen(true);
                  }}
                  className="rounded-lg border border-critical/30 bg-critical-soft px-3 py-1.5 text-xs font-semibold text-critical hover:bg-critical/15 transition"
                >
                  Disable 2FA
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleOpenMfaSetup}
                className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5 shadow-2xs"
              >
                <Shield size={14} /> Enable Two-Factor Auth
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Security Audit Trail */}
      <div className="rounded-xl border border-line bg-surface p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <History size={18} className="text-signal" />
            <h2 className="text-sm font-semibold text-ink">Security Audit History</h2>
          </div>
          <button
            type="button"
            onClick={fetchAuditLogs}
            disabled={loadingLogs}
            className="text-xs text-signal hover:underline flex items-center gap-1"
          >
            <RefreshCw size={12} className={loadingLogs ? "animate-spin" : ""} /> Refresh Logs
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line font-mono text-[10px] uppercase text-muted">
              <tr>
                <th className="py-2 px-3">Event</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">IP Address</th>
                <th className="py-2 px-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/50 font-mono text-[11px]">
              {auditLogs.length > 0 ? (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-canvas/50">
                    <td className="py-2.5 px-3 font-semibold text-ink">{log.event_type}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          log.status === "SUCCESS"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-muted">{log.ip_address || "Internal / Local"}</td>
                    <td className="py-2.5 px-3 text-muted">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted font-sans">
                    No recent security events recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-line text-xs">
          <span className="text-muted">
            Session Security: Signed JWT Bearer with HttpOnly cookie & Double-Submit CSRF protection.
          </span>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-critical hover:bg-critical-soft transition"
          >
            <LogOut size={14} /> End Session & Log Out
          </button>
        </div>
      </div>

      {/* MFA Setup Modal */}
      <Modal
        isOpen={isMfaSetupOpen}
        onClose={() => setIsMfaSetupOpen(false)}
        title="Setup Two-Factor Authentication"
      >
        {mfaSetupData && (
          <form onSubmit={handleVerifyAndEnableMfa} className="space-y-4 text-xs">
            <div className="text-center space-y-2">
              <p className="text-muted leading-relaxed">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):
              </p>
              <div className="flex justify-center p-3 bg-white rounded-xl border border-line w-fit mx-auto shadow-2xs">
                <img
                  src={mfaSetupData.qr_code_data_url}
                  alt="MFA QR Code"
                  className="h-44 w-44"
                />
              </div>
            </div>

            <div className="rounded-lg bg-canvas p-2.5 border border-line text-center space-y-1">
              <span className="text-[10px] text-muted uppercase font-mono block">
                Manual Entry Secret Key
              </span>
              <code className="font-mono text-xs font-bold text-signal select-all">
                {mfaSetupData.secret}
              </code>
            </div>

            <div>
              <label className="field-label text-center block">
                Enter the 6-digit code shown in your app to activate:
              </label>
              <input
                type="text"
                required
                autoFocus
                maxLength={6}
                pattern="[0-9]{6}"
                value={totpVerifyCode}
                onChange={(e) => setTotpVerifyCode(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="000000"
                className="field-input font-mono text-center text-lg font-bold tracking-widest max-w-[200px] mx-auto block"
              />
            </div>

            {mfaSetupError && (
              <p className="rounded-lg bg-critical-soft px-3 py-2 text-xs text-critical text-center">
                {mfaSetupError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setIsMfaSetupOpen(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isEnablingMfa || totpVerifyCode.length < 6}
                className="btn-primary"
              >
                {isEnablingMfa ? "Verifying..." : "Verify & Enable 2FA"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Recovery Codes Modal */}
      <Modal
        isOpen={isRecoveryModalOpen}
        onClose={() => setIsRecoveryModalOpen(false)}
        title="Backup Recovery Codes"
      >
        <div className="space-y-4 text-xs">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-900 leading-relaxed space-y-1">
            <strong className="block font-semibold">Important Security Notice:</strong>
            <p>
              Save these recovery codes in a safe place. If you ever lose access to your authenticator app, each code can be used exactly once to sign in.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 bg-canvas p-3 rounded-xl border border-line font-mono text-center text-xs font-bold text-ink">
            {recoveryCodes.map((code, idx) => (
              <div key={idx} className="p-1.5 bg-surface rounded border border-line">
                {code}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleCopyRecoveryCodes}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              {copiedCodes ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
              {copiedCodes ? "Copied to Clipboard!" : "Copy All Codes"}
            </button>

            <button
              type="button"
              onClick={() => setIsRecoveryModalOpen(false)}
              className="btn-primary text-xs"
            >
              I Have Saved My Codes
            </button>
          </div>
        </div>
      </Modal>

      {/* Disable MFA Modal */}
      <Modal
        isOpen={isDisableMfaOpen}
        onClose={() => setIsDisableMfaOpen(false)}
        title="Disable Two-Factor Authentication"
      >
        <form onSubmit={handleDisableMfaSubmit} className="space-y-4 text-xs">
          <p className="text-muted leading-relaxed">
            Please enter your account password to confirm disabling two-factor authentication.
          </p>

          <div>
            <label className="field-label">Account Password</label>
            <input
              type="password"
              required
              autoFocus
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              placeholder="••••••••"
              className="field-input font-mono"
            />
          </div>

          {disableMfaError && (
            <p className="rounded-lg bg-critical-soft px-3 py-2 text-xs text-critical">
              {disableMfaError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setIsDisableMfaOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDisablingMfa || !disablePassword}
              className="btn-critical"
            >
              {isDisablingMfa ? "Disabling..." : "Confirm & Disable 2FA"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Settings;
