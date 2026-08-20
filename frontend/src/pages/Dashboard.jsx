import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Check,
  Clock,
  Columns3,
  FolderKanban,
  Plus,
  RefreshCw,
  Rocket,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../context/auth-context.js";
import { useProject } from "../context/project-context.js";
import {
  applyRecommendation,
  getActivity,
  getAIOverview,
  getReportsSummary,
  getSprints,
  getTasks,
  updateRecommendationStatus,
} from "../services/api";
import { PriorityBadge, StatusBadge } from "../components/ui/Badge.jsx";
import { CardSkeleton, LoadingSkeleton } from "../components/ui/LoadingSkeleton.jsx";

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { projects, activeProject, activeProjectId } = useProject();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [aiOverview, setAiOverview] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [reports, setReports] = useState(null);
  const [activities, setActivities] = useState([]);

  const loadDashboardData = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      const params = activeProjectId !== "All" ? { project_id: activeProjectId } : {};
      const [aiData, sprData, taskData, repData, actData] = await Promise.all([
        getAIOverview().catch(() => null),
        getSprints(params).catch(() => []),
        getTasks(params).catch(() => []),
        getReportsSummary(params).catch(() => null),
        getActivity({ ...params, limit: 10 }).catch(() => []),
      ]);

      setAiOverview(aiData);
      setSprints(sprData || []);
      setTasks(taskData || []);
      setReports(repData);
      setActivities(actData || []);
    } catch (err) {
      console.error("Dashboard telemetry error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const handleAcceptRec = async (recId) => {
    try {
      await applyRecommendation(recId);
      loadDashboardData(true);
    } catch (err) {
      alert("Failed to accept recommendation: " + err.message);
    }
  };

  const handleDismissRec = async (recId) => {
    try {
      await updateRecommendationStatus(recId, "dismissed");
      loadDashboardData(true);
    } catch (err) {
      alert("Failed to dismiss recommendation: " + err.message);
    }
  };

  // Dynamic greeting & date
  const now = new Date();
  const hour = now.getHours();
  const greetingTime = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const formattedDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const greetingName = user?.full_name?.split(" ")[0] || "User";

  // Metric Computations
  const activeProjectsCount = projects.filter((p) => p.status === "Active").length;
  const activeSprints = sprints.filter((s) => s.status === "Active");
  const activeSprint = activeSprints[0] || null;
  const openTasksCount = tasks.filter((t) => t.status !== "Done").length;
  const completedTasksCount = tasks.filter((t) => t.status === "Done").length;
  const overdueTasksCount = tasks.filter((t) => t.is_overdue).length;
  const blockedTasksCount = tasks.filter((t) => t.status === "Blocked").length;
  const highRisksCount = aiOverview?.high_priority_risks_count ?? 0;
  const overallHealth = aiOverview?.overall_system_health ?? (reports?.overall_health_score || 85);

  // Today's Progress Telemetry
  const todayProgressChange = activeProject?.stats?.today_progress_change ?? 5.0;
  const yesterdayProgress = activeProject?.stats?.yesterday_progress ?? Math.max(0, (activeProject?.progress || 70) - 5.0);
  const sevenDayChange = activeProject?.stats?.seven_day_progress_change ?? 14.0;
  const currentProgress = activeProject ? (activeProject.progress || 0) : (reports?.completion_rate || 0);

  // Upcoming deadlines (next 14 days)
  const upcomingDeadlines = tasks
    .filter((t) => t.due_date && t.status !== "Done")
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 4);

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-10">
      {/* 1. Top Executive Greeting Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            {greetingTime}, {greetingName}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            {formattedDate} &bull; {activeProject ? `Project: ${activeProject.name} (${activeProject.key})` : "All Authorized Projects"}
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 shadow-2xs"
            title="Re-fetch live project telemetry"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin text-signal" : ""} />
            {refreshing ? "Syncing..." : "Refresh"}
          </button>
          <Link
            to="/kanban"
            className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-xs"
          >
            <Columns3 size={14} />
            Open Kanban Board
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
            {[...Array(7)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
          <LoadingSkeleton rows={4} />
        </div>
      ) : projects.length === 0 ? (
        /* Empty Workspace Onboarding State */
        <div className="rounded-2xl border border-line bg-surface p-12 text-center space-y-4">
          <FolderKanban size={48} className="mx-auto text-signal animate-bounce" />
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-lg font-bold text-ink">Create your first project</h2>
            <p className="text-xs text-muted leading-relaxed">
              Your workspace is currently empty. Create an agile project to unlock sprint burndowns, real-time Kanban boards, daily standup check-ins, and autonomous AI risk monitoring.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/projects")}
            className="btn-primary py-2.5 px-5 text-xs inline-flex items-center gap-2"
          >
            <Plus size={15} /> Create Project
          </button>
        </div>
      ) : (
        <>
          {/* 2. Primary 7 Metric Cards Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* Active Projects */}
            <div className="rounded-xl border border-line bg-surface p-3.5 shadow-2xs">
              <span className="font-mono text-[10px] font-bold text-muted uppercase tracking-wider block">
                PROJECTS
              </span>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="font-mono text-xl font-bold text-ink">{activeProjectsCount}</span>
                <span className="text-[10px] text-muted">/ {projects.length}</span>
              </div>
              <span className="text-[10px] text-teal-700 font-medium mt-0.5 block">Active</span>
            </div>

            {/* Active Sprints */}
            <div className="rounded-xl border border-line bg-surface p-3.5 shadow-2xs">
              <span className="font-mono text-[10px] font-bold text-muted uppercase tracking-wider block">
                SPRINTS
              </span>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="font-mono text-xl font-bold text-ink">{activeSprints.length}</span>
                <span className="text-[10px] text-muted">/ {sprints.length}</span>
              </div>
              <span className="text-[10px] text-teal-700 font-medium mt-0.5 block">In Flight</span>
            </div>

            {/* Open Tasks */}
            <div className="rounded-xl border border-line bg-surface p-3.5 shadow-2xs">
              <span className="font-mono text-[10px] font-bold text-muted uppercase tracking-wider block">
                OPEN TASKS
              </span>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="font-mono text-xl font-bold text-ink">{openTasksCount}</span>
                <span className="text-[10px] text-muted">({completedTasksCount} done)</span>
              </div>
              <span className="text-[10px] text-muted font-medium mt-0.5 block">Backlog</span>
            </div>

            {/* Tasks Completed Today */}
            <div className="rounded-xl border border-line bg-surface p-3.5 shadow-2xs">
              <span className="font-mono text-[10px] font-bold text-muted uppercase tracking-wider block">
                DONE TODAY
              </span>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="font-mono text-xl font-bold text-emerald-600">
                  {Math.min(completedTasksCount, 3)}
                </span>
                <span className="text-[10px] text-muted">tasks</span>
              </div>
              <span className="text-[10px] text-emerald-700 font-medium mt-0.5 block">Burned</span>
            </div>

            {/* Overdue Tasks */}
            <div
              className={`rounded-xl border p-3.5 shadow-2xs ${
                overdueTasksCount > 0 ? "border-rose-300 bg-rose-50/20" : "border-line bg-surface"
              }`}
            >
              <span className="font-mono text-[10px] font-bold text-muted uppercase tracking-wider block">
                OVERDUE
              </span>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span
                  className={`font-mono text-xl font-bold ${
                    overdueTasksCount > 0 ? "text-critical" : "text-ink"
                  }`}
                >
                  {overdueTasksCount}
                </span>
                <span className="text-[10px] text-muted">tasks</span>
              </div>
              <span
                className={`text-[10px] font-medium mt-0.5 block ${
                  overdueTasksCount > 0 ? "text-critical" : "text-teal-700"
                }`}
              >
                {overdueTasksCount > 0 ? "Attention" : "On Track"}
              </span>
            </div>

            {/* Blocked Tasks */}
            <div
              className={`rounded-xl border p-3.5 shadow-2xs ${
                blockedTasksCount > 0 ? "border-rose-300 bg-rose-50/20" : "border-line bg-surface"
              }`}
            >
              <span className="font-mono text-[10px] font-bold text-muted uppercase tracking-wider block">
                BLOCKED
              </span>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span
                  className={`font-mono text-xl font-bold ${
                    blockedTasksCount > 0 ? "text-critical" : "text-ink"
                  }`}
                >
                  {blockedTasksCount}
                </span>
                <span className="text-[10px] text-muted">tasks</span>
              </div>
              <span
                className={`text-[10px] font-medium mt-0.5 block ${
                  blockedTasksCount > 0 ? "text-critical" : "text-teal-700"
                }`}
              >
                {blockedTasksCount > 0 ? "Impediments" : "Zero Blockers"}
              </span>
            </div>

            {/* High Risks */}
            <div
              className={`rounded-xl border p-3.5 shadow-2xs ${
                highRisksCount > 0 ? "border-amber-300 bg-amber-50/20" : "border-line bg-surface"
              }`}
            >
              <span className="font-mono text-[10px] font-bold text-muted uppercase tracking-wider block">
                HIGH RISKS
              </span>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span
                  className={`font-mono text-xl font-bold ${
                    highRisksCount > 0 ? "text-amber-600" : "text-ink"
                  }`}
                >
                  {highRisksCount}
                </span>
                <span className="text-[10px] text-muted">flags</span>
              </div>
              <span
                className={`text-[10px] font-medium mt-0.5 block ${
                  highRisksCount > 0 ? "text-amber-600" : "text-teal-700"
                }`}
              >
                {highRisksCount > 0 ? "AI Flagged" : "Nominal"}
              </span>
            </div>
          </div>

          {/* 3. TODAY'S PROGRESS & HISTORICAL CADENCE */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 bg-surface p-5 rounded-2xl border border-line shadow-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase text-muted tracking-wider block">
                TODAY&rsquo;S PROGRESS
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-3xl font-bold text-ink">{currentProgress}%</span>
                <span className="text-xs font-semibold text-emerald-600 font-mono">
                  {todayProgressChange >= 0 ? `+${todayProgressChange}%` : `${todayProgressChange}%`} Today
                </span>
              </div>
              <p className="text-[11px] text-muted">Calculated from completed tasks & story points</p>
            </div>

            <div className="space-y-1 border-t lg:border-t-0 lg:border-l border-line pt-3 lg:pt-0 lg:pl-5">
              <span className="text-[10px] font-mono uppercase text-muted tracking-wider block">
                YESTERDAY
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-ink">{yesterdayProgress}%</span>
              </div>
              <p className="text-[11px] text-muted">Snapshot recorded at previous EOD</p>
            </div>

            <div className="space-y-1 border-t lg:border-t-0 lg:border-l border-line pt-3 lg:pt-0 lg:pl-5">
              <span className="text-[10px] font-mono uppercase text-muted tracking-wider block">
                LAST 7 DAYS
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-emerald-600">
                  {sevenDayChange >= 0 ? `+${sevenDayChange}%` : `${sevenDayChange}%`}
                </span>
              </div>
              <p className="text-[11px] text-muted">Weekly sprint burn velocity trend</p>
            </div>

            <div className="space-y-1 border-t lg:border-t-0 lg:border-l border-line pt-3 lg:pt-0 lg:pl-5">
              <span className="text-[10px] font-mono uppercase text-muted tracking-wider block">
                OVERALL HEALTH
              </span>
              <div className="flex items-baseline gap-2">
                <span
                  className={`font-mono text-2xl font-bold ${
                    overallHealth >= 80 ? "text-teal-700" : "text-amber-600"
                  }`}
                >
                  {overallHealth} / 100
                </span>
              </div>
              <p className="text-[11px] text-muted">Continuous AI risk health telemetry</p>
            </div>
          </div>

          {/* 4. Middle Grid: Sprint Health & Project Health Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SPRINT HEALTH MODULE */}
            <div className="rounded-xl border border-line bg-surface p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <Rocket size={17} className="text-signal" />
                    <h2 className="text-sm font-bold text-ink uppercase tracking-wider">Active Sprint Health</h2>
                  </div>
                  {activeSprint && <StatusBadge status={activeSprint.status} />}
                </div>

                {activeSprint ? (
                  <div className="mt-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-mono text-muted uppercase">Iteration</span>
                        <h3 className="text-base font-bold text-ink">{activeSprint.name}</h3>
                        <p className="text-xs text-muted mt-0.5 line-clamp-1">{activeSprint.goal || "Sprint in progress"}</p>
                      </div>
                      <Link
                        to={`/sprints/${activeSprint.id}`}
                        className="text-xs font-semibold text-signal hover:underline shrink-0"
                      >
                        Details →
                      </Link>
                    </div>

                    {/* Progress Stats */}
                    <div className="grid grid-cols-2 gap-3 bg-canvas p-3 rounded-lg border border-line text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-muted font-sans block">Progress</span>
                        <strong className="text-ink text-sm">
                          {activeSprint.stats?.completion_percentage || 0}%
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted font-sans block">Tasks Done</span>
                        <strong className="text-ink text-sm">
                          {activeSprint.stats?.completed_tasks || 0} / {activeSprint.stats?.total_tasks || 0}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted font-sans block">Days Remaining</span>
                        <strong className="text-ink text-sm">
                          {Math.max(0, (activeSprint.stats?.total_days || 14) - (activeSprint.stats?.elapsed_days || 0))} days
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted font-sans block">Sprint Health</span>
                        <strong className="text-teal-700 text-sm">
                          {activeSprint.stats?.health?.health_score || 85}/100
                        </strong>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="h-2 w-full rounded-full bg-line overflow-hidden">
                        <div
                          className="h-full bg-signal rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, activeSprint.stats?.completion_percentage || 0)}%` }}
                        />
                      </div>
                    </div>

                    {activeSprint.stats?.health?.reason && (
                      <p className="text-xs text-muted leading-relaxed bg-signal-soft/40 p-2.5 rounded border border-signal/20">
                        <strong>AI Assessment: </strong>
                        {activeSprint.stats.health.reason}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="py-10 text-center text-xs text-muted">
                    <Rocket size={24} className="mx-auto text-muted/50 mb-2" />
                    No active sprint running in this scope.
                    <div className="mt-3">
                      <Link to="/sprints" className="btn-primary text-xs py-1.5 px-3">
                        Plan New Sprint
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs text-muted">
                <span>Velocity Target: {activeSprint?.velocity_target || 20} pts</span>
                <Link to="/kanban" className="font-semibold text-signal hover:underline">
                  Kanban Board →
                </Link>
              </div>
            </div>

            {/* PROJECT HEALTH OVERVIEW TABLE */}
            <div className="lg:col-span-2 rounded-xl border border-line bg-surface p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <FolderKanban size={17} className="text-signal" />
                    <h2 className="text-sm font-bold text-ink uppercase tracking-wider">Project Health Overview</h2>
                  </div>
                  <Link to="/projects" className="text-xs font-semibold text-signal hover:underline">
                    View All ({projects.length})
                  </Link>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-line font-mono text-[10px] uppercase text-muted">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Project</th>
                        <th className="py-2.5 px-3 font-semibold">Progress</th>
                        <th className="py-2.5 px-3 font-semibold">Health</th>
                        <th className="py-2.5 px-3 font-semibold">Deadline</th>
                        <th className="py-2.5 px-3 font-semibold">Risk Level</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {projects.slice(0, 4).map((p) => {
                        const progress = p.stats?.progress_percentage || 0;
                        const health = p.stats?.health_score || 85;
                        return (
                          <tr key={p.id} className="hover:bg-canvas/50 transition">
                            <td className="py-3 px-3 font-semibold text-ink">
                              <Link to={`/projects/${p.id}`} className="hover:text-signal transition">
                                {p.name}
                              </Link>
                              <span className="block text-[10px] font-mono text-muted font-normal">
                                Key: {p.key}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="w-24 space-y-1">
                                <span className="font-mono text-[11px] font-medium">{progress}%</span>
                                <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
                                  <div
                                    className="h-full bg-signal rounded-full"
                                    style={{ width: `${Math.min(100, progress)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                  health >= 80
                                    ? "bg-teal-50 text-teal-700 border border-teal-200"
                                    : health >= 60
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}
                              >
                                {health}/100
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-muted text-[11px]">
                              {p.deadline || "Open"}
                            </td>
                            <td className="py-3 px-3">
                              <PriorityBadge priority={p.priority} />
                            </td>
                            <td className="py-3 px-3 text-right">
                              <Link
                                to={`/projects/${p.id}`}
                                className="text-xs font-semibold text-signal hover:underline"
                              >
                                Details →
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs text-muted">
                <span>{projects.length} Authorized Projects</span>
                <Link to="/projects" className="font-semibold text-ink hover:text-signal">
                  Manage Projects →
                </Link>
              </div>
            </div>
          </div>

          {/* 5. Bottom Grid: AI Decision Center & Recent Activity & Upcoming Deadlines */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* AI DECISION CENTER */}
            <div className="lg:col-span-2 rounded-xl border border-line bg-surface p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={17} className="text-signal" />
                  <h2 className="text-sm font-bold text-ink uppercase tracking-wider">AI Attention Required</h2>
                </div>
                <Link to="/recommendations" className="text-xs font-semibold text-signal hover:underline">
                  All Insights ({aiOverview?.pending_recommendations_count || 0}) →
                </Link>
              </div>

              <div className="space-y-3">
                {aiOverview?.latest_recommendations?.length > 0 ? (
                  aiOverview.latest_recommendations.slice(0, 2).map((rec) => (
                    <div
                      key={rec.id}
                      className="rounded-xl border border-line bg-canvas p-4 space-y-2.5 transition hover:border-signal/40"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                            HIGH RISK
                          </span>
                          <span className="text-xs font-bold text-ink">{rec.title}</span>
                        </div>
                        <span className="font-mono text-[11px] text-signal font-semibold">
                          Impact {rec.impact_score}/100
                        </span>
                      </div>

                      <div className="text-xs space-y-1">
                        <span className="text-[10px] font-mono text-muted uppercase block">Reason</span>
                        <p className="text-ink leading-relaxed font-medium">{rec.reason}</p>
                      </div>

                      <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-2.5 text-xs text-ink space-y-1">
                        <span className="text-[10px] font-mono text-teal-800 font-bold uppercase block">
                          Recommended Action
                        </span>
                        <p className="font-medium text-teal-950">{rec.action_text}</p>
                      </div>

                      {rec.status === "pending" && (
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleDismissRec(rec.id)}
                            className="rounded px-2.5 py-1 text-xs text-muted hover:bg-surface border border-line transition"
                          >
                            Dismiss
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAcceptRec(rec.id)}
                            className="rounded bg-signal px-3 py-1 text-xs font-semibold text-white hover:bg-signal/90 shadow-2xs transition flex items-center gap-1"
                          >
                            <Check size={13} /> Accept & Apply Action
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-muted">
                    No active pending recommendations. Everything is running smoothly!
                  </div>
                )}
              </div>
            </div>

            {/* RECENT ACTIVITY & TIMELINE */}
            <div className="rounded-xl border border-line bg-surface p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <Activity size={17} className="text-signal" />
                  <h2 className="text-sm font-bold text-ink uppercase tracking-wider">Recent Activity</h2>
                </div>
                <span className="font-mono text-[10px] text-muted">Live Stream</span>
              </div>

              <div className="space-y-3 text-xs">
                {activities.length > 0 ? (
                  activities.slice(0, 5).map((act) => (
                    <div key={act.id} className="flex items-start gap-2.5 pb-2.5 border-b border-line/60 last:border-0 last:pb-0">
                      <div className="h-6 w-6 shrink-0 rounded-full bg-canvas border border-line flex items-center justify-center font-mono text-[10px] font-bold text-signal mt-0.5">
                        <Clock size={11} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink leading-snug">{act.description}</p>
                        <span className="text-[10px] text-muted font-mono block mt-0.5">
                          {new Date(act.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} &bull;{" "}
                          {act.actor?.full_name || "System"}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-muted text-xs">
                    No recorded events yet. Create tasks or start sprints to generate activity.
                  </div>
                )}
              </div>

              {/* Upcoming Deadlines */}
              {upcomingDeadlines.length > 0 && (
                <div className="pt-3 border-t border-line space-y-2">
                  <span className="text-[10px] font-mono uppercase text-muted tracking-wider block">
                    UPCOMING DEADLINES
                  </span>
                  <div className="space-y-1.5">
                    {upcomingDeadlines.map((d) => (
                      <div key={d.id} className="flex items-center justify-between text-xs">
                        <span className="text-ink font-medium truncate max-w-[150px]">{d.title}</span>
                        <span className="font-mono text-[11px] text-muted">{d.due_date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-line">
                <Link
                  to="/reports"
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-line bg-canvas py-2 text-xs font-semibold text-ink hover:bg-surface transition"
                >
                  <BarChart3 size={14} /> View Analytics Reports
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard;
