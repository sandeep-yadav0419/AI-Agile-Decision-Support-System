import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Mail,
  Plus,
  Users,
} from "lucide-react";
import {
  addTeamMember,
  describeError,
  getProjects,
  getTeamWorkload,
  getUsers,
  removeTeamMember,
} from "../services/api";
import { WorkloadBadge } from "../components/ui/Badge.jsx";
import { ConfirmDialog, Modal } from "../components/ui/Modal.jsx";
import { EmptyState, LoadingSkeleton } from "../components/ui/LoadingSkeleton.jsx";

const ROLES = [
  "Project Manager",
  "Developer",
  "Designer",
  "QA Engineer",
  "Business Analyst",
  "Scrum Master",
];

import { useProject } from "../context/project-context.js";

function Team() {
  const { activeProjectId } = useProject();
  const [workload, setWorkload] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId || "All");

  useEffect(() => {
    if (activeProjectId) {
      setSelectedProjectId(activeProjectId);
    }
  }, [activeProjectId]);

  // Add Member Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deletingMember, setDeletingMember] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    user_id: "",
    email: "",
    full_name: "",
    role: "Developer",
    project_id: "",
  });
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      const params = selectedProjectId !== "All" ? { project_id: selectedProjectId } : {};
      const [wData, pData, uData] = await Promise.all([
        getTeamWorkload(params),
        getProjects().catch(() => []),
        getUsers().catch(() => []),
      ]);
      setWorkload(wData || []);
      setProjects(pData || []);
      setUsers(uData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  const handleOpenAdd = () => {
    setFormData({
      user_id: users[0]?.id || "",
      email: "",
      full_name: "",
      role: "Developer",
      project_id: selectedProjectId !== "All" ? selectedProjectId : projects[0]?.id || "",
    });
    setFormError("");
    setIsAddOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);
    try {
      await addTeamMember({
        user_id: formData.user_id ? parseInt(formData.user_id) : null,
        email: formData.email || null,
        full_name: formData.full_name || null,
        role: formData.role,
        project_id: formData.project_id ? parseInt(formData.project_id) : null,
      });
      setIsAddOpen(false);
      fetchTeamData();
    } catch (err) {
      setFormError(describeError(err, "Failed to add team member"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingMember) return;
    try {
      await removeTeamMember(deletingMember.id);
      setDeletingMember(null);
      fetchTeamData();
    } catch (err) {
      alert("Failed to remove member: " + err.message);
    }
  };

  const overloadedMembers = workload.filter((w) => w.workload_status === "Overloaded");

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Team & Workload Intelligence</h1>
          <p className="mt-1 text-sm text-muted">
            Monitor developer capacity, task allocations, burnout risks, and cross-project memberships.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus size={16} />
          Add Member
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between bg-surface p-3.5 rounded-xl border border-line">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>Filter by Project Scope:</span>
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

        <div className="text-xs font-mono text-muted">
          Total Members: <strong className="text-ink">{workload.length}</strong>
        </div>
      </div>

      {/* Overload Alert if any */}
      {overloadedMembers.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 flex items-start gap-3 text-xs text-rose-900">
          <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block">
              AI Capacity Alert: {overloadedMembers.length} team member(s) overloaded
            </strong>
            <p className="mt-0.5 text-rose-700 leading-relaxed">
              {overloadedMembers.map((m) => m.full_name).join(", ")} exceed recommended active point thresholds. Reallocate non-critical tasks to prevent sprint delivery slippage.
            </p>
          </div>
        </div>
      )}

      {/* Team Cards Grid */}
      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : workload.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members found"
          description="Add developers and project managers to begin assigning tasks and tracking workload capacity."
          actionText="Add Member"
          onAction={handleOpenAdd}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {workload.map((member) => {
            const isOverloaded = member.workload_status === "Overloaded";
            return (
              <div
                key={member.user_id}
                className={`flex flex-col justify-between rounded-xl border bg-surface p-5 shadow-xs transition hover:border-signal/50 ${
                  isOverloaded ? "border-rose-200 bg-rose-50/10" : "border-line"
                }`}
              >
                <div>
                  {/* Top user badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-white font-mono text-xs font-bold">
                        {member.full_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <h3 className="text-sm font-semibold text-ink truncate">{member.full_name}</h3>
                        <p className="text-xs text-muted truncate">{member.role}</p>
                      </div>
                    </div>

                    <WorkloadBadge status={member.workload_status} />
                  </div>

                  {/* Contact */}
                  <div className="mt-3 flex items-center gap-1 text-[11px] text-muted truncate">
                    <Mail size={12} className="shrink-0" />
                    <span className="truncate">{member.email}</span>
                  </div>

                  {/* Workload Stats Strip */}
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line/60 pt-3 text-center text-xs font-mono">
                    <div className="rounded bg-canvas p-1.5 border border-line">
                      <span className="text-[10px] text-muted block font-sans">Active Tasks</span>
                      <strong className="text-ink text-sm block mt-0.5">
                        {member.in_progress_tasks_count}
                      </strong>
                    </div>
                    <div className="rounded bg-canvas p-1.5 border border-line">
                      <span className="text-[10px] text-muted block font-sans">Total Pts</span>
                      <strong className="text-ink text-sm block mt-0.5">
                        {member.total_story_points}
                      </strong>
                    </div>
                    <div className="rounded bg-canvas p-1.5 border border-line">
                      <span className="text-[10px] text-muted block font-sans">Done</span>
                      <strong className="text-signal text-sm block mt-0.5">
                        {member.completed_tasks_count}
                      </strong>
                    </div>
                  </div>

                  {/* Capacity Bar */}
                  <div className="mt-4">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted">Capacity Utilization</span>
                      <span className="font-mono font-medium text-ink">
                        {member.utilization_percentage}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-line overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isOverloaded
                            ? "bg-rose-600"
                            : member.workload_status === "High Workload"
                            ? "bg-amber-500"
                            : "bg-signal"
                        }`}
                        style={{ width: `${Math.min(100, member.utilization_percentage)}%` }}
                      />
                    </div>
                  </div>

                  {/* Active Projects Tags */}
                  {member.active_projects?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {member.active_projects.map((projName, i) => (
                        <span
                          key={i}
                          className="rounded bg-canvas border border-line px-1.5 py-0.5 text-[10px] text-muted"
                        >
                          {projName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Member Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Team Member"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div>
            <label className="field-label">Select Registered User</label>
            <select
              value={formData.user_id}
              onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
              className="field-input"
            >
              <option value="">Or enter new user details below...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          {!formData.user_id && (
            <div className="space-y-3 rounded-lg bg-canvas p-3 border border-line">
              <span className="text-xs font-semibold text-ink block">New Member Details:</span>
              <div>
                <label className="field-label text-xs">Full Name *</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="e.g. Jordan Miller"
                  className="field-input text-xs"
                />
              </div>
              <div>
                <label className="field-label text-xs">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="jordan@company.com"
                  className="field-input text-xs"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="field-input"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Assign to Project</label>
              <select
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                className="field-input"
              >
                <option value="">Organization-wide</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.key})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formError && (
            <p className="rounded-lg bg-critical-soft px-3 py-2 text-xs text-critical">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button type="button" onClick={() => setIsAddOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? "Adding..." : "Add Member"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Member Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingMember}
        onClose={() => setDeletingMember(null)}
        onConfirm={handleDeleteConfirm}
        title="Remove Member"
        message="Are you sure you want to remove this member from the project?"
        confirmText="Remove"
      />
    </div>
  );
}

export default Team;
