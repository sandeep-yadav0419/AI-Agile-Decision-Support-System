import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  FolderKanban,
  Layers,
  Search,
  User,
  X,
} from "lucide-react";
import { globalSearch } from "../services/api";

export function GlobalSearchModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ projects: [], tasks: [], sprints: [], members: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults({ projects: [], tasks: [], sprints: [], members: [] });
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ projects: [], tasks: [], sprints: [], members: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await globalSearch(query.trim());
        setResults(res || { projects: [], tasks: [], sprints: [], members: [] });
      } catch (err) {
        console.error("Search error", err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handleSelect = (link) => {
    onClose();
    if (link) navigate(link);
  };

  const hasAnyResults =
    results.projects.length > 0 ||
    results.tasks.length > 0 ||
    results.sprints.length > 0 ||
    results.members.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-20 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-2xl border border-line bg-surface shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5 bg-canvas">
          <Search size={18} className="text-muted" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your authorized projects, tasks, sprints, members..."
            className="w-full bg-transparent text-sm text-ink placeholder:text-muted outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-surface hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto p-4 space-y-4 text-xs">
          {loading && <div className="py-6 text-center text-muted">Searching workspace...</div>}

          {!loading && !query && (
            <div className="py-6 text-center text-muted">
              Type project key, task title, sprint goal, or member name.
            </div>
          )}

          {!loading && query && !hasAnyResults && (
            <div className="py-6 text-center text-muted">
              No matching authorized resources found for &quot;{query}&quot;.
            </div>
          )}

          {/* Projects */}
          {results.projects.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted px-2">Projects</span>
              {results.projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p.link)}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-canvas transition text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <FolderKanban size={15} className="text-signal" />
                    <span className="font-semibold text-ink">{p.name}</span>
                    <span className="font-mono text-[10px] text-muted">[{p.key}]</span>
                  </div>
                  <span className="text-[10px] bg-line px-1.5 py-0.5 rounded text-muted">{p.status}</span>
                </button>
              ))}
            </div>
          )}

          {/* Tasks */}
          {results.tasks.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted px-2">Tasks</span>
              {results.tasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelect(t.link)}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-canvas transition text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 size={15} className="text-signal" />
                    <span className="font-medium text-ink truncate max-w-xs">{t.title}</span>
                    {t.project_key && <span className="font-mono text-[10px] text-muted">[{t.project_key}]</span>}
                  </div>
                  <span className="text-[10px] text-muted">{t.status}</span>
                </button>
              ))}
            </div>
          )}

          {/* Sprints */}
          {results.sprints.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted px-2">Sprints</span>
              {results.sprints.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelect(s.link)}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-canvas transition text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Layers size={15} className="text-signal" />
                    <span className="font-medium text-ink">{s.name}</span>
                  </div>
                  <span className="text-[10px] text-muted">{s.status}</span>
                </button>
              ))}
            </div>
          )}

          {/* Members */}
          {results.members.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted px-2">Team Members</span>
              {results.members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelect(m.link)}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-canvas transition text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <User size={15} className="text-signal" />
                    <span className="font-medium text-ink">{m.name}</span>
                    <span className="text-[10px] text-muted">({m.email})</span>
                  </div>
                  <span className="text-[10px] text-muted">{m.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
