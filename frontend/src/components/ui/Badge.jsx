import React from "react";

export function StatusBadge({ status }) {
  const styles = {
    // Project statuses
    Planning: "bg-purple-50 text-purple-700 border-purple-200",
    Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    "On Hold": "bg-amber-50 text-amber-700 border-amber-200",
    Completed: "bg-blue-50 text-blue-700 border-blue-200",
    Cancelled: "bg-gray-50 text-gray-600 border-gray-200",

    // Sprint statuses
    Planned: "bg-purple-50 text-purple-700 border-purple-200",

    // Task statuses
    Backlog: "bg-slate-100 text-slate-700 border-slate-200",
    "To Do": "bg-indigo-50 text-indigo-700 border-indigo-200",
    "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
    Review: "bg-sky-50 text-sky-700 border-sky-200",
    Done: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Blocked: "bg-rose-50 text-rose-700 border-rose-200",

    // Recommendation statuses
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    reviewed: "bg-blue-50 text-blue-700 border-blue-200",
    accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dismissed: "bg-gray-100 text-gray-600 border-gray-200",
  };

  const styleClass = styles[status] || "bg-canvas text-ink border-line";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styleClass}`}
    >
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const styles = {
    Low: "bg-slate-100 text-slate-600 border-slate-200",
    Medium: "bg-blue-50 text-blue-700 border-blue-200",
    High: "bg-amber-50 text-amber-700 border-amber-200",
    Critical: "bg-rose-50 text-rose-700 border-rose-200 font-semibold",
  };

  const styleClass = styles[priority] || "bg-canvas text-ink border-line";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styleClass}`}
    >
      {priority}
    </span>
  );
}

export function SeverityBadge({ severity }) {
  const styles = {
    LOW: "bg-slate-100 text-slate-700 border-slate-200",
    MEDIUM: "bg-blue-50 text-blue-700 border-blue-200",
    HIGH: "bg-amber-50 text-amber-700 border-amber-200 font-medium",
    CRITICAL: "bg-rose-50 text-rose-700 border-rose-200 font-semibold animate-pulse",
  };

  const styleClass = styles[severity?.toUpperCase()] || "bg-canvas text-ink border-line";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider ${styleClass}`}
    >
      {severity}
    </span>
  );
}

export function HealthScoreBadge({ score }) {
  let color = "text-emerald-700 bg-emerald-50 border-emerald-200";
  let label = "Optimal";
  if (score < 50) {
    color = "text-rose-700 bg-rose-50 border-rose-200";
    label = "Critical";
  } else if (score < 75) {
    color = "text-amber-700 bg-amber-50 border-amber-200";
    label = "At Risk";
  } else if (score < 88) {
    color = "text-blue-700 bg-blue-50 border-blue-200";
    label = "Good";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${color}`}
    >
      <span className="font-mono font-bold text-sm">{score}</span>
      <span className="opacity-80">/ 100 ({label})</span>
    </span>
  );
}

export function WorkloadBadge({ status }) {
  const styles = {
    "Low Workload": "bg-slate-100 text-slate-700 border-slate-200",
    "Normal Workload": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "High Workload": "bg-amber-50 text-amber-700 border-amber-200",
    Overloaded: "bg-rose-50 text-rose-700 border-rose-200 font-semibold animate-pulse",
  };

  const styleClass = styles[status] || "bg-canvas text-ink border-line";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styleClass}`}
    >
      {status}
    </span>
  );
}
