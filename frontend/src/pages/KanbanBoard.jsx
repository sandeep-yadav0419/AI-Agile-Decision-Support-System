import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Plus,
} from "lucide-react";
import {
  createTask,
  describeError,
  getProjects,
  getSprints,
  getTasks,
  getUsers,
  updateTask,
  updateTaskStatus,
} from "../services/api";
import { PriorityBadge } from "../components/ui/Badge.jsx";
import { Modal } from "../components/ui/Modal.jsx";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton.jsx";
import { useProject } from "../context/project-context.js";

const KANBAN_COLUMNS = [
  { id: "Backlog", label: "BACKLOG", color: "border-t-slate-400" },
  { id: "To Do", label: "TO DO", color: "border-t-indigo-400" },
  { id: "In Progress", label: "IN PROGRESS", color: "border-t-amber-500" },
  { id: "Review", label: "REVIEW", color: "border-t-sky-500" },
  { id: "Done", label: "DONE", color: "border-t-emerald-500" },
  { id: "Blocked", label: "BLOCKED", color: "border-t-rose-500" },
];

function KanbanBoard() {
  const { activeProjectId } = useProject();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId || "All");
  const [selectedSprintId, setSelectedSprintId] = useState("All");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("All");
  const [selectedPriority, setSelectedPriority] = useState("All");

  useEffect(() => {
    if (activeProjectId) {
      setSelectedProjectId(activeProjectId);
    }
  }, [activeProjectId]);

  // Dragging state
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Quick create modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createInitialStatus, setCreateInitialStatus] = useState("To Do");
  const [editingTask, setEditingTask] = useState(null);

  // Form states
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

  const fetchBoardData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedProjectId !== "All") params.project_id = selectedProjectId;
      if (selectedSprintId !== "All") params.sprint_id = selectedSprintId;
      if (selectedAssigneeId !== "All") params.assignee_id = selectedAssigneeId;
      if (selectedPriority !== "All") params.priority = selectedPriority;

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
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, selectedSprintId, selectedAssigneeId, selectedPriority]);

  // Drag and Drop handlers
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData("text/plain", taskId.toString());
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDragLeave = (e, columnId) => {
    if (dragOverColumn === columnId) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskIdStr = e.dataTransfer.getData("text/plain") || draggedTaskId;
    if (!taskIdStr) return;

    const taskId = parseInt(taskIdStr);
    const currentTask = tasks.find((t) => t.id === taskId);
    if (!currentTask || currentTask.status === targetStatus) return;

    // Optimistic UI update
    const previousTasks = [...tasks];
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t))
    );

    try {
      await updateTaskStatus(taskId, targetStatus);
    } catch (err) {
      console.error("Failed to update status on server:", err);
      // Revert on error
      setTasks(previousTasks);
      alert("Failed to move task: " + (err.response?.data?.detail || err.message));
    } finally {
      setDraggedTaskId(null);
    }
  };

  const handleOpenCreateInColumn = (status) => {
    setCreateInitialStatus(status);
    setFormData({
      project_id: selectedProjectId !== "All" ? selectedProjectId : projects[0]?.id || "",
      sprint_id: selectedSprintId !== "All" ? selectedSprintId : "",
      assignee_id: "",
      title: "",
      description: "",
      priority: "Medium",
      status: status,
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
      await createTask({
        ...formData,
        project_id: parseInt(formData.project_id),
        sprint_id: formData.sprint_id ? parseInt(formData.sprint_id) : null,
        assignee_id: formData.assignee_id ? parseInt(formData.assignee_id) : null,
        story_points: parseInt(formData.story_points) || 0,
        due_date: formData.due_date || null,
      });
      setIsCreateOpen(false);
      fetchBoardData();
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
      await updateTask(editingTask.id, {
        ...formData,
        project_id: parseInt(formData.project_id),
        sprint_id: formData.sprint_id ? parseInt(formData.sprint_id) : null,
        assignee_id: formData.assignee_id ? parseInt(formData.assignee_id) : null,
        story_points: parseInt(formData.story_points) || 0,
        due_date: formData.due_date || null,
      });
      setEditingTask(null);
      fetchBoardData();
    } catch (err) {
      setFormError(describeError(err, "Failed to update task"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Agile Kanban Board</h1>
          <p className="mt-0.5 text-xs text-muted">
            Drag cards between columns to transition task status and update telemetry in real time.
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleOpenCreateInColumn("To Do")}
          className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus size={16} />
          Add Card
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2.5 items-center justify-between bg-surface p-3 rounded-xl border border-line">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Project Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span>Project:</span>
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

          {/* Sprint Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span>Sprint:</span>
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
                    {s.name} ({s.status})
                  </option>
                ))}
            </select>
          </div>

          {/* Assignee Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span>Assignee:</span>
            <select
              value={selectedAssigneeId}
              onChange={(e) => setSelectedAssigneeId(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none"
            >
              <option value="All">All Members</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span>Priority:</span>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none"
            >
              <option value="All">All Priorities</option>
              {["Low", "Medium", "High", "Critical"].map((pr) => (
                <option key={pr} value={pr}>
                  {pr}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs font-mono text-muted">
          Total Cards: <strong className="text-ink">{tasks.length}</strong>
        </div>
      </div>

      {/* Kanban 6 Columns Board */}
      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 pb-4 overflow-x-auto min-h-[70vh]">
          {KANBAN_COLUMNS.map((col) => {
            const columnTasks = tasks.filter((t) => t.status === col.id);
            const totalColPoints = columnTasks.reduce((acc, t) => acc + (t.story_points || 0), 0);
            const isOver = dragOverColumn === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={(e) => handleDragLeave(e, col.id)}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`flex flex-col rounded-xl border border-line bg-canvas/70 p-3 shadow-2xs border-t-4 ${
                  col.color
                } ${isOver ? "bg-signal-soft/40 border-signal ring-2 ring-signal/30" : ""} transition-all`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-line">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-ink">{col.label}</span>
                    <span className="rounded-full bg-surface border border-line px-1.5 py-0.2 font-mono text-[10px] text-muted">
                      {columnTasks.length}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-muted">{totalColPoints} pts</span>
                </div>

                {/* Task Cards Stack */}
                <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[68vh] pr-0.5">
                  {columnTasks.map((task) => {
                    const isOverdue = task.is_overdue;
                    const isBlocked = task.status === "Blocked";

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onClick={() => handleOpenEdit(task)}
                        className={`group cursor-grab active:cursor-grabbing rounded-lg border bg-surface p-3 shadow-xs transition hover:shadow-md hover:border-signal/50 ${
                          isBlocked
                            ? "border-rose-300 bg-rose-50/20"
                            : isOverdue
                            ? "border-amber-300"
                            : "border-line"
                        }`}
                      >
                        {/* Project / Key tag */}
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-[10px] font-bold text-muted uppercase">
                            {task.project?.key || "PRJ"}
                          </span>
                          <PriorityBadge priority={task.priority} />
                        </div>

                        {/* Card Title */}
                        <h4 className="text-xs font-semibold text-ink group-hover:text-signal transition leading-snug">
                          {task.title}
                        </h4>

                        {/* Description excerpt */}
                        {task.description && (
                          <p className="mt-1 text-[11px] text-muted line-clamp-2 leading-tight">
                            {task.description}
                          </p>
                        )}

                        {/* Risk & Overdue Alert indicators */}
                        {(isBlocked || isOverdue) && (
                          <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-medium">
                            {isBlocked && (
                              <span className="flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-rose-700 font-semibold">
                                <AlertTriangle size={10} /> Blocked
                              </span>
                            )}
                            {isOverdue && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 font-mono">
                                Due: {task.due_date}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Card Footer: Assignee & Story points */}
                        <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2 text-[11px] text-muted">
                          <div className="flex items-center gap-1.5 truncate max-w-[110px]">
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[9px] font-medium text-white">
                              {task.assignee?.full_name
                                ? task.assignee.full_name[0].toUpperCase()
                                : "?"}
                            </div>
                            <span className="truncate text-ink font-medium">
                              {task.assignee?.full_name || "Unassigned"}
                            </span>
                          </div>

                          <span className="rounded bg-canvas border border-line px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink">
                            {task.story_points} pts
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Empty column placeholder */}
                  {columnTasks.length === 0 && (
                    <div className="py-6 text-center text-[11px] text-muted border border-dashed border-line rounded-lg">
                      No tasks in {col.label}
                    </div>
                  )}
                </div>

                {/* Quick Add Button */}
                <button
                  type="button"
                  onClick={() => handleOpenCreateInColumn(col.id)}
                  className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-line bg-surface/60 py-1.5 text-xs text-muted hover:bg-surface hover:text-ink transition"
                >
                  <Plus size={12} /> Add Task
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Task Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={`Add Task to ${createInitialStatus}`}
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="field-label">Task Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Optimize SQL query performance"
              className="field-input"
            />
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
                    {u.full_name}
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
            <div>
              <label className="field-label">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="field-input"
              >
                {["Low", "Medium", "High", "Critical"].map((pr) => (
                  <option key={pr} value={pr}>
                    {pr}
                  </option>
                ))}
              </select>
            </div>
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
              {isSubmitting ? "Adding..." : "Add to Board"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Task Modal */}
      <Modal
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        title="Card Details & Status"
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
              <label className="field-label">Status Column</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="field-input font-medium"
              >
                {KANBAN_COLUMNS.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.label}
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
                {["Low", "Medium", "High", "Critical"].map((pr) => (
                  <option key={pr} value={pr}>
                    {pr}
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
                    {u.full_name}
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

          <div>
            <label className="field-label">Due Date</label>
            <input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="field-input"
            />
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
              {isSubmitting ? "Saving..." : "Save Card"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default KanbanBoard;
