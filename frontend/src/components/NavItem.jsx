import { NavLink } from "react-router-dom";

function NavItem({ icon: Icon, label, to, onNavigate, badge }) {
  const baseClasses =
    "group flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150";

  return (
    <NavLink
      to={to}
      end={to === "/"}
      onClick={onNavigate}
      className={({ isActive }) =>
        `${baseClasses} ${
          isActive
            ? "bg-slate-900 text-white font-semibold shadow-xs"
            : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
        }`
      }
    >
      <div className="flex items-center gap-2.5">
        <Icon size={16} strokeWidth={2} className="shrink-0" />
        <span>{label}</span>
      </div>
      {badge && (
        <span className="rounded-full bg-teal-500/15 text-teal-700 px-1.5 py-0.5 font-mono text-[10px] font-bold">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

export default NavItem;
