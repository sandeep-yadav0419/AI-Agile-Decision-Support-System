import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Edit2,
  ListChecks,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  createTask,
  deleteTask,
  describeError,
  getProjects,
  getSprints,
  getTasks,
  getUsers,
  updateTask,
  updateTaskStatus,
} from "../services/api";
import { PriorityBadge } from "../components/ui/Badge.jsx";
import { ConfirmDialog, Modal } from "../components/ui/Modal.jsx";
import { EmptyState, LoadingSkeleton } from "../components/ui/LoadingSkeleton.jsx";

import { useProject } from "../context/project-context.js";

const STATUSES = ["All", "Backlog", "To Do", "In Progress", "Review", "Done", "Blocked"];
const PRIORITIES = ["All", "Low", "Medium", "High", "Critical"];

function Tasks() {
  const { activeProjectId } = useProject();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId || "All");
  const [selectedSprintId, setSelectedSprintId] = useState("All");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedPriority, setSelectedPriority] = useState("All");

  useEffect(() => {
    if (activeProjectId) {
      setSelectedProjectId(activeProjectId);
    }
  }, [activeProjectId]);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);

  // Form data
  const [formData, setFormData] = useState({
    project_id: "",
    sprint_id: "",
    assignee_id: "",
    title: "",
    description: "",
    priority: "Medium",
    status: "To Do",
    story_points: 3,
    due_date: "",
  });
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedProjectId !== "All") params.project_id = selectedProjectId;
      if (selectedSprintId !== "All") params.sprint_id = selectedSprintId;
      if (selectedAssigneeId !== "All") params.assignee_id = selectedAssigneeId;
      if (selectedStatus !== "All") params.status = selectedStatus;
      if (selectedPriority !== "All") params.priority = selectedPriority;
      if (search.trim()) params.search = search.trim();

      const [tData, pData, sData, uData] = await Promise.all([
        getTasks(params),
        getProjects().catch(() => []),
        getSprints().catch(() => []),
        getUsers().catch(() => []),
      ]);

      setTasks(tData || []);
      setProjects(pData || []);
      setSprints(sData || []);
      setUsers(uData || []);
    } catch (err) {
      console.error("Fetch tasks error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, selectedSprintId, selectedAssigneeId, selectedStatus, selectedPriority]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchTasks();
  };

  const handleOpenCreate = () => {
    setFormData({
      project_id: projects[0]?.id || "",
      sprint_id: "",
      assignee_id: "",
      title: "",
      description: "",
      priority: "Medium",
      status: "To Do",
      story_points: 3,
      due_date: "",
    });
    setFormError("");
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (task) => {
    setEditingTask(task);
    setFormData({
      project_id: task.project_id,
      sprint_id: task.sprint_id || "",
      assignee_id: task.assignee_id || "",
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      status: task.status,
      story_points: task.story_points,
      due_date: task.due_date || "",
    });
    setFormError("");
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        project_id: parseInt(formData.project_id),
        sprint_id: formData.sprint_id ? parseInt(formData.sprint_id) : null,
        assignee_id: formData.assignee_id ? parseInt(formData.assignee_id) : null,
        story_points: parseInt(formData.story_points) || 0,
        due_date: formData.due_date || null,
      };
      await createTask(payload);
      setIsCreateOpen(false);
      fetchTasks();
    } catch (err) {
      setFormError(describeError(err, "Failed to create task"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        project_id: parseInt(formData.project_id),
        sprint_id: formData.sprint_id ? parseInt(formData.sprint_id) : null,
        assignee_id: formData.assignee_id ? parseInt(formData.assignee_id) : null,
        story_points: parseInt(formData.story_points) || 0,
        due_date: formData.due_date || null,
      };
      await updateTask(editingTask.id, payload);
      setEditingTask(null);
      fetchTasks();
    } catch (err) {
      setFormError(describeError(err, "Failed to update task"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await updateTaskStatus(taskId, newStatus);
      fetchTasks();
    } catch (err) {
      alert("Failed to update status: " + err.message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTask) return;
    try {
      await deleteTask(deletingTask.id);
      setDeletingTask(null);
      fetchTasks();
    } catch (err) {
      alert("Failed to delete task: " + err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Tasks</h1>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            Backlog refinement, sprint assignment, assignee allocation, and status workflow.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
        >
          <Plus size={16} />
          New Task
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface p-4 rounded-xl border border-line shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search size={15} className="absolute left-3 top-2.5 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks by title or specifications..."
              className="field-input pl-9 text-xs"
            />
          </form>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Project Filter */}
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none"
            >
              <option value="All">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Sprint Filter */}
            <select
              value={selectedSprintId}
              onChange={(e) => setSelectedSprintId(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none"
            >
              <option value="All">All Sprints</option>
              {sprints
                .filter((s) => selectedProjectId === "All" || s.project_id === parseInt(selectedProjectId))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>

            {/* Assignee Filter */}
            <select
              value={selectedAssigneeId}
              onChange={(e) => setSelectedAssigneeId(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none"
            >
              <option value="All">All Assignees</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none"
            >
              {STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none"
            >
              {PRIORITIES.map((pr) => (
                <option key={pr} value={pr}>
                  {pr}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tasks Table */}
      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No tasks match your criteria"
          description="Adjust your search and filter parameters or create a new task."
          actionText="Create Task"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-canvas font-mono text-[10px] uppercase text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Task</th>
                <th className="px-4 py-3 font-semibold">Project / Sprint</th>
                <th className="px-4 py-3 font-semibold">Assignee</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Points</th>
                <th className="px-4 py-3 font-semibold">Due Date</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-canvas/50 transition">
                  <td className="px-4 py-3 max-w-sm">
                    <div className="flex items-start gap-2">
                      {task.status === "Blocked" && (
                        <AlertTriangle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(task)}
                          className="font-semibold text-ink hover:text-signal transition text-left leading-tight"
                        >
                          {task.title}
                        </button>
                        {task.description && (
                          <div className="text-[11px] text-muted line-clamp-1 mt-0.5">
                            {task.description}
                          </div>
                        )}
                        {task.is_overdue && (
                          <span className="mt-0.5 inline-block font-mono text-[10px] font-bold text-critical">
                            OVERDUE
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    <div className="font-medium text-ink">{task.project?.name || "No Project"}</div>
                    <div className="text-[11px] font-mono">{task.sprint?.name || "Backlog"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded-full bg-ink text-white font-mono text-[9px] font-bold flex items-center justify-center">
                        {task.assignee?.full_name ? task.assignee.full_name[0].toUpperCase() : "?"}
                      </div>
                      <span className="text-ink font-medium">
                        {task.assignee?.full_name || <span className="text-muted font-normal">Unassigned</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task.id, e.target.value)}
                      className="rounded border border-line bg-surface px-2 py-1 text-xs text-ink outline-none font-medium"
                    >
                      {STATUSES.filter((s) => s !== "All").map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-ink">
                    {task.story_points} pts
                  </td>
                  <td className="px-4 py-3 font-mono text-muted text-[11px]">
                    {task.due_date || "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(task)}
                        className="rounded p-1 text-muted hover:bg-canvas hover:text-ink transition"
                        title="Edit Task"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingTask(task)}
                        className="rounded p-1 text-muted hover:bg-critical-soft hover:text-critical transition"
                        title="Delete Task"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Task Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Task"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="field-label">Task Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Implement JWT Refresh Rotation"
              className="field-input"
            />
          </div>

          <div>
            <label className="field-label">Description</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Technical specifications, acceptance criteria..."
              className="field-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Project *</label>
              <select
                required
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                className="field-input"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Sprint</label>
              <select
                value={formData.sprint_id}
                onChange={(e) => setFormData({ ...formData, sprint_id: e.target.value })}
                className="field-input"
              >
                <option value="">Project Backlog</option>
                {sprints
                  .filter((s) => !formData.project_id || s.project_id === parseInt(formData.project_id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="field-label">Assignee</label>
              <select
                value={formData.assignee_id}
                onChange={(e) => setFormData({ ...formData, assignee_id: e.target.value })}
                className="field-input"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Story Points (Fibonacci)</label>
              <input
                type="number"
                min="0"
                value={formData.story_points}
                onChange={(e) => setFormData({ ...formData, story_points: e.target.value })}
                className="field-input font-mono"
              />
            </div>
            <div>
              <label className="field-label">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="field-input"
              >
                {PRIORITIES.filter((p) => p !== "All").map((pr) => (
                  <option key={pr} value={pr}>
                    {pr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Initial Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="field-input"
              >
                {STATUSES.filter((s) => s !== "All").map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Due Date</label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="field-input"
              />
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
              {isSubmitting ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit / Details Task Modal */}
      <Modal
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        title={`Task: ${editingTask?.title}`}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="field-label">Task Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="field-input"
            />
          </div>

          <div>
            <label className="field-label">Description</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="field-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Project</label>
              <select
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                className="field-input"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Sprint</label>
              <select
                value={formData.sprint_id}
                onChange={(e) => setFormData({ ...formData, sprint_id: e.target.value })}
                className="field-input"
              >
                <option value="">Project Backlog</option>
                {sprints
                  .filter((s) => !formData.project_id || s.project_id === parseInt(formData.project_id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Assignee</label>
              <select
                value={formData.assignee_id}
                onChange={(e) => setFormData({ ...formData, assignee_id: e.target.value })}
                className="field-input"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Story Points</label>
              <input
                type="number"
                min="0"
                value={formData.story_points}
                onChange={(e) => setFormData({ ...formData, story_points: e.target.value })}
                className="field-input font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="field-label">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="field-input"
              >
                {STATUSES.filter((s) => s !== "All").map((st) => (
                  <option key={st} value={st}>
                    {st}
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
                {PRIORITIES.filter((p) => p !== "All").map((pr) => (
                  <option key={pr} value={pr}>
                    {pr}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Due Date</label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="field-input"
              />
            </div>
          </div>

          {formError && (
            <p className="rounded-lg bg-critical-soft px-3 py-2 text-xs text-critical">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button type="button" onClick={() => setEditingTask(null)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingTask}
        onClose={() => setDeletingTask(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Task"
        message={`Are you sure you want to delete task '${deletingTask?.title}'?`}
        confirmText="Yes, Delete Task"
      />
    </div>
  );
}

export default Tasks;
