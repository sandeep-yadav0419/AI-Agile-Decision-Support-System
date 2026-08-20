import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  Clock,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../services/api";

export function NotificationDrawer({ isOpen, onClose, onUnreadCountChange }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifs = async () => {
    try {
      setLoading(true);
      const data = await getNotifications({ limit: 40 });
      setNotifications(data || []);
      const unread = (data || []).filter((n) => !n.is_read).length;
      if (onUnreadCountChange) onUnreadCountChange(unread);
    } catch (err) {
      console.error("Failed to load notifications", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
    // Poll notifications every 30s
    const timer = setInterval(fetchNotifs, 30000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      if (onUnreadCountChange) {
        onUnreadCountChange(
          notifications.filter((n) => n.id !== id && !n.is_read).length
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      if (onUnreadCountChange) onUnreadCountChange(0);
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-sm h-full bg-surface border-l border-line shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4 bg-canvas">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-signal" />
            <h3 className="text-sm font-semibold text-ink">Notifications</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-[11px] font-medium text-signal hover:underline flex items-center gap-1"
              title="Mark all as read"
            >
              <CheckCheck size={14} /> Mark read
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-muted hover:bg-surface hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
          {loading && notifications.length === 0 ? (
            <div className="py-12 text-center text-muted">Loading alerts...</div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center text-muted space-y-2">
              <Bell size={28} className="mx-auto text-line" />
              <p>No notifications yet.</p>
              <span className="text-[11px]">You are all caught up on agile tasks and risks.</span>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.is_read && handleMarkRead(n.id)}
                className={`p-3 rounded-xl border transition cursor-pointer ${
                  n.is_read
                    ? "border-line bg-surface opacity-80"
                    : "border-signal/30 bg-signal-soft/40 shadow-2xs"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-semibold text-ink">
                    {n.type === "ALERT" ? (
                      <ShieldAlert size={14} className="text-critical" />
                    ) : (
                      <Sparkles size={14} className="text-signal" />
                    )}
                    <span>{n.title}</span>
                  </div>
                  <span className="font-mono text-[10px] text-muted flex items-center gap-1 shrink-0">
                    <Clock size={11} />
                    {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <p className="mt-1 text-xs text-muted leading-relaxed">{n.message}</p>

                {n.link && (
                  <Link
                    to={n.link}
                    onClick={onClose}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-signal hover:underline"
                  >
                    <span>View in workspace</span>
                    <ExternalLink size={12} />
                  </Link>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
