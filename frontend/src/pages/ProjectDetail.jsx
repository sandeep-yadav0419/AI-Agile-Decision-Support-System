import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Columns3,
  Plus,
  Rocket,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  getProject,
  getProjectForecast,
  getProjectHealth,
  getSprints,
  getTasks,
  getTeamMembers,
  syncAIProject,
} from "../services/api";
import { HealthScoreBadge, PriorityBadge, SeverityBadge, StatusBadge } from "../components/ui/Badge.jsx";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton.jsx";

function ProjectDetail() {
  const { id } = useParams();
  const projectId = parseInt(id);

  const [project, setProject] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [healthData, setHealthData] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const fetchProjectData = async () => {
    try {
      setLoading(true);
      const [p, sp, t, tm, h, f] = await Promise.all([
        getProject(projectId),
        getSprints({ project_id: projectId }),
        getTasks({ project_id: projectId }),
        getTeamMembers({ project_id: projectId }),
        getProjectHealth(projectId).catch(() => null),
        getProjectForecast(projectId).catch(() => null),
      ]);
      setProject(p);
      setSprints(sp || []);
      setTasks(t || []);
      setTeamMembers(tm || []);
      setHealthData(h);
      setForecast(f);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchProjectData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleSyncAI = async () => {
    try {
      await syncAIProject(projectId);
      fetchProjectData();
    } catch (err) {
      alert("Failed to sync AI: " + err.message);
    }
  };

  if (loading) {
    return <LoadingSkeleton rows={6} className="max-w-7xl mx-auto" />;
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted">Project not found.</p>
        <Link to="/projects" className="btn-primary mt-4 inline-block">
          Back to Projects
        </Link>
      </div>
    );
  }

  const activeSprint = sprints.find((s) => s.status === "Active");
  const stats = project.stats || {};

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Back button & Breadcrumbs */}
      <div className="flex items-center justify-between">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink transition"
        >
          <ArrowLeft size={14} /> Back to Projects
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSyncAI}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-signal"
          >
            <Sparkles size={14} /> Re-evaluate AI Telemetry
          </button>
          <Link
            to="/kanban"
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <Columns3 size={14} /> Open Kanban
          </Link>
        </div>
      </div>

      {/* Project Banner Header */}
      <div className="rounded-xl border border-line bg-surface p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="rounded bg-canvas border border-line px-2 py-0.5 font-mono text-xs font-bold text-ink">
                {project.key}
              </span>
              <StatusBadge status={project.status} />
              <PriorityBadge priority={project.priority} />
            </div>
            <h1 className="text-2xl font-bold text-ink">{project.name}</h1>
            <p className="text-xs text-muted max-w-3xl leading-relaxed">
              {project.description || "No project description provided."}
            </p>
          </div>

          {/* Health Score Pill */}
          <div className="flex items-center gap-4 border-t lg:border-t-0 lg:border-l border-line pt-4 lg:pt-0 lg:pl-6">
            <div className="text-center lg:text-right">
              <span className="font-mono text-[10px] text-muted uppercase tracking-wider block">
                AI Health Score
              </span>
              <div className="mt-1">
                <HealthScoreBadge score={healthData?.overall_health_score ?? stats.health_score ?? 85} />
              </div>
            </div>
          </div>
        </div>

        {/* Progress & Metadata strip */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-line pt-4 text-xs">
          <div>
            <span className="text-muted block">Project Lead:</span>
            <span className="font-medium text-ink mt-0.5 block">{project.owner?.full_name || "Unassigned"}</span>
          </div>
          <div>
            <span className="text-muted block">Timeline:</span>
            <span className="font-mono text-ink mt-0.5 block">
              {project.start_date || "Start"} → {project.deadline || "Open"}
            </span>
          </div>
          <div>
            <span className="text-muted block">Story Points Completed:</span>
            <span className="font-mono font-medium text-ink mt-0.5 block">
              {stats.completed_story_points ?? 0} / {stats.total_story_points ?? 0} pts ({stats.progress_percentage ?? 0}%)
            </span>
          </div>
          <div>
            <span className="text-muted block">Active Sprints / Tasks:</span>
            <span className="font-mono font-medium text-ink mt-0.5 block">
              {sprints.length} sprints · {tasks.length} tasks
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-line gap-2">
        {[
          { id: "overview", label: "Overview & Intelligence" },
          { id: "sprints", label: `Sprints (${sprints.length})` },
          { id: "tasks", label: `Tasks (${tasks.length})` },
          { id: "team", label: `Team (${teamMembers.length})` },
          { id: "risks", label: `Risks & Recommendations (${(healthData?.critical_risks?.length || 0) + (healthData?.top_recommendations?.length || 0)})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === tab.id
                ? "border-signal text-signal bg-signal-soft/30 rounded-t-lg"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Active Sprint Highlights */}
            <div className="lg:col-span-2 rounded-xl border border-line bg-surface p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <Rocket size={16} className="text-signal" />
                  <h3 className="text-sm font-semibold text-ink">Active Sprint</h3>
                </div>
                {activeSprint && <StatusBadge status={activeSprint.status} />}
              </div>

              {activeSprint ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-baseline">
                    <h4 className="text-base font-semibold text-ink">{activeSprint.name}</h4>
                    <Link to={`/sprints/${activeSprint.id}`} className="text-xs text-signal font-medium hover:underline">
                      Sprint Detail →
                    </Link>
                  </div>
                  <p className="text-xs text-muted">{activeSprint.goal || "No specific goal set"}</p>

                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-muted">Burndown Completion</span>
                      <span className="font-semibold text-ink">
                        {activeSprint.stats?.completed_points ?? 0}/{activeSprint.stats?.total_points ?? 0} pts (
                        {activeSprint.stats?.completion_percentage ?? 0}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-line overflow-hidden">
                      <div
                        className="h-full bg-signal rounded-full"
                        style={{ width: `${Math.min(100, activeSprint.stats?.completion_percentage || 0)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted py-4">No active sprint running for this project.</p>
              )}
            </div>

            {/* Delivery Prediction Card */}
            <div className="rounded-xl border border-line bg-surface p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-signal" />
                  <h3 className="text-sm font-semibold text-ink">Forecast Prediction</h3>
                </div>
                <span className="font-mono text-xs text-signal font-bold">
                  {forecast?.delivery_confidence ?? 85}% Conf.
                </span>
              </div>

              {forecast ? (
                <div className="space-y-2.5 text-xs text-muted">
                  <div className="flex justify-between">
                    <span>Expected Completion:</span>
                    <strong className="text-ink font-mono">{forecast.expected_completion_date || "Calculated"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Remaining Story Points:</span>
                    <strong className="text-ink font-mono">{forecast.remaining_points} pts</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Velocity:</span>
                    <strong className="text-ink font-mono">{forecast.current_velocity_per_week} pts/wk</strong>
                  </div>
                  <p className="rounded-lg bg-canvas p-2.5 text-[11px] leading-relaxed text-ink mt-2 border border-line">
                    {forecast.forecast_summary}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted py-4">Generating prediction model...</p>
              )}
            </div>
          </div>

          {/* Critical Risks & Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-line bg-surface p-5">
              <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
                <ShieldAlert size={16} className="text-critical" /> Detected Risks ({healthData?.critical_risks?.length || 0})
              </h3>
              <div className="space-y-2.5">
                {healthData?.critical_risks?.length > 0 ? (
                  healthData.critical_risks.map((r) => (
                    <div key={r.id} className="rounded-lg bg-canvas border border-line p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-ink">{r.risk_type}</span>
                        <SeverityBadge severity={r.severity} />
                      </div>
                      <p className="text-muted">{r.description}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted py-4">No critical risks flagged for this project.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-surface p-5">
              <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
                <Sparkles size={16} className="text-signal" /> AI Recommendations ({healthData?.top_recommendations?.length || 0})
              </h3>
              <div className="space-y-2.5">
                {healthData?.top_recommendations?.length > 0 ? (
                  healthData.top_recommendations.map((rec) => (
                    <div key={rec.id} className="rounded-lg bg-canvas border border-line p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-ink">{rec.title}</span>
                        <span className="font-mono text-[10px] text-signal font-semibold">Impact {rec.impact_score}/100</span>
                      </div>
                      <p className="text-muted">{rec.action_text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted py-4">No pending recommendations.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Sprints */}
      {activeTab === "sprints" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-ink">Project Sprints</h3>
            <Link to="/sprints" className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
              <Plus size={14} /> New Sprint
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sprints.map((s) => (
              <div key={s.id} className="rounded-xl border border-line bg-surface p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <StatusBadge status={s.status} />
                    <span className="font-mono text-xs text-muted">Target: {s.velocity_target} pts</span>
                  </div>
                  <h4 className="text-base font-semibold text-ink mt-2">{s.name}</h4>
                  <p className="text-xs text-muted mt-1 line-clamp-2">{s.goal || "No goal specified"}</p>
                </div>
                <div className="border-t border-line pt-3 flex items-center justify-between text-xs">
                  <span className="font-mono text-muted">
                    {s.stats?.completed_points ?? 0}/{s.stats?.total_points ?? s.velocity_target} pts
                  </span>
                  <Link to={`/sprints/${s.id}`} className="font-medium text-signal hover:underline">
                    View Burndown →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content: Tasks */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-ink">Project Tasks ({tasks.length})</h3>
            <Link to="/tasks" className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
              <Plus size={14} /> Add Task
            </Link>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-canvas font-medium text-muted">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Assignee</th>
                  <th className="px-4 py-3">Points</th>
                  <th className="px-4 py-3">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-canvas/50 transition">
                    <td className="px-4 py-3 font-medium text-ink">{t.title}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="px-4 py-3 text-muted">{t.assignee?.full_name || "Unassigned"}</td>
                    <td className="px-4 py-3 font-mono font-medium text-ink">{t.story_points} pts</td>
                    <td className="px-4 py-3 font-mono text-muted">{t.due_date || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Team */}
      {activeTab === "team" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-ink">Assigned Project Members</h3>
            <Link to="/team" className="btn-secondary text-xs py-1.5 px-3">
              Manage Team & Workload
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {teamMembers.map((m) => (
              <div key={m.id} className="rounded-xl border border-line bg-surface p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-white font-mono text-xs font-semibold">
                  {m.user?.full_name ? m.user.full_name.slice(0, 2).toUpperCase() : "TM"}
                </div>
                <div className="truncate">
                  <h4 className="text-sm font-semibold text-ink truncate">{m.user?.full_name || "Member"}</h4>
                  <p className="text-xs text-muted truncate">{m.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content: Risks & Recommendations */}
      {activeTab === "risks" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Risks list */}
          <div className="rounded-xl border border-line bg-surface p-5 space-y-4">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <ShieldAlert size={16} className="text-critical" /> Project Risks
            </h3>
            <div className="space-y-3">
              {healthData?.critical_risks?.map((r) => (
                <div key={r.id} className="rounded-lg bg-canvas border border-line p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink">{r.risk_type}</span>
                    <SeverityBadge severity={r.severity} />
                  </div>
                  <p className="text-muted leading-relaxed">{r.description}</p>
                  {r.mitigation && (
                    <p className="text-[11px] text-critical bg-critical/5 p-2 rounded border border-critical/20">
                      <strong>Mitigation: </strong>{r.mitigation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations list */}
          <div className="rounded-xl border border-line bg-surface p-5 space-y-4">
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Sparkles size={16} className="text-signal" /> Decision Recommendations
            </h3>
            <div className="space-y-3">
              {healthData?.top_recommendations?.map((rec) => (
                <div key={rec.id} className="rounded-lg bg-canvas border border-line p-3.5 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink">{rec.title}</span>
                    <span className="font-mono text-[10px] text-signal font-semibold">Impact {rec.impact_score}/100</span>
                  </div>
                  <p className="text-muted leading-relaxed">{rec.reason}</p>
                  <div className="bg-signal-soft/50 p-2 rounded border border-signal/20 font-medium text-ink">
                    <span className="text-signal font-semibold">Action: </span>{rec.action_text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectDetail;
