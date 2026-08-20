import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Edit2,
  FolderKanban,
  Plus,
  Rocket,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import {
  createProject,
  deleteProject,
  describeError,
  getProjects,
  getUsers,
  updateProject,
} from "../services/api";
import { StatusBadge } from "../components/ui/Badge.jsx";
import { ConfirmDialog, Modal } from "../components/ui/Modal.jsx";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton.jsx";
import { useProject } from "../context/project-context.js";

const STATUSES = ["All", "Planning", "Active", "Completed", "On Hold"];
const PRIORITIES = ["All", "Low", "Medium", "High", "Critical"];

function Projects() {
  const navigate = useNavigate();
  const { refreshProjects, setActiveProjectId } = useProject();

  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [sortBy, setSortBy] = useState("recent");

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deletingProject, setDeletingProject] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    key: "",
    description: "",
    goal: "",
    status: "Active",
    priority: "Medium",
    start_date: "",
    deadline: "",
    sprint_duration_weeks: 2,
    working_days: "Mon-Fri",
    team_member_ids: [],
  });
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter !== "All") params.status = statusFilter;
      if (priorityFilter !== "All") params.priority = priorityFilter;
      if (search.trim()) params.search = search.trim();

      const [data, usersList] = await Promise.all([
        getProjects(params),
        getUsers().catch(() => []),
      ]);
      setProjects(data || []);
      setUsers(usersList || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, priorityFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchProjects();
  };

  const handleOpenCreate = () => {
    setFormData({
      name: "",
      key: "",
      description: "",
      goal: "",
      status: "Active",
      priority: "Medium",
      start_date: new Date().toISOString().split("T")[0],
      deadline: "",
      sprint_duration_weeks: 2,
      working_days: "Mon-Fri",
      team_member_ids: [],
    });
    setFormError("");
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      const created = await createProject({
        name: formData.name.trim(),
        key: formData.key.trim().toUpperCase(),
        description: formData.description.trim() || undefined,
        goal: formData.goal.trim() || undefined,
        status: formData.status,
        priority: formData.priority,
        start_date: formData.start_date || undefined,
        deadline: formData.deadline || undefined,
        sprint_duration_weeks: Number(formData.sprint_duration_weeks) || 2,
        working_days: formData.working_days || "Mon-Fri",
        team_member_ids: formData.team_member_ids.length > 0 ? formData.team_member_ids.map(Number) : undefined,
      });

      setIsCreateOpen(false);
      await refreshProjects();
      setActiveProjectId(created.id);
      await fetchProjects();
      navigate(`/projects/${created.id}`);
    } catch (err) {
      setFormError(describeError(err, "Failed to create project"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (project, e) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingProject(project);
    setFormData({
      name: project.name,
      key: project.key,
      description: project.description || "",
      goal: project.goal || "",
      status: project.status,
      priority: project.priority,
      start_date: project.start_date || "",
      deadline: project.deadline || "",
      sprint_duration_weeks: project.sprint_duration_weeks || 2,
      working_days: project.working_days || "Mon-Fri",
      team_member_ids: [],
    });
    setFormError("");
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingProject) return;
    setFormError("");
    setIsSubmitting(true);

    try {
      await updateProject(editingProject.id, {
        name: formData.name.trim(),
        key: formData.key.trim().toUpperCase(),
        description: formData.description.trim() || null,
        goal: formData.goal.trim() || null,
        status: formData.status,
        priority: formData.priority,
        start_date: formData.start_date || null,
        deadline: formData.deadline || null,
        sprint_duration_weeks: Number(formData.sprint_duration_weeks) || 2,
        working_days: formData.working_days || "Mon-Fri",
      });

      setEditingProject(null);
      await refreshProjects();
      await fetchProjects();
    } catch (err) {
      setFormError(describeError(err, "Failed to update project"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDelete = (project, e) => {
    e.stopPropagation();
    e.preventDefault();
    setDeletingProject(project);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProject) return;
    try {
      await deleteProject(deletingProject.id);
      setDeletingProject(null);
      await refreshProjects();
      await fetchProjects();
    } catch (err) {
      console.error(err);
      alert(describeError(err, "Failed to delete project"));
    }
  };

  // Sorting
  const sortedProjects = [...projects].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "progress") return (b.progress || 0) - (a.progress || 0);
    if (sortBy === "health") return (b.stats?.health_score || 0) - (a.stats?.health_score || 0);
    return b.id - a.id;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Projects Workspace</h1>
          <p className="mt-1 text-sm text-muted">
            Manage agile projects, delivery goals, velocity schedules, and AI telemetry health.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="btn-primary text-xs py-2.5 px-4 flex items-center gap-1.5 self-start sm:self-auto shadow-2xs"
        >
          <Plus size={15} /> New Project
        </button>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-surface p-3.5 rounded-xl border border-line">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search size={15} className="absolute left-3 top-2.5 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by project name, key, or description..."
            className="w-full rounded-lg border border-line bg-canvas pl-9 pr-3 py-1.5 text-xs text-ink outline-none"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1 text-xs text-muted">
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1 text-xs text-muted">
            <span>Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1 text-xs text-muted">
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none"
            >
              <option value="recent">Recently Created</option>
              <option value="name">Project Name</option>
              <option value="progress">Completion %</option>
              <option value="health">Health Score</option>
            </select>
          </div>
        </div>
      </div>

      {/* Projects Content */}
      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : sortedProjects.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-12 text-center space-y-4">
          <FolderKanban size={48} className="mx-auto text-signal/60 animate-pulse" />
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-semibold text-ink">Create your first project</h3>
            <p className="text-xs text-muted leading-relaxed">
              Get started by setting up an agile project workspace with sprints, backlogs, and real-time AI decision support telemetry.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="btn-primary py-2.5 px-5 text-xs inline-flex items-center gap-2"
          >
            <Plus size={15} /> Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedProjects.map((project) => {
            const stats = project.stats || {};
            const progress = stats.progress_percentage || 0;
            const healthScore = stats.health_score || 85;

            return (
              <div
                key={project.id}
                className="group relative flex flex-col justify-between rounded-xl border border-line bg-surface p-5 shadow-xs transition hover:border-signal/50 hover:shadow-md"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-signal bg-signal-soft px-2 py-0.5 rounded border border-signal/20">
                        {project.key}
                      </span>
                      <StatusBadge status={project.status} />
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(project, e)}
                        className="rounded p-1 text-muted hover:bg-canvas hover:text-ink transition"
                        title="Edit Project"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleOpenDelete(project, e)}
                        className="rounded p-1 text-muted hover:bg-critical-soft hover:text-critical transition"
                        title="Delete Project"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="mt-3">
                    <Link
                      to={`/projects/${project.id}`}
                      className="text-base font-bold text-ink hover:text-signal transition line-clamp-1"
                    >
                      {project.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted line-clamp-2 leading-relaxed">
                      {project.description || "No project overview description specified."}
                    </p>
                  </div>

                  {/* Story Points Burned Progress */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-muted">Story Points Progress</span>
                      <span className="font-semibold text-ink">
                        {stats.completed_story_points || 0} / {stats.total_story_points || 0} pts ({progress}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-line overflow-hidden">
                      <div
                        className="h-full rounded-full bg-signal transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Health Score Pill */}
                  <div className="mt-3 flex items-center justify-between bg-canvas p-2.5 rounded-lg border border-line text-xs">
                    <span className="text-muted flex items-center gap-1">
                      <Sparkles size={13} className="text-signal" /> AI Health Index
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        healthScore >= 80
                          ? "text-emerald-600"
                          : healthScore >= 60
                          ? "text-amber-600"
                          : "text-critical"
                      }`}
                    >
                      {healthScore} / 100
                    </span>
                  </div>
                </div>

                {/* Footer Metadata */}
                <div className="mt-5 pt-3 border-t border-line flex items-center justify-between text-xs text-muted">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1" title="Active Sprints">
                      <Rocket size={13} className="text-signal" />
                      <strong className="text-ink">{stats.active_sprints_count || 0}</strong> sprint
                    </span>
                    <span className="flex items-center gap-1" title="Team Members">
                      <Users size={13} className="text-signal" />
                      <strong className="text-ink">{stats.team_members_count || 1}</strong> members
                    </span>
                  </div>

                  <Link
                    to={`/projects/${project.id}`}
                    className="font-semibold text-signal hover:underline flex items-center gap-1 text-[11px]"
                  >
                    View Details &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Project Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Project"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="field-label">Project Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Autonomous AI Platform"
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">Project Key *</label>
              <input
                type="text"
                required
                maxLength={8}
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value.toUpperCase() })}
                placeholder="e.g. AAP"
                className="field-input font-mono uppercase"
              />
            </div>
          </div>

          <div>
            <label className="field-label">Description</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="High-level project scope and deliverable objectives..."
              className="field-input"
            />
          </div>

          <div>
            <label className="field-label">Strategic Project Goal</label>
            <input
              type="text"
              value={formData.goal}
              onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
              placeholder="e.g. Deliver multi-tenant agile sprint analytics engine by Q4"
              className="field-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="field-input"
              >
                {STATUSES.filter((s) => s !== "All").map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="field-input"
              >
                {PRIORITIES.filter((p) => p !== "All").map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
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
              <label className="field-label">Target Deadline</label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="field-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Sprint Duration</label>
              <select
                value={formData.sprint_duration_weeks}
                onChange={(e) => setFormData({ ...formData, sprint_duration_weeks: Number(e.target.value) })}
                className="field-input"
              >
                <option value={1}>1 Week Sprints</option>
                <option value={2}>2 Weeks Sprints (Standard)</option>
                <option value={3}>3 Weeks Sprints</option>
                <option value={4}>4 Weeks Sprints</option>
              </select>
            </div>
            <div>
              <label className="field-label">Working Days</label>
              <select
                value={formData.working_days}
                onChange={(e) => setFormData({ ...formData, working_days: e.target.value })}
                className="field-input"
              >
                <option value="Mon-Fri">Mon - Fri (5 Days)</option>
                <option value="Mon-Sat">Mon - Sat (6 Days)</option>
                <option value="All Days">All 7 Days</option>
              </select>
            </div>
          </div>

          {/* Optional Team Members */}
          {users.length > 0 && (
            <div>
              <label className="field-label">Assign Initial Team Members (Optional)</label>
              <div className="max-h-28 overflow-y-auto rounded-lg border border-line bg-canvas p-2 space-y-1">
                {users.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-xs text-ink cursor-pointer hover:bg-surface p-1 rounded">
                    <input
                      type="checkbox"
                      checked={formData.team_member_ids.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, team_member_ids: [...formData.team_member_ids, u.id] });
                        } else {
                          setFormData({
                            ...formData,
                            team_member_ids: formData.team_member_ids.filter((id) => id !== u.id),
                          });
                        }
                      }}
                      className="rounded border-line text-signal"
                    />
                    <span>{u.full_name}</span>
                    <span className="text-[10px] text-muted">({u.role})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

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
              {isSubmitting ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Project Modal */}
      <Modal
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        title={`Edit Project (${editingProject?.key})`}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="field-label">Project Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">Project Key *</label>
              <input
                type="text"
                required
                maxLength={8}
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value.toUpperCase() })}
                className="field-input font-mono uppercase"
              />
            </div>
          </div>

          <div>
            <label className="field-label">Description</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="field-input"
            />
          </div>

          <div>
            <label className="field-label">Strategic Project Goal</label>
            <input
              type="text"
              value={formData.goal}
              onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
              className="field-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="field-input"
              >
                {STATUSES.filter((s) => s !== "All").map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="field-input"
              >
                {PRIORITIES.filter((p) => p !== "All").map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
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
              <label className="field-label">Target Deadline</label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="field-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Sprint Duration</label>
              <select
                value={formData.sprint_duration_weeks}
                onChange={(e) => setFormData({ ...formData, sprint_duration_weeks: Number(e.target.value) })}
                className="field-input"
              >
                <option value={1}>1 Week Sprints</option>
                <option value={2}>2 Weeks Sprints</option>
                <option value={3}>3 Weeks Sprints</option>
                <option value={4}>4 Weeks Sprints</option>
              </select>
            </div>
            <div>
              <label className="field-label">Working Days</label>
              <select
                value={formData.working_days}
                onChange={(e) => setFormData({ ...formData, working_days: e.target.value })}
                className="field-input"
              >
                <option value="Mon-Fri">Mon - Fri</option>
                <option value="Mon-Sat">Mon - Sat</option>
                <option value="All Days">All Days</option>
              </select>
            </div>
          </div>

          {formError && (
            <p className="rounded-lg bg-critical-soft px-3 py-2 text-xs text-critical">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button type="button" onClick={() => setEditingProject(null)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Project Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingProject}
        onClose={() => setDeletingProject(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Project"
        message={`Are you sure you want to delete project '${deletingProject?.name}' (${deletingProject?.key})? All associated sprints, tasks, and telemetry data will be permanently removed.`}
        confirmText="Yes, Delete Project"
      />
    </div>
  );
}

export default Projects;
