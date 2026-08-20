import { useState } from "react";
import { AlertCircle, CheckCircle2, MessageSquareText, Sparkles, X } from "lucide-react";
import { submitCheckIn, describeError } from "../services/api";
import { useProject } from "../context/project-context.js";

export function CheckInModal({ isOpen, onClose, onCheckInComplete }) {
  const { projects, activeProjectId } = useProject();
  const defaultProjectId = activeProjectId !== "All" ? activeProjectId : (projects[0]?.id || "");

  const [projectId, setProjectId] = useState(defaultProjectId);
  const [completedToday, setCompletedToday] = useState("");
  const [workingOn, setWorkingOn] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockerDescription, setBlockerDescription] = useState("");
  const [estimatedCompletion, setEstimatedCompletion] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!projectId) {
      setError("Please select an active project for your check-in.");
      return;
    }
    setError("");
    setIsSubmitting(true);

    try {
      await submitCheckIn({
        project_id: Number(projectId),
        completed_today: completedToday,
        working_on: workingOn,
        is_blocked: isBlocked,
        blocker_description: isBlocked ? blockerDescription : null,
        estimated_completion: estimatedCompletion || null,
        notes: notes || null,
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        if (onCheckInComplete) onCheckInComplete();
      }, 1200);
    } catch (err) {
      setError(describeError(err, "Failed to submit daily check-in"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <MessageSquareText size={18} className="text-signal" />
            <h3 className="text-base font-semibold text-ink">Daily Agile Check-In</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-canvas hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 size={40} className="mx-auto text-signal animate-bounce" />
            <h4 className="text-base font-semibold text-ink">Check-In Logged!</h4>
            <p className="text-xs text-muted">Your standup update and blocker signals have been recorded.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
            {error && (
              <div className="rounded-lg bg-critical-soft p-3 text-xs text-critical flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="field-label">Target Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required
                className="field-input"
              >
                <option value="" disabled>Select a project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.key})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">What did you complete today?</label>
              <textarea
                required
                rows={2}
                value={completedToday}
                onChange={(e) => setCompletedToday(e.target.value)}
                placeholder="e.g., Integrated JWT auth guards and updated user profile unit tests"
                className="field-input"
              />
            </div>

            <div>
              <label className="field-label">What are you working on next?</label>
              <textarea
                required
                rows={2}
                value={workingOn}
                onChange={(e) => setWorkingOn(e.target.value)}
                placeholder="e.g., Implementing real-time project progress snapshots and Kanban sync"
                className="field-input"
              />
            </div>

            {/* Blocker Flag */}
            <div className="rounded-xl border border-line bg-canvas p-3 space-y-2.5">
              <label className="flex items-center gap-2 font-semibold text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBlocked}
                  onChange={(e) => setIsBlocked(e.target.checked)}
                  className="rounded border-line text-signal focus:ring-signal"
                />
                <span>Are you currently blocked on any task or dependency?</span>
              </label>

              {isBlocked && (
                <div className="pt-2 border-t border-line space-y-1.5 animate-in fade-in duration-100">
                  <label className="text-[11px] font-medium text-critical">Blocker Description (AI Risk Signal)</label>
                  <input
                    type="text"
                    required={isBlocked}
                    value={blockerDescription}
                    onChange={(e) => setBlockerDescription(e.target.value)}
                    placeholder="e.g., Waiting on 3rd party OAuth client credentials or API schema approval"
                    className="field-input bg-surface"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Est. Next Milestone / Time</label>
                <input
                  type="text"
                  value={estimatedCompletion}
                  onChange={(e) => setEstimatedCompletion(e.target.value)}
                  placeholder="e.g., Tomorrow EOD"
                  className="field-input"
                />
              </div>

              <div>
                <label className="field-label">Optional Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Need 5min sync with Lead"
                  className="field-input"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary py-2 px-3 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5"
              >
                <Sparkles size={13} />
                {isSubmitting ? "Submitting..." : "Submit Daily Standup"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
