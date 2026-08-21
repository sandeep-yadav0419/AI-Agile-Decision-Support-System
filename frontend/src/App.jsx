import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ProjectProvider } from "./context/ProjectContext.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import RedirectIfAuthed from "./components/RedirectIfAuthed.jsx";
import DashboardLayout from "./layouts/DashboardLayout.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

import Dashboard from "./pages/Dashboard.jsx";
import Projects from "./pages/Projects.jsx";
import ProjectDetail from "./pages/ProjectDetail.jsx";
import Sprints from "./pages/Sprints.jsx";
import SprintDetail from "./pages/SprintDetail.jsx";
import Tasks from "./pages/Tasks.jsx";
import KanbanBoard from "./pages/KanbanBoard.jsx";
import Team from "./pages/Team.jsx";
import Recommendations from "./pages/Recommendations.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ProjectProvider>
            <Routes>
              {/* Public Auth Routes */}
              <Route
                path="/login"
                element={
                  <RedirectIfAuthed>
                    <Login />
                  </RedirectIfAuthed>
                }
              />
              <Route
                path="/register"
                element={
                  <RedirectIfAuthed>
                    <Register />
                  </RedirectIfAuthed>
                }
              />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Protected Routes inside DashboardLayout */}
              <Route
                element={
                  <RequireAuth>
                    <DashboardLayout />
                  </RequireAuth>
                }
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/sprints" element={<Sprints />} />
                <Route path="/sprints/:id" element={<SprintDetail />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/kanban" element={<KanbanBoard />} />
                <Route path="/team" element={<Team />} />
                <Route path="/recommendations" element={<Recommendations />} />
                <Route path="/ai-insights" element={<Recommendations />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
              </Route>

              {/* Fallback to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ProjectProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
