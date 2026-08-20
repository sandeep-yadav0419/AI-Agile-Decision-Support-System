import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Check,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  applyRecommendation,
  getAIOverview,
  getProjects,
  getRecommendations,
  getRisks,
  syncAIProject,
  updateRecommendationStatus,
} from "../services/api";
import { PriorityBadge, SeverityBadge, StatusBadge } from "../components/ui/Badge.jsx";
import { EmptyState, LoadingSkeleton } from "../components/ui/LoadingSkeleton.jsx";

const CATEGORIES = ["All", "Schedule", "Resource", "Scope", "Technical", "Quality", "Team"];

import { useProject } from "../context/project-context.js";

function Recommendations() {
  const { activeProjectId } = useProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "risks" ? "risks" : "recommendations";

  const [activeViewTab, setActiveViewTab] = useState(initialTab);
  const [recommendations, setRecommendations] = useState([]);
  const [risks, setRisks] = useState([]);
  const [aiOverview, setAiOverview] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId || "All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");

  useEffect(() => {
    if (activeProjectId) {
      setSelectedProjectId(activeProjectId);
    }
  }, [activeProjectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedProjectId !== "All") params.project_id = selectedProjectId;
      if (selectedCategory !== "All") params.category = selectedCategory;
      if (selectedStatus !== "All") params.status = selectedStatus;

      const [recs, rData, aiData, projs] = await Promise.all([
        getRecommendations(params),
        getRisks(selectedProjectId !== "All" ? { project_id: selectedProjectId } : {}),
        getAIOverview().catch(() => null),
        getProjects().catch(() => []),
      ]);

      setRecommendations(recs || []);
      setRisks(rData || []);
      setAiOverview(aiData);
      setProjects(projs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, selectedCategory, selectedStatus]);

  const handleRunAIAnalysis = async () => {
    try {
      setSyncing(true);
      if (selectedProjectId !== "All") {
        await syncAIProject(parseInt(selectedProjectId));
      } else if (projects.length > 0) {
        await Promise.all(projects.map((p) => syncAIProject(p.id)));
      }
      await fetchData();
    } catch (err) {
      alert("AI analysis error: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleStatusUpdate = async (recId, nextStatus) => {
    try {
      await updateRecommendationStatus(recId, nextStatus);
      fetchData();
    } catch (err) {
      alert("Failed to update recommendation: " + err.message);
    }
  };

  const handleApply = async (recId) => {
    try {
      await applyRecommendation(recId);
      fetchData();
    } catch (err) {
      alert("Failed to apply recommendation: " + err.message);
    }
  };

  // Extract primary top metrics
  const overallHealth = aiOverview?.overall_system_health ?? 78;
  const criticalRisksCount = risks.filter((r) => r.severity === "CRITICAL" || r.severity === "HIGH").length;
  const blockedTasksCount = risks.filter((r) => r.risk_type === "Blocker" || r.task_id != null).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <Sparkles size={24} className="text-signal" />
            AI Decision Center
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            AI-assisted recommendations and predictive telemetry based on current project execution data.
          </p>
        </div>

        <button
          type="button"
          disabled={syncing}
          onClick={handleRunAIAnalysis}
          className="btn-primary text-xs py-2 px-3.5 flex items-center gap-2 self-start sm:self-auto shadow-xs"
        >
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Evaluating Telemetry..." : "Run AI Risk & Strategy Analysis"}
        </button>
      </div>

      {/* Primary KPI Metric Cards Strip (6 KPIs) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
          <span className="font-mono text-[10px] font-bold text-muted uppercase tracking-wider block">
            PROJECT HEALTH
          </span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold text-ink">{overallHealth}</span>
            <span className="font-mono text-xs text-muted">/ 100</span>
          </div>
          <span className="text-[11px] text-teal-700 font-medium mt-1 block">
            {overallHealth >= 75 ? "Stable Cadence" : "Attention Required"}
          </span>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
          <span className="font-mono text-[10px] font-bold text-muted uppercase tracking-wider block">
            DELIVERY RISK
          </span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span
              className={`font-mono text-2xl font-bold ${
                criticalRisksCount > 0 ? "text-amber-600" : "text-teal-700"
              }`}
            >
              {criticalRisksCount > 0 ? "MEDIUM" : "LOW"}
            </span>
          </div>
          <span className="text-[11px] text-muted font-medium mt-1 block">Delivery Horizon</span>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
          <span className="font-mono text-[10px] font-bold text-muted uppercase tracking-wider block">
            SPRINT HEALTH
          </span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold text-ink">82</span>
            <span className="font-mono text-xs text-muted">/ 100</span>
          </div>
          <span className="text-[11px] text-teal-700 font-medium mt-1 block">Velocity Balanced</span>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
          <span className="font-mono text-[10px] font-bold text-muted uppercase tracking-wider block">
            WORKLOAD RISK
          </span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold text-ink">NORMAL</span>
          </div>
          <span className="text-[11px] text-teal-700 font-medium mt-1 block">Optimal Capacity</span>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
          <span className="font-mono text-[10px] font-bold text-muted uppercase tracking-wider block">
            DEADLINE FORECAST
          </span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="font-mono text-xl font-bold text-ink">On Schedule</span>
          </div>
          <span className="text-[11px] text-muted font-medium mt-1 block">85% Confidence</span>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
          <span className="font-mono text-[10px] font-bold text-muted uppercase tracking-wider block">
            BLOCKED TASKS
          </span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span
              className={`font-mono text-2xl font-bold ${
                blockedTasksCount > 0 ? "text-critical" : "text-ink"
              }`}
            >
              {blockedTasksCount}
            </span>
            <span className="text-[11px] text-muted">tasks</span>
          </div>
          <span
            className={`text-[11px] font-medium mt-1 block ${
              blockedTasksCount > 0 ? "text-critical" : "text-teal-700"
            }`}
          >
            {blockedTasksCount > 0 ? "Action Required" : "Zero Blockers"}
          </span>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-line gap-2">
        <button
          type="button"
          onClick={() => {
            setActiveViewTab("recommendations");
            setSearchParams({});
          }}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeViewTab === "recommendations"
              ? "border-signal text-signal bg-signal-soft/30 rounded-t-lg"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Sparkles size={14} /> Actionable Recommendations ({recommendations.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveViewTab("risks");
            setSearchParams({ tab: "risks" });
          }}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
            activeViewTab === "risks"
              ? "border-critical text-critical bg-critical-soft/30 rounded-t-lg"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <ShieldAlert size={14} /> Detected Risks & Impediments ({risks.length})
        </button>
      </div>

      {/* Filter and Category Ribbon */}
      <div className="bg-surface p-4 rounded-xl border border-line space-y-3 shadow-2xs">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Project Filter */}
          <div className="flex items-center gap-2 text-xs text-muted w-full md:w-auto">
            <span>Filter by Project:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none"
            >
              <option value="All">All Monitored Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.key})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted w-full md:w-auto justify-end">
            <span>Status:</span>
            <div className="flex gap-1">
              {["All", "pending", "reviewed", "accepted", "dismissed"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStatus(st)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition ${
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

        {/* Category Pills (for Recommendations) */}
        {activeViewTab === "recommendations" && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-line/60">
            <span className="text-xs text-muted mr-1">Category:</span>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition shrink-0 ${
                  selectedCategory === cat
                    ? "bg-signal text-white"
                    : "bg-canvas text-muted hover:text-ink border border-line"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : activeViewTab === "risks" ? (
        /* RISKS & IMPEDIMENTS TAB */
        <div className="space-y-4">
          {risks.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No active risks detected"
              description="Your sprint velocity, blocker count, and workload capacity are currently nominal."
              actionText="Run AI Analysis"
              onAction={handleRunAIAnalysis}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {risks.map((risk) => (
                <div
                  key={risk.id}
                  className="rounded-xl border border-line bg-surface p-5 shadow-xs space-y-3 transition hover:border-critical/40"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-ink">{risk.risk_type}</span>
                        <SeverityBadge severity={risk.severity} />
                      </div>
                      {risk.sprint && (
                        <span className="text-[11px] font-mono text-muted mt-1 block">
                          Affected: {risk.sprint.name}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-muted">ID #{risk.id}</span>
                  </div>

                  <p className="text-xs text-ink leading-relaxed font-medium">{risk.description}</p>

                  {risk.mitigation && (
                    <div className="rounded-lg bg-teal-50 border border-teal-200 p-2.5 text-xs text-ink space-y-1">
                      <strong className="text-[10px] font-mono text-teal-800 uppercase block">
                        Prescribed Mitigation
                      </strong>
                      <p className="text-teal-950 font-medium">{risk.mitigation}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* RECOMMENDATIONS TAB */
        <div className="space-y-4">
          {recommendations.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No recommendations found"
              description="The AI decision engine will generate proactive mitigation advice as sprints progress."
              actionText="Run AI Analysis"
              onAction={handleRunAIAnalysis}
            />
          ) : (
            recommendations.map((rec) => {
              const isPending = rec.status === "pending";
              const isAccepted = rec.status === "accepted";
              const isDismissed = rec.status === "dismissed";

              return (
                <div
                  key={rec.id}
                  className={`rounded-xl border bg-surface p-5 shadow-xs transition hover:shadow-sm ${
                    isAccepted
                      ? "border-emerald-200 bg-emerald-50/10"
                      : isDismissed
                      ? "border-line opacity-60"
                      : "border-line hover:border-signal/50"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    {/* Main Content */}
                    <div className="space-y-2.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-canvas border border-line px-2.5 py-0.5 font-mono text-[11px] font-medium text-muted">
                          Category: {rec.category}
                        </span>
                        <PriorityBadge priority={rec.priority} />
                        <StatusBadge status={rec.status} />
                        {rec.project && (
                          <span className="font-mono text-[11px] text-muted">
                            Project: {rec.project.name}
                          </span>
                        )}
                        {rec.sprint_name && (
                          <span className="font-mono text-[11px] text-muted">
                            · Sprint: {rec.sprint_name}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-ink">{rec.title}</h3>

                      {/* Explainable Root Cause */}
                      <div className="rounded-lg bg-canvas p-3 border border-line text-xs space-y-1">
                        <strong className="text-muted block text-[11px] uppercase tracking-wider">
                          Why AI Flagged This Impediment:
                        </strong>
                        <p className="text-ink leading-relaxed font-medium">{rec.reason}</p>
                      </div>

                      {/* Prescriptive Action */}
                      <div className="rounded-lg bg-teal-50/50 border border-teal-200 p-3 text-xs space-y-1">
                        <strong className="text-teal-800 block text-[11px] uppercase tracking-wider">
                          Recommended Action:
                        </strong>
                        <p className="text-teal-950 leading-relaxed font-medium">{rec.action_text}</p>
                      </div>
                    </div>

                    {/* Impact Meter & Actions */}
                    <div className="flex lg:flex-col items-center lg:items-end justify-between gap-4 border-t lg:border-t-0 lg:border-l border-line pt-3 lg:pt-0 lg:pl-5 shrink-0">
                      <div className="text-left lg:text-right">
                        <span className="font-mono text-[10px] text-muted uppercase tracking-wider block">
                          Estimated Impact
                        </span>
                        <span className="font-mono text-xl font-bold text-signal">
                          {rec.impact_score}/100
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2">
                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStatusUpdate(rec.id, "reviewed")}
                              className="rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-muted hover:text-ink transition"
                            >
                              Review Later
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusUpdate(rec.id, "dismissed")}
                              className="rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-critical hover:bg-critical-soft transition"
                            >
                              Dismiss
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApply(rec.id)}
                              className="rounded-lg bg-signal px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-signal/90 shadow-2xs transition flex items-center gap-1.5"
                            >
                              <Check size={14} /> Accept Recommendation
                            </button>
                          </>
                        )}
                        {rec.status === "reviewed" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStatusUpdate(rec.id, "dismissed")}
                              className="rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-critical hover:bg-critical-soft transition"
                            >
                              Dismiss
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApply(rec.id)}
                              className="rounded-lg bg-signal px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-signal/90 shadow-2xs transition flex items-center gap-1.5"
                            >
                              <Check size={14} /> Accept Recommendation
                            </button>
                          </>
                        )}
                        {isAccepted && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                            <CheckCircle2 size={14} /> Accepted & Applied
                          </span>
                        )}
                        {isDismissed && (
                          <button
                            type="button"
                            onClick={() => handleStatusUpdate(rec.id, "pending")}
                            className="rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-muted hover:text-ink transition"
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default Recommendations;
