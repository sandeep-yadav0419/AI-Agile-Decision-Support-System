import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth-context.js";
import { getProjects } from "../services/api";
import { ProjectContext } from "./project-context.js";

const ACTIVE_PROJECT_KEY = "aidss_active_project_id";

export function ProjectProvider({ children }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectIdState] = useState(() => {
    const saved = localStorage.getItem(ACTIVE_PROJECT_KEY);
    return saved ? (saved === "All" ? "All" : Number(saved)) : "All";
  });
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  const fetchProjects = useCallback(async () => {
    // Only fetch if authentication state is resolved and user is authenticated
    if (isAuthLoading || !isAuthenticated) {
      if (!isAuthenticated && !isAuthLoading) {
        setProjects([]);
      }
      return;
    }

    try {
      setIsLoadingProjects(true);
      const data = await getProjects();
      const list = Array.isArray(data) ? data : [];
      setProjects(list);

      // Auto-validate activeProjectId
      if (list.length > 0) {
        if (activeProjectId !== "All") {
          const exists = list.some((p) => p.id === Number(activeProjectId));
          if (!exists) {
            setActiveProjectIdState(list[0].id);
            localStorage.setItem(ACTIVE_PROJECT_KEY, String(list[0].id));
          }
        }
      } else {
        setActiveProjectIdState("All");
        localStorage.removeItem(ACTIVE_PROJECT_KEY);
      }
    } catch (err) {
      console.error("[ProjectContext] Failed to load user projects", err);
    } finally {
      setIsLoadingProjects(false);
    }
  }, [isAuthenticated, isAuthLoading, activeProjectId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const setActiveProjectId = (id) => {
    setActiveProjectIdState(id);
    if (id === "All") {
      localStorage.setItem(ACTIVE_PROJECT_KEY, "All");
    } else {
      localStorage.setItem(ACTIVE_PROJECT_KEY, String(id));
    }
  };

  const activeProject = useMemo(() => {
    if (activeProjectId === "All" || !activeProjectId) return null;
    return projects.find((p) => p.id === Number(activeProjectId)) || null;
  }, [projects, activeProjectId]);

  const value = useMemo(
    () => ({
      projects,
      activeProject,
      activeProjectId,
      setActiveProjectId,
      isLoadingProjects,
      refreshProjects: fetchProjects,
      hasProjects: projects.length > 0,
    }),
    [projects, activeProject, activeProjectId, isLoadingProjects, fetchProjects]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export default ProjectProvider;
