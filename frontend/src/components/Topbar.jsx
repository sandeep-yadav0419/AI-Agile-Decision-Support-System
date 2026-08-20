import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Bell,
  FolderKanban,
  Menu,
  MessageSquareText,
  Plus,
  Search,
} from "lucide-react";
import { useProject } from "../context/project-context.js";
import { CheckInModal } from "./CheckInModal.jsx";
import { GlobalSearchModal } from "./GlobalSearchModal.jsx";
import { NotificationDrawer } from "./NotificationDrawer.jsx";
import UserMenu from "./UserMenu.jsx";

const PAGE_TITLES = {
  "/": "Dashboard",
  "/projects": "Projects",
  "/sprints": "Sprint Management",
  "/tasks": "Task Management",
  "/kanban": "Kanban Board",
  "/team": "Team & Workload",
  "/recommendations": "AI Decision Support",
  "/reports": "Analytics & Reports",
  "/settings": "Account & Settings",
};

function Topbar({ onOpenSidebar }) {
  const location = useLocation();
  const { projects, activeProjectId, setActiveProjectId } = useProject();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatted = now.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      setCurrentTime(formatted);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut Cmd+K or Ctrl+K for search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  let title = PAGE_TITLES[location.pathname];
  if (!title) {
    if (location.pathname.startsWith("/projects/")) title = "Project Details";
    else if (location.pathname.startsWith("/sprints/")) title = "Sprint Details";
    else if (location.pathname.startsWith("/tasks/")) title = "Task Details";
    else title = "Dashboard";
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-2.5 sm:px-6 lg:px-8">
        {/* Left Side: Mobile burger + Page Title + Project Switcher */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="rounded-lg p-1.5 text-ink transition hover:bg-canvas md:hidden"
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>

          <div className="hidden lg:block">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
          </div>

          {/* Project Switcher */}
          <div className="relative flex items-center gap-1.5 border-l border-line pl-3 ml-1">
            <FolderKanban size={15} className="text-signal shrink-0 hidden sm:inline" />
            <select
              value={activeProjectId || "All"}
              onChange={(e) => setActiveProjectId(e.target.value === "All" ? "All" : Number(e.target.value))}
              className="rounded-lg border border-line bg-canvas px-2.5 py-1 text-xs font-semibold text-ink outline-none cursor-pointer max-w-[160px] sm:max-w-[210px] truncate"
            >
              <option value="All">All Authorized Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.key})
                </option>
              ))}
            </select>

            <Link
              to="/projects"
              className="rounded-lg border border-line p-1 text-muted hover:bg-canvas hover:text-ink transition hidden sm:inline-flex"
              title="Manage Projects / + New Project"
            >
              <Plus size={14} />
            </Link>
          </div>
        </div>

        {/* Right Side: Search, Check-In, Date, Notifications, User Menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Search trigger */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-2.5 py-1 text-xs text-muted hover:text-ink hover:bg-surface transition"
            title="Search workspace (Cmd+K)"
          >
            <Search size={13} />
            <span className="hidden md:inline">Search...</span>
            <kbd className="hidden md:inline-block rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted border border-line">
              ⌘K
            </kbd>
          </button>

          {/* Daily Standup Check-in */}
          <button
            type="button"
            onClick={() => setIsCheckInOpen(true)}
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:bg-canvas transition shadow-2xs"
            title="Submit Daily Agile Standup"
          >
            <MessageSquareText size={13} className="text-signal" />
            <span>Check-In</span>
          </button>

          {/* Real Date Indicator */}
          {currentTime && (
            <span className="hidden xl:inline text-[11px] font-mono text-muted border-l border-line pl-2.5">
              {currentTime}
            </span>
          )}

          {/* Notifications Bell */}
          <button
            type="button"
            onClick={() => setIsNotifOpen(true)}
            className="relative rounded-lg border border-line p-1.5 text-muted hover:text-ink hover:bg-canvas transition"
            title="Notifications"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-critical font-mono text-[9px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          <UserMenu />
        </div>
      </header>

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      {/* Daily Check-In Modal */}
      <CheckInModal
        isOpen={isCheckInOpen}
        onClose={() => setIsCheckInOpen(false)}
      />

      {/* Notifications Drawer */}
      <NotificationDrawer
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        onUnreadCountChange={setUnreadCount}
      />
    </>
  );
}

export default Topbar;
