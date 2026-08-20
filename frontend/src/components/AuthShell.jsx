import React from "react";
import {
  Activity,
  Cpu,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

function AuthShell({ children }) {
  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col lg:flex-row">
      {/* Left Column: Brand & Value Highlights */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-between p-12 lg:p-16 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white overflow-hidden">
        {/* Subtle decorative grid background */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: "28px 28px",
          }}
        />

        {/* Brand Header */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500 text-slate-950 font-mono font-bold text-base shadow-lg shadow-teal-500/20">
              AI
            </div>
            <div>
              <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-teal-400">
                Decision Support System
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">AI-DSS Platform</h2>
            </div>
          </div>
        </div>

        {/* Center Hero Message */}
        <div className="relative z-10 my-auto py-12 max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3.5 py-1 text-xs font-medium text-teal-300">
            <Sparkles size={14} className="text-teal-400" />
            Autonomous Agile Decision Intelligence
          </div>

          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
            AI-Driven Agile <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-300">
              Decision Support
            </span>
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed">
            Predict sprint risks before deadlines slip, balance team capacity in real time, and drive data-backed Agile decisions with explainable intelligence.
          </p>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-4">
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 backdrop-blur-xs p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-teal-400 text-xs font-semibold">
                <TrendingUp size={16} /> Predictive Velocity
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Deterministic burndown forecasting and delay probability modeling.
              </p>
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 backdrop-blur-xs p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-teal-400 text-xs font-semibold">
                <Activity size={16} /> Workload Balancing
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Detect burnout bottlenecks and optimize active story point distribution.
              </p>
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 backdrop-blur-xs p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-teal-400 text-xs font-semibold">
                <ShieldCheck size={16} /> Risk Radar
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Autonomous impediment detection across blockers, scope, and deadlines.
              </p>
            </div>

            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 backdrop-blur-xs p-3.5 space-y-1">
              <div className="flex items-center gap-2 text-teal-400 text-xs font-semibold">
                <Cpu size={16} /> 1-Click Mitigation
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Prescriptive actions to rebalance tasks and restore sprint health.
              </p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-6">
          <span className="font-mono text-[11px]">Production Build v1.0.0</span>
          <span>Enterprise Decision Engine</span>
        </div>
      </div>

      {/* Right Column: Authentication Card */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md">
          {/* Mobile Top Brand (visible only on small screens) */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-white font-mono font-bold text-sm">
              AI
            </div>
            <div>
              <span className="font-mono text-[10px] uppercase font-bold text-signal tracking-widest">
                AI-DSS Platform
              </span>
              <p className="text-sm font-bold text-ink">Agile Decision Support</p>
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

export default AuthShell;
