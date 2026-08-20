import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Edit2,
  Play,
  Plus,
  Rocket,
  Trash2,
} from "lucide-react";
import {
  completeSprint,
  createSprint,
  deleteSprint,
  describeError,
  getProjects,
  getSprints,
  startSprint,
  updateSprint,
} from "../services/api";
import { StatusBadge } from "../components/ui/Badge.jsx";
import { ConfirmDialog, Modal } from "../components/ui/Modal.jsx";
import { EmptyState } from "../components/ui/LoadingSkeleton.jsx";

import { useProject } from "../context/project-context.js";

const STATUS_FILTERS = ["All", "Active", "Planned", "Completed"];

function Sprints() {
  const { activeProjectId } = useProject();
  const [sprints, setSprints] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId || "All");
  const [selectedStatus, setSelectedStatus] = useState("All");

  useEffect(() => {
    if (activeProjectId) {
      setSelectedProjectId(activeProjectId);
    }
  }, [activeProjectId]);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState(null);
  const [deletingSprint, setDeletingSprint] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    project_id: "",
    name: "",
    goal: "",
    start_date: "",
    end_date: "",
    velocity_target: 20,
    status: "Planned",
  });
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSprints = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedProjectId !== "All") params.project_id = selectedProjectId;
      if (selectedStatus !== "All") params.status = selectedStatus;

      const [sData, pData] = await Promise.all([
        getSprints(params),
        getProjects().catch(() => []),
      ]);
      setSprints(sData || []);
      setProjects(pData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSprints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, selectedStatus]);

  const handleOpenCreate = () => {
    const today = new Date();
    const twoWeeksLater = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    setFormData({
      project_id: projects[0]?.id || "",
      name: `Sprint ${sprints.length + 1}`,
      goal: "",
      start_date: today.toISOString().split("T")[0],
      end_date: twoWeeksLater.toISOString().split("T")[0],
      velocity_target: 24,
      status: "Planned",
    });
    setFormError("");
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (sprint) => {
    setEditingSprint(sprint);
    setFormData({
      project_id: sprint.project_id,
      name: sprint.name,
      goal: sprint.goal || "",
      start_date: sprint.start_date || "",
      end_date: sprint.end_date || "",
      velocity_target: sprint.velocity_target,
      status: sprint.status,
    });
    setFormError("");
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);
    try {
      await createSprint({
        ...formData,
        project_id: parseInt(formData.project_id),
        velocity_target: parseInt(formData.velocity_target),
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
      });
      setIsCreateOpen(false);
      fetchSprints();
    } catch (err) {
      setFormError(describeError(err, "Failed to create sprint"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);
    try {
      await updateSprint(editingSprint.id, {
        name: formData.name,
        goal: formData.goal,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        velocity_target: parseInt(formData.velocity_target),
        status: formData.status,
      });
      setEditingSprint(null);
      fetchSprints();
    } catch (err) {
      setFormError(describeError(err, "Failed to update sprint"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartSprint = async (sprintId) => {
    try {
      await startSprint(sprintId);
      fetchSprints();
    } catch (err) {
      alert("Failed to start sprint: " + err.message);
    }
  };

  const handleCompleteSprint = async (sprintId) => {
    try {
      await completeSprint(sprintId);
      fetchSprints();
    } catch (err) {
      alert("Failed to complete sprint: " + err.message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingSprint) return;
    try {
      await deleteSprint(deletingSprint.id);
      setDeletingSprint(null);
      fetchSprints();
    } catch (err) {
      alert("Failed to delete sprint: " + err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Sprint Management</h1>
          <p className="mt-1 text-sm text-muted">
            Plan, execute, and monitor agile sprint cycles with AI burndown intelligence.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus size={16} />
          Create Sprint
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 items-center justify-between bg-surface p-3.5 rounded-xl border border-line">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>Filter by Project:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none"
          >
            <option value="All">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.key})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted">
          <span>Status:</span>
          <div className="flex gap-1">
            {STATUS_FILTERS.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  selectedStatus === st
                    ? "bg-ink text-white"
                    : "bg-canvas text-muted hover:text-ink border border-line"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sprints List / Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 rounded-xl border border-line bg-surface animate-pulse" />
          ))}
        </div>
      ) : sprints.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title="No sprints found"
          description="Create your next sprint iteration to start planning tasks and tracking team velocity."
          actionText="Create Sprint"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sprints.map((sprint) => {
            const stats = sprint.stats || {};
            const compPct = stats.completion_percentage || 0;
            const health = stats.health;

            return (
              <div
                key={sprint.id}
                className="group flex flex-col justify-between rounded-xl border border-line bg-surface p-5 shadow-xs transition hover:border-signal/50 hover:shadow-sm"
              >
                <div>
                  {/* Top row */}
                  <div className="flex items-center justify-between">
                    <StatusBadge status={sprint.status} />
                    <div className="flex items-center gap-1">
                      {sprint.status === "Planned" && (
                        <button
                          type="button"
                          onClick={() => handleStartSprint(sprint.id)}
                          className="flex items-center gap-1 rounded bg-signal px-2 py-1 text-[11px] font-medium text-white hover:bg-signal/90 transition"
                          title="Start Sprint"
                        >
                          <Play size={12} /> Start
                        </button>
                      )}
                      {sprint.status === "Active" && (
                        <button
                          type="button"
                          onClick={() => handleCompleteSprint(sprint.id)}
                          className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] font-medium text-white hover:bg-slate-700 transition"
                          title="Complete Sprint"
                        >
                          <CheckCircle2 size={12} /> Complete
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(sprint)}
                        className="rounded p-1 text-muted hover:bg-canvas hover:text-ink transition"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingSprint(sprint)}
                        className="rounded p-1 text-muted hover:bg-critical-soft hover:text-critical transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Project name tag */}
                  {sprint.project && (
                    <span className="mt-2 inline-block font-mono text-[10px] uppercase tracking-wider text-muted">
                      {sprint.project.name} ({sprint.project.key})
                    </span>
                  )}

                  {/* Title & Goal */}
                  <Link to={`/sprints/${sprint.id}`} className="block mt-1">
                    <h3 className="text-base font-semibold text-ink group-hover:text-signal transition">
                      {sprint.name}
                    </h3>
                  </Link>
                  <p className="mt-1 text-xs text-muted line-clamp-2 leading-relaxed">
                    {sprint.goal || "No sprint goal defined."}
                  </p>

                  {/* Dates & Target */}
                  <div className="mt-4 flex items-center justify-between text-xs text-muted border-t border-line/60 pt-2.5">
                    <span className="font-mono">
                      {sprint.start_date || "Start"} → {sprint.end_date || "End"}
                    </span>
                    <span className="font-mono font-medium text-ink">
                      Target: {sprint.velocity_target} pts
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted">Story Points Burned</span>
                      <span className="font-mono font-medium text-ink">
                        {stats.completed_points ?? 0}/{stats.total_points ?? sprint.velocity_target} pts ({compPct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-line overflow-hidden">
                      <div
                        className="h-full bg-signal rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, compPct)}%` }}
                      />
                    </div>
                  </div>

                  {/* AI Health Summary if active */}
                  {health && (
                    <div className="mt-3 rounded-lg bg-canvas p-2.5 border border-line text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-ink">AI Sprint Health:</span>
                        <span className="font-mono font-bold text-signal">
                          {health.health_score}/100 ({health.delivery_risk} Risk)
                        </span>
                      </div>
                      <p className="text-muted text-[11px] mt-1 line-clamp-2">{health.reason}</p>
                    </div>
                  )}
                </div>

                {/* Footer link */}
                <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs text-muted">
                  <span className="font-mono text-[11px]">{stats.total_tasks ?? 0} tasks</span>
                  <Link
                    to={`/sprints/${sprint.id}`}
                    className="font-medium text-signal hover:underline"
                  >
                    Burndown & Analytics →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Sprint Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Sprint"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="field-label">Target Project *</label>
            <select
              required
              value={formData.project_id}
              onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
              className="field-input"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.key})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Sprint Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Sprint 3 - Core Security & Optimization"
              className="field-input"
            />
          </div>

          <div>
            <label className="field-label">Sprint Goal</label>
            <textarea
              rows={2}
              value={formData.goal}
              onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
              placeholder="Key deliverable and target milestone of this sprint..."
              className="field-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Start Date</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">End Date</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="field-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Velocity Target (Story Points)</label>
              <input
                type="number"
                min="1"
                required
                value={formData.velocity_target}
                onChange={(e) => setFormData({ ...formData, velocity_target: e.target.value })}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">Initial Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="field-input"
              >
                <option value="Planned">Planned</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          {formError && (
            <p className="rounded-lg bg-critical-soft px-3 py-2 text-xs text-critical">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button type="button" onClick={() => setIsCreateOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? "Creating..." : "Create Sprint"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Sprint Modal */}
      <Modal
        isOpen={!!editingSprint}
        onClose={() => setEditingSprint(null)}
        title={`Edit Sprint: ${editingSprint?.name}`}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="field-label">Sprint Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="field-input"
            />
          </div>

          <div>
            <label className="field-label">Sprint Goal</label>
            <textarea
              rows={2}
              value={formData.goal}
              onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
              className="field-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Start Date</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">End Date</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="field-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Velocity Target (Points)</label>
              <input
                type="number"
                min="1"
                required
                value={formData.velocity_target}
                onChange={(e) => setFormData({ ...formData, velocity_target: e.target.value })}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="field-input"
              >
                <option value="Planned">Planned</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          {formError && (
            <p className="rounded-lg bg-critical-soft px-3 py-2 text-xs text-critical">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button type="button" onClick={() => setEditingSprint(null)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Sprint Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingSprint}
        onClose={() => setDeletingSprint(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Sprint"
        message={`Are you sure you want to delete sprint '${deletingSprint?.name}'? Its tasks will be returned to the project backlog.`}
        confirmText="Yes, Delete Sprint"
      />
    </div>
  );
}

export default Sprints;
