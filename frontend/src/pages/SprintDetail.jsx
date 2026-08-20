import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Columns3,
  Play,
  Plus,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import {
  completeSprint,
  getSprint,
  getSprintBurndown,
  getSprintHealth,
  getTasks,
  startSprint,
  updateTaskStatus,
} from "../services/api";
import { HealthScoreBadge, PriorityBadge, StatusBadge } from "../components/ui/Badge.jsx";
import { BurndownChart } from "../components/ui/Charts.jsx";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton.jsx";

function SprintDetail() {
  const { id } = useParams();
  const sprintId = parseInt(id);

  const [sprint, setSprint] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [burndown, setBurndown] = useState([]);
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSprintData = async () => {
    try {
      setLoading(true);
      const [s, t, b, h] = await Promise.all([
        getSprint(sprintId),
        getTasks({ sprint_id: sprintId }),
        getSprintBurndown(sprintId).catch(() => []),
        getSprintHealth(sprintId).catch(() => null),
      ]);
      setSprint(s);
      setTasks(t || []);
      setBurndown(b || []);
      setHealthData(h);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sprintId) fetchSprintData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprintId]);

  const handleStart = async () => {
    try {
      await startSprint(sprintId);
      fetchSprintData();
    } catch (err) {
      alert("Failed to start sprint: " + err.message);
    }
  };

  const handleComplete = async () => {
    try {
      await completeSprint(sprintId);
      fetchSprintData();
    } catch (err) {
      alert("Failed to complete sprint: " + err.message);
    }
  };

  const handleTaskStatusChange = async (taskId, nextStatus) => {
    try {
      await updateTaskStatus(taskId, nextStatus);
      fetchSprintData();
    } catch (err) {
      alert("Failed to update status: " + err.message);
    }
  };

  if (loading) {
    return <LoadingSkeleton rows={6} className="max-w-7xl mx-auto" />;
  }

  if (!sprint) {
    return (
      <div className="text-center py-12">
        <p className="text-muted">Sprint not found.</p>
        <Link to="/sprints" className="btn-primary mt-4 inline-block">
          Back to Sprints
        </Link>
      </div>
    );
  }

  const stats = sprint.stats || {};
  const compPct = stats.completion_percentage || 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Back & Actions header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          to="/sprints"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink transition"
        >
          <ArrowLeft size={14} /> Back to Sprints
        </Link>

        <div className="flex items-center gap-2">
          {sprint.status === "Planned" && (
            <button
              type="button"
              onClick={handleStart}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 bg-signal hover:bg-signal/90 text-white"
            >
              <Play size={14} /> Start Sprint
            </button>
          )}
          {sprint.status === "Active" && (
            <button
              type="button"
              onClick={handleComplete}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white"
            >
              <CheckCircle2 size={14} /> Complete Sprint
            </button>
          )}
          <Link
            to="/kanban"
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <Columns3 size={14} /> Board View
          </Link>
        </div>
      </div>

      {/* Sprint Header Banner */}
      <div className="rounded-xl border border-line bg-surface p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <StatusBadge status={sprint.status} />
              {sprint.project && (
                <span className="rounded bg-canvas border border-line px-2 py-0.5 font-mono text-xs text-muted">
                  Project: {sprint.project.name}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-ink">{sprint.name}</h1>
            <p className="text-xs text-muted max-w-3xl leading-relaxed">
              {sprint.goal || "No sprint goal defined."}
            </p>
          </div>

          <div className="border-t lg:border-t-0 lg:border-l border-line pt-4 lg:pt-0 lg:pl-6">
            <span className="font-mono text-[10px] text-muted uppercase tracking-wider block">
              Sprint Health Score
            </span>
            <div className="mt-1">
              <HealthScoreBadge score={healthData?.health_score ?? stats.health?.health_score ?? 85} />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-line pt-4 text-xs font-mono">
          <div>
            <span className="text-muted block font-sans">Sprint Duration:</span>
            <strong className="text-ink text-sm block mt-0.5">
              {stats.elapsed_days ?? 0} / {stats.total_days ?? 14} days
            </strong>
          </div>
          <div>
            <span className="text-muted block font-sans">Burned Points:</span>
            <strong className="text-ink text-sm block mt-0.5">
              {stats.completed_points ?? 0} / {stats.total_points ?? sprint.velocity_target} pts ({compPct}%)
            </strong>
          </div>
          <div>
            <span className="text-muted block font-sans">Remaining Points:</span>
            <strong className="text-ink text-sm block mt-0.5">
              {stats.remaining_points ?? 0} pts ({tasks.length - (stats.completed_tasks ?? 0)} tasks)
            </strong>
          </div>
          <div>
            <span className="text-muted block font-sans">Velocity Commitment:</span>
            <strong className="text-ink text-sm block mt-0.5">
              {sprint.velocity_target} pts target
            </strong>
          </div>
        </div>
      </div>

      {/* Main Grid: Burndown Chart & AI Assessment */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Burndown Chart */}
        <div className="lg:col-span-2 rounded-xl border border-line bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-line pb-3 mb-3">
            <div className="flex items-center gap-2">
              <TrendingDown size={18} className="text-signal" />
              <h3 className="text-sm font-semibold text-ink">Sprint Burndown Trajectory</h3>
            </div>
            <span className="font-mono text-xs text-muted">Ideal vs Actual</span>
          </div>

          <BurndownChart data={burndown} height={240} />
        </div>

        {/* AI Health Breakdown */}
        <div className="rounded-xl border border-line bg-surface p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-signal" />
              <h3 className="text-sm font-semibold text-ink">AI Sprint Analysis</h3>
            </div>
            <span className="font-mono text-xs font-bold text-signal">
              {healthData?.delivery_risk || "LOW"} RISK
            </span>
          </div>

          {healthData ? (
            <div className="space-y-3 text-xs">
              <div className="rounded-lg bg-canvas p-3 border border-line">
                <span className="text-muted block text-[11px]">Primary Root Cause Analysis:</span>
                <p className="text-ink font-medium mt-1 leading-relaxed">
                  {healthData.summary_reason}
                </p>
              </div>

              <div className="rounded-lg bg-signal-soft/50 border border-signal/20 p-3">
                <span className="text-signal font-semibold block text-[11px]">Recommended Mitigation:</span>
                <p className="text-ink font-medium mt-1 leading-relaxed">
                  {healthData.primary_recommendation}
                </p>
              </div>

              {healthData.metric_breakdown?.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-line">
                  <span className="text-muted block text-[11px] font-semibold">Subsystem Metrics:</span>
                  {healthData.metric_breakdown.map((mb, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px]">
                      <span className="text-muted">{mb.name}:</span>
                      <span className={`font-mono font-semibold ${
                        mb.status === "critical" ? "text-critical" : mb.status === "warning" ? "text-amber-600" : "text-signal"
                      }`}>
                        {mb.score}/100 ({mb.status})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted py-6 text-center">Analyzing sprint telemetry...</p>
          )}
        </div>
      </div>

      {/* Sprint Tasks Table */}
      <div className="rounded-xl border border-line bg-surface p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h3 className="text-sm font-semibold text-ink">Sprint Tasks ({tasks.length})</h3>
          <Link to="/tasks" className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
            <Plus size={14} /> Add Tasks
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-canvas font-medium text-muted">
              <tr>
                <th className="px-4 py-3">Task Title</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Story Points</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3 text-right">Quick Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-canvas/50 transition">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{task.title}</div>
                    {task.is_overdue && (
                      <span className="text-[10px] font-mono text-critical font-semibold">Overdue</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {task.assignee?.full_name || "Unassigned"}
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-ink">
                    {task.story_points} pts
                  </td>
                  <td className="px-4 py-3 font-mono text-muted">
                    {task.due_date || "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <select
                      value={task.status}
                      onChange={(e) => handleTaskStatusChange(task.id, e.target.value)}
                      className="rounded border border-line bg-surface px-2 py-1 text-xs text-ink outline-none"
                    >
                      {["Backlog", "To Do", "In Progress", "Review", "Done", "Blocked"].map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default SprintDetail;
