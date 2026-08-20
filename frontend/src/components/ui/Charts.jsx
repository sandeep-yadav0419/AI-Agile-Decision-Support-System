import React from "react";

/**
 * Responsive Burndown Chart using pure SVG
 */
export function BurndownChart({ data, height = 240 }) {
  if (!data || data.length === 0) {
    return <div className="flex h-48 items-center justify-center text-xs text-muted">No burndown data available.</div>;
  }

  const padding = { top: 20, right: 30, bottom: 35, left: 40 };
  const width = 600; // viewBox width

  const maxPoints = Math.max(...data.map((d) => Math.max(d.ideal_points || 0, d.actual_points || 0, 10)), 20);
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const getX = (index) => padding.left + (index / (data.length - 1 || 1)) * chartW;
  const getY = (val) => padding.top + chartH - (val / maxPoints) * chartH;

  // Ideal Line path
  const idealPath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(d.ideal_points)}`)
    .join(" ");

  // Actual Line path (filter out null actuals)
  const actualData = data.filter((d) => d.actual_points !== null && d.actual_points !== undefined);
  const actualPath = actualData
    .map((d) => {
      const origIndex = data.findIndex((item) => item.day === d.day);
      return `${origIndex === 0 ? "M" : "L"} ${getX(origIndex)} ${getY(d.actual_points)}`;
    })
    .join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[450px]">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = padding.top + chartH * (1 - pct);
          const val = Math.round(maxPoints * pct);
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#e2e5ea"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" className="text-[10px] fill-muted font-mono">
                {val}
              </text>
            </g>
          );
        })}

        {/* Ideal Line (Dashed Slate) */}
        <path d={idealPath} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 5" />

        {/* Actual Line (Solid Deep Teal Signal) */}
        {actualData.length > 0 && (
          <path d={actualPath} fill="none" stroke="#0e7c6b" strokeWidth="3" />
        )}

        {/* Actual Data points */}
        {actualData.map((d) => {
          const origIndex = data.findIndex((item) => item.day === d.day);
          return (
            <circle
              key={d.day}
              cx={getX(origIndex)}
              cy={getY(d.actual_points)}
              r="4"
              fill="#0e7c6b"
              stroke="#ffffff"
              strokeWidth="2"
            />
          );
        })}

        {/* X-axis labels */}
        {data.map((d, i) => {
          // Show every 2nd or 3rd label if many days
          if (data.length > 8 && i % 2 !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={i}
              x={getX(i)}
              y={height - 8}
              textAnchor="middle"
              className="text-[10px] fill-muted font-mono"
            >
              {d.date || d.day}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex items-center justify-center gap-6 text-xs text-muted">
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-4 bg-slate-400 border-b border-dashed" />
          <span>Ideal Burndown</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-1 w-4 bg-signal rounded" />
          <span>Actual Remaining Points</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Responsive Sprint Velocity Bar Chart
 */
export function VelocityChart({ data, height = 220 }) {
  if (!data || data.length === 0) {
    return <div className="flex h-44 items-center justify-center text-xs text-muted">No sprint velocity history.</div>;
  }

  const padding = { top: 20, right: 20, bottom: 40, left: 35 };
  const width = 500;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map((d) => Math.max(d.target_velocity || 0, d.completed_points || 0)), 20);
  const groupWidth = chartW / data.length;
  const barWidth = Math.min(22, groupWidth * 0.35);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[380px]">
        {/* Grid */}
        {[0, 0.5, 1].map((pct, i) => {
          const y = padding.top + chartH * (1 - pct);
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#e2e5ea"
                strokeWidth="1"
              />
              <text x={padding.left - 6} y={y + 3} textAnchor="end" className="text-[10px] fill-muted font-mono">
                {Math.round(maxVal * pct)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const centerX = padding.left + i * groupWidth + groupWidth / 2;
          const targetH = (d.target_velocity / maxVal) * chartH;
          const completedH = (d.completed_points / maxVal) * chartH;

          return (
            <g key={d.sprint_id || i}>
              {/* Target Velocity Bar */}
              <rect
                x={centerX - barWidth - 2}
                y={padding.top + chartH - targetH}
                width={barWidth}
                height={targetH}
                fill="#cbd5e1"
                rx="3"
              />
              {/* Completed Points Bar */}
              <rect
                x={centerX + 2}
                y={padding.top + chartH - completedH}
                width={barWidth}
                height={completedH}
                fill="#0e7c6b"
                rx="3"
              />
              {/* Sprint label */}
              <text
                x={centerX}
                y={height - 15}
                textAnchor="middle"
                className="text-[10px] fill-ink font-medium"
              >
                {d.sprint_name?.length > 14 ? d.sprint_name.slice(0, 12) + "…" : d.sprint_name}
              </text>
              <text
                x={centerX}
                y={height - 2}
                textAnchor="middle"
                className="text-[9px] fill-muted font-mono"
              >
                {d.completed_points}/{d.target_velocity} pts
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-1 flex items-center justify-center gap-6 text-xs text-muted">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-slate-300" />
          <span>Target Velocity</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-signal" />
          <span>Completed Points</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Task Status Distribution Horizontal Bar
 */
export function StatusDistributionBar({ data }) {
  if (!data || data.length === 0) return null;

  const colorMap = {
    Backlog: "bg-slate-300",
    "To Do": "bg-indigo-300",
    "In Progress": "bg-amber-400",
    Review: "bg-sky-400",
    Done: "bg-emerald-500",
    Blocked: "bg-rose-500",
  };

  const total = data.reduce((acc, item) => acc + item.count, 0) || 1;

  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-line">
        {data.map((item) => {
          if (item.count === 0) return null;
          const pct = (item.count / total) * 100;
          return (
            <div
              key={item.status}
              style={{ width: `${pct}%` }}
              className={`${colorMap[item.status] || "bg-muted"} transition-all duration-300`}
              title={`${item.status}: ${item.count} tasks (${item.points} pts)`}
            />
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        {data.map((item) => (
          <div key={item.status} className="flex items-center justify-between rounded-lg border border-line bg-surface px-2.5 py-1.5">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${colorMap[item.status] || "bg-muted"}`} />
              <span className="text-muted font-medium">{item.status}</span>
            </div>
            <span className="font-mono font-semibold text-ink">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
