import {
  BarChart3,
  Columns3,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Rocket,
  Settings,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import NavItem from "./NavItem.jsx";
import { useAuth } from "../context/auth-context.js";

const WORKSPACE_NAV = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Projects", to: "/projects", icon: FolderKanban },
  { label: "Sprints", to: "/sprints", icon: Rocket },
  { label: "Tasks", to: "/tasks", icon: ListChecks },
  { label: "Kanban Board", to: "/kanban", icon: Columns3 },
  { label: "Team", to: "/team", icon: Users },
];

const INTELLIGENCE_NAV = [
  { label: "AI Recommendations", to: "/recommendations", icon: Sparkles },
  { label: "Risk Center", to: "/recommendations?tab=risks", icon: ShieldAlert },
  { label: "Reports", to: "/reports", icon: BarChart3 },
];

function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth();

  const userInitials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "AI";

  return (
    <div className="flex h-full flex-col justify-between bg-surface border-r border-line select-none">
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Brand Header */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-teal-400 font-mono text-sm font-bold shadow-xs">
            AI
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-ink tracking-tight">AI-DSS</span>
              <span className="rounded bg-teal-50 text-teal-700 border border-teal-200/60 px-1.5 py-0.2 font-mono text-[9px] font-bold">
                ENTERPRISE
              </span>
            </div>
            <p className="text-[11px] text-muted leading-tight mt-0.5">Decision Support</p>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="space-y-6 px-3 py-4">
          {/* WORKSPACE Group */}
          <div>
            <span className="px-3 text-[10px] font-mono font-bold tracking-wider text-muted uppercase">
              WORKSPACE
            </span>
            <nav className="mt-1.5 space-y-0.5">
              {WORKSPACE_NAV.map((item) => (
                <NavItem key={item.label} {...item} onNavigate={onNavigate} />
              ))}
            </nav>
          </div>

          {/* INTELLIGENCE Group */}
          <div>
            <span className="px-3 text-[10px] font-mono font-bold tracking-wider text-teal-700 uppercase flex items-center gap-1">
              <Sparkles size={11} className="text-teal-600" />
              INTELLIGENCE
            </span>
            <nav className="mt-1.5 space-y-0.5">
              {INTELLIGENCE_NAV.map((item) => (
                <NavItem key={item.label} {...item} onNavigate={onNavigate} />
              ))}
            </nav>
          </div>

          {/* ACCOUNT Group */}
          <div>
            <span className="px-3 text-[10px] font-mono font-bold tracking-wider text-muted uppercase">
              ACCOUNT
            </span>
            <nav className="mt-1.5 space-y-0.5">
              <NavItem label="Settings" to="/settings" icon={Settings} onNavigate={onNavigate} />
            </nav>
          </div>
        </div>
      </div>

      {/* User Profile & Logout Strip at Bottom */}
      <div className="border-t border-line p-3 bg-canvas/60">
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl border border-line bg-surface shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white font-mono text-xs font-bold">
              {userInitials}
            </div>
            <div className="min-w-0 truncate">
              <p className="text-xs font-semibold text-ink truncate leading-tight">
                {user?.full_name || "Enterprise User"}
              </p>
              <p className="text-[10px] text-muted truncate">{user?.role || "Developer"}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onNavigate) onNavigate();
              logout();
            }}
            title="Log out of session"
            className="rounded-lg p-1.5 text-muted hover:bg-rose-50 hover:text-rose-600 transition shrink-0"
            aria-label="Logout"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
