import React, { useEffect, useState } from "react";
import {
  BarChart3,
  FileSpreadsheet,
  Layers,
  PieChart,
  Printer,
  ShieldAlert,
  TrendingDown,
  Users,
} from "lucide-react";
import { getProjects, getReportCSVDownloadUrl, getReportsSummary } from "../services/api";
import { BurndownChart, StatusDistributionBar, VelocityChart } from "../components/ui/Charts.jsx";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton.jsx";

import { useProject } from "../context/project-context.js";

function Reports() {
  const { activeProjectId } = useProject();
  const [reports, setReports] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId || "All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeProjectId) {
      setSelectedProjectId(activeProjectId);
    }
  }, [activeProjectId]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = selectedProjectId !== "All" ? { project_id: selectedProjectId } : {};
      const [rData, pData] = await Promise.all([
        getReportsSummary(params),
        getProjects().catch(() => []),
      ]);
      setReports(rData);
      setProjects(pData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const url = getReportCSVDownloadUrl(selectedProjectId);
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Agile Analytics & Executive Reports</h1>
          <p className="mt-1 text-sm text-muted">
            Holistic project progress, velocity trends, team capacity distribution, and AI risk health.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleExportCSV}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 shadow-2xs"
            title="Download full project & task telemetry in CSV format"
          >
            <FileSpreadsheet size={14} className="text-signal" /> Export CSV
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 shadow-2xs"
            title="Print or save report as PDF"
          >
            <Printer size={14} /> Export PDF / Print
          </button>
        </div>
      </div>

      {/* Scope Filter */}
      <div className="flex items-center justify-between bg-surface p-3.5 rounded-xl border border-line">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>Reporting Scope:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none"
          >
            <option value="All">All Monitored Projects (Aggregated)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.key})
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs font-mono text-muted">
          Scope: <strong className="text-ink">{reports?.project_name || "Enterprise Wide"}</strong>
        </span>
      </div>

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : !reports ? (
        <div className="py-12 text-center text-muted text-xs">No analytics data available.</div>
      ) : (
        <div className="space-y-6">
          {/* Executive Metrics Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-line bg-surface p-5 shadow-xs">
              <span className="text-xs font-medium text-muted uppercase">OVERALL HEALTH</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-bold text-ink">
                  {reports.overall_health_score}
                </span>
                <span className="font-mono text-xs text-muted">/ 100</span>
              </div>
              <span className="text-xs text-signal font-medium mt-1 block">
                {reports.overall_health_score >= 80 ? "Optimal Sprint Cadence" : "Attention Required"}
              </span>
            </div>

            <div className="rounded-xl border border-line bg-surface p-5 shadow-xs">
              <span className="text-xs font-medium text-muted uppercase">COMPLETION RATE</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-bold text-ink">
                  {reports.completion_rate}%
                </span>
                <span className="text-xs text-muted">({reports.completed_tasks}/{reports.total_tasks} tasks)</span>
              </div>
              <span className="text-xs text-muted mt-1 block">
                {reports.completed_points}/{reports.total_points} total story points
              </span>
            </div>

            <div className="rounded-xl border border-line bg-surface p-5 shadow-xs">
              <span className="text-xs font-medium text-muted uppercase">AVERAGE VELOCITY</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-bold text-ink">
                  {reports.average_velocity}
                </span>
                <span className="text-xs text-muted">pts / sprint</span>
              </div>
              <span className="text-xs text-muted mt-1 block">Based on completed sprint cycles</span>
            </div>

            <div className="rounded-xl border border-line bg-surface p-5 shadow-xs">
              <span className="text-xs font-medium text-muted uppercase">MONITORED ITERATIONS</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-bold text-ink">
                  {reports.total_sprints}
                </span>
                <span className="text-xs text-muted">sprints</span>
              </div>
              <span className="text-xs text-muted mt-1 block">Across {reports.total_projects} projects</span>
            </div>
          </div>

          {/* Charts Row 1: Velocity & Burndown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sprint Velocity Chart */}
            <div className="rounded-xl border border-line bg-surface p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 size={18} className="text-signal" />
                  <h3 className="text-sm font-semibold text-ink">Sprint Velocity History</h3>
                </div>
                <span className="font-mono text-xs text-muted">Target vs Completed</span>
              </div>
              <VelocityChart data={reports.velocity_history} height={230} />
            </div>

            {/* Sprint Burndown Trajectory */}
            <div className="rounded-xl border border-line bg-surface p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <TrendingDown size={18} className="text-signal" />
                  <h3 className="text-sm font-semibold text-ink">Active Sprint Burndown</h3>
                </div>
                <span className="font-mono text-xs text-muted">Remaining Story Points</span>
              </div>
              <BurndownChart data={reports.burndown} height={230} />
            </div>
          </div>

          {/* Charts Row 2: Task Status & Priority Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Task Status Distribution */}
            <div className="rounded-xl border border-line bg-surface p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-signal" />
                  <h3 className="text-sm font-semibold text-ink">Task Status Breakdown</h3>
                </div>
                <span className="font-mono text-xs text-muted">{reports.total_tasks} Total Tasks</span>
              </div>
              <StatusDistributionBar data={reports.status_distribution} />
            </div>

            {/* Task Priority Breakdown */}
            <div className="rounded-xl border border-line bg-surface p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <PieChart size={18} className="text-signal" />
                  <h3 className="text-sm font-semibold text-ink">Priority Distribution</h3>
                </div>
                <span className="font-mono text-xs text-muted">Severity Ratio</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {reports.priority_distribution?.map((p) => (
                  <div key={p.priority} className="rounded-lg bg-canvas p-3 border border-line text-center">
                    <span className="text-xs text-muted block">{p.priority}</span>
                    <strong className="font-mono text-lg text-ink block mt-1">{p.count}</strong>
                    <span className="font-mono text-[10px] text-muted">{p.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Charts Row 3: Team Workload & AI Recommendations Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Team Capacity Load */}
            <div className="rounded-xl border border-line bg-surface p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-signal" />
                  <h3 className="text-sm font-semibold text-ink">Team Workload Distribution</h3>
                </div>
                <span className="font-mono text-xs text-muted">Active Points / Member</span>
              </div>

              <div className="space-y-3">
                {reports.workload_distribution?.map((member) => (
                  <div key={member.user_id} className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="font-medium text-ink">
                        {member.name} <span className="text-muted text-[11px]">({member.role})</span>
                      </span>
                      <span className="font-mono font-semibold text-ink">
                        {member.points} pts ({member.task_count} tasks) -{" "}
                        <span
                          className={
                            member.status === "Overloaded"
                              ? "text-rose-600 font-bold"
                              : member.status === "High"
                              ? "text-amber-600"
                              : "text-signal"
                          }
                        >
                          {member.status}
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-line overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          member.status === "Overloaded"
                            ? "bg-rose-600"
                            : member.status === "High"
                            ? "bg-amber-500"
                            : "bg-signal"
                        }`}
                        style={{ width: `${Math.min(100, (member.points / 25) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk & Recommendation Adoption */}
            <div className="rounded-xl border border-line bg-surface p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={18} className="text-critical" />
                  <h3 className="text-sm font-semibold text-ink">Risk Severity & Recommendations</h3>
                </div>
                <span className="font-mono text-xs text-muted">AI Decision Radar</span>
              </div>

              {/* Risk Severity count pills */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {reports.risk_distribution?.map((r) => (
                  <div key={r.severity} className="rounded-lg bg-canvas p-2.5 border border-line">
                    <span className="text-[10px] text-muted uppercase font-mono block">{r.severity}</span>
                    <strong
                      className={`font-mono text-base block mt-0.5 ${
                        r.severity === "CRITICAL"
                          ? "text-critical"
                          : r.severity === "HIGH"
                          ? "text-amber-600"
                          : "text-ink"
                      }`}
                    >
                      {r.active_count}
                    </strong>
                    <span className="text-[10px] text-muted">active</span>
                  </div>
                ))}
              </div>

              {/* Recommendations by Category */}
              <div className="pt-2">
                <span className="text-xs font-semibold text-ink block mb-2">
                  AI Recommendations by Domain:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {reports.recommendation_distribution?.map((cat) => (
                    <div
                      key={cat.category}
                      className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2"
                    >
                      <span className="text-muted font-medium">{cat.category}</span>
                      <span className="font-mono font-bold text-ink">
                        {cat.accepted}/{cat.total}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reports;
