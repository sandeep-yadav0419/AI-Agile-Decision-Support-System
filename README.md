# AI-Driven Autonomous Decision Support System for Agile Software Project Management

An AI-assisted platform for managing agile software projects — projects, sprints,
tasks, a Kanban board, and an AI decision/recommendation engine on top.

The current release covers the complete project-management workflow: secure
authentication, projects, sprints, tasks, Kanban, teams, explainable decision
support, recommendations, risks, forecasts, reports, settings and automated tests.

## Tech stack

| Layer    | Choice                                                        |
|----------|-----------------------------------------------------------------|
| Backend  | FastAPI, SQLAlchemy 2.x, SQLite/PostgreSQL, Alembic, Pydantic Settings |
| Frontend | React 19, Vite, Tailwind CSS v4, React Router v7, lucide-react (icons)  |
| Auth     | JWT bearer tokens (PyJWT), bcrypt password hashing               |

## Authentication

- `POST /api/auth/register` — `{ email, password, full_name }` → creates the
  user and returns a token + user object (register logs you in immediately).
- `POST /api/auth/login` — `{ email, password }` → same token + user shape.
- `GET /api/auth/me` — requires `Authorization: Bearer <token>` → returns the
  current user; used by the frontend to revalidate a stored token on load.

Tokens are signed with HS256 and expire after 24h (`ACCESS_TOKEN_EXPIRE_MINUTES`
in `.env`). Passwords are hashed with bcrypt — never stored or logged in
plaintext. The frontend stores the token in `localStorage` and attaches it to
every request via an axios default header; a 401 from any request triggers an
automatic logout.

The application also supports Google/GitHub OAuth, one-time OAuth state
correlation, optional TOTP MFA with recovery codes, account lockout and a
short-lived password-reset flow. Development exposes a reset link for local
testing; production requires a transactional email provider to deliver it.

**Deliberate scope boundaries for this feature** (not oversights):
- No refresh tokens / token rotation — a single 24h access token, matching
  what was asked for. Would be a natural hardening step later.
- No server-side logout / revocation list — JWTs are stateless by design, so
  logout is client-side token deletion. Revocation would need a denylist or
  much shorter-lived tokens with refresh rotation.
- `localStorage` for token storage (standard for SPA JWT auth) rather than an
  httpOnly cookie — simpler, but readable by JS (XSS-exposed) in a way a
  cookie wouldn't be. Worth revisiting if this becomes internet-facing.

## Production safety

- Production startup fails when JWT/CSRF secrets are missing, known defaults,
  or shorter than 32 characters.
- `ENABLE_DEMO_SEED=False` is mandatory in production. The seed endpoint is
  hidden in production and role-protected in development.
- Alembic owns schema versioning. Run `alembic upgrade head` before starting a
  deployment; application startup also applies outstanding migrations.
- GitHub Actions validates backend compilation, migrations and pytest, plus
  frontend lint, unit tests and the production build.

## Dashboard layout

Every authenticated page now renders inside `DashboardLayout` (sidebar + topbar
+ `<Outlet />`), added as a React Router layout route so future pages
(Projects, Sprints, ...) just add a sibling `<Route>` — no chrome to rebuild.

- **Sidebar**: real, routable nav for pages that exist (currently just
  Dashboard); everything else in the build order (Projects, Sprints, Tasks,
  Kanban Board, Team, AI Recommendations, Reports, Settings) shows as a
  disabled row with a "Soon" badge. These are intentionally **not** links —
  there's no page behind them yet, so rendering them as dead `<a>` tags would
  be exactly the kind of placeholder this project avoids. They light up as
  each feature is actually built.
- **Topbar**: mobile menu toggle, current page title, a disabled notifications
  bell (Feature 13), and a real user menu (avatar, name, email, working
  logout) with click-outside and Escape-to-close.
- **Responsive**: sidebar is an overlay on mobile (hamburger-triggered, closes
  on backdrop click or on navigating), a static column on desktop (`md:` and
  up).

One honest caveat: this sandbox has no browser, so I verified the build
compiles, lints clean, every module loads without error, and the underlying
auth flow still works end-to-end through the new layout — but the sidebar
toggle and user-menu dropdown are standard, well-tested React patterns that I
could not visually click-test. Worth a quick look when you run it locally.

```
agile-ai-dss/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app, CORS, DB lifespan, health check, routers
│   │   ├── config.py         # env-based settings (pydantic-settings)
│   │   ├── database.py       # SQLAlchemy engine / session / Base
│   │   ├── core/
│   │   │   └── security.py   # password hashing, JWT issue/verify, get_current_user
│   │   ├── models/
│   │   │   └── user.py       # User ORM model
│   │   ├── schemas/
│   │   │   └── user.py       # UserCreate, UserLogin, UserResponse, Token
│   │   └── routers/
│   │       └── auth.py       # /api/auth/register, /login, /me
│   ├── requirements.txt
│   └── .env
└── frontend/
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx                    # Routes: /login, /register, and a DashboardLayout route tree
    │   ├── index.css                  # Tailwind v4 + design tokens (@theme) + form/button primitives
    │   ├── layouts/
    │   │   └── DashboardLayout.jsx    # sidebar + topbar shell, <Outlet /> for routed pages
    │   ├── context/
    │   │   ├── auth-context.js        # AuthContext + useAuth hook
    │   │   └── AuthContext.jsx        # AuthProvider (session state, login/register/logout)
    │   ├── components/
    │   │   ├── AuthShell.jsx          # shared layout for auth pages
    │   │   ├── RequireAuth.jsx        # route guard: redirect to /login if signed out
    │   │   ├── RedirectIfAuthed.jsx   # route guard: redirect to / if already signed in
    │   │   ├── Sidebar.jsx            # nav (real + honestly-disabled "Soon" items)
    │   │   ├── NavItem.jsx            # single nav row, active/disabled states
    │   │   ├── Topbar.jsx             # mobile toggle, page title, notifications, user menu
    │   │   └── UserMenu.jsx           # avatar dropdown: user info + logout
    │   ├── pages/
    │   │   ├── Dashboard.jsx          # protected: welcome + live diagnostics panel
    │   │   ├── Login.jsx
    │   │   └── Register.jsx
    │   └── services/
    │       └── api.js                 # axios client, auth header, 401 handler
    ├── package.json
    └── .env
```

## Running it locally

### Backend (port 8000)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API root: http://localhost:8000/
- Health check: http://localhost:8000/api/health
- Interactive docs: http://localhost:8000/docs

A `.env` is already included with working defaults — nothing to configure to get started.

### Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — it calls the backend's `/api/health` on load and
shows a live "system diagnostics" panel (API reachable? DB connected?). Run
the backend first, or refresh once it's up.

> The two `.env` files are already wired to talk to each other on localhost.
> If you deploy them separately, update `VITE_API_BASE_URL` (frontend) and
> replace `CORS_ORIGIN_REGEX` in `backend/app/config.py` with your real
> frontend origin(s) — the regex default only matches localhost/127.0.0.1.

## Design system

Tokens live in `frontend/src/index.css` under `@theme`: IBM Plex Sans/Mono
for type, a light "canvas/surface" palette, and a teal `signal` /
brick-red `critical` pair for status. Every later screen should reuse these
tokens (`bg-canvas`, `text-muted`, `border-line`, `bg-signal`, etc.) rather
than introducing new colors ad hoc.

## Feature roadmap

- [x] **01 — Project Setup** — backend + frontend scaffolds, wired together, health check verifying live DB connectivity
- [x] **02 — Authentication** — JWT register/login/me, bcrypt hashing, protected routes, persistent session
- [x] **03 — Dashboard Layout** — responsive sidebar + topbar shell, user menu, nested routing for all pages
- [x] **04 — Project CRUD** — Project list, create, edit, delete, status/priority filters, project details view
- [x] **05 — Sprint CRUD** — Sprint lifecycle, start/complete actions, velocity targets, dates, burndown trajectory
- [x] **06 — Task CRUD** — Task creation, sprint assignment, assignee allocation, priority and due date tracking
- [x] **07 — Kanban Board** — Interactive 6-column drag-and-drop board with optimistic UI and live database synchronization
- [x] **08 — Team Management** — Team directory, workload capacity indicators (Low, Normal, High, Overloaded), role assignments
- [x] **09 — AI Decision Engine** — Deterministic agile intelligence computing sprint health score, delivery risk, delay probability, workload imbalances
- [x] **10 — AI Recommendation Center** — Actionable prescriptive recommendations categorized by Schedule, Resource, Scope, Technical, Quality, Team with 1-click Accept/Apply
- [x] **11 — Risk Detection** — Proactive impediment tracking for overdue tasks, blockers, schedule slip, and developer overload
- [x] **12 — Delivery Forecast** — Explainable mathematical completion predictor based on velocity and remaining story points
- [x] **13 — Analytics & Reports** — Velocity bar charts, burndown SVG charts, status & priority distribution, workload capacity breakdown
- [x] **14 — Settings & Profile** — User profile updates, secure password change, application diagnostics
- [x] **15 — Full End-to-End Testing** — Automated integration test suite validating the entire full-stack flow

## Troubleshooting

**Browser console shows "Could not connect to the server" and/or "XMLHttpRequest
cannot load .../api/auth/... due to access control checks" on login/register.**
This looks like a CORS error but almost always means the request never
reached the backend at all:

1. Check the backend is actually running — its terminal should show
   `Uvicorn running on http://0.0.0.0:8000`, not an error.
2. Open `http://127.0.0.1:8000/api/health` directly in a new browser tab. If
   you don't get JSON back, the backend isn't reachable — start it (see
   above) and check its terminal output for a startup error (commonly a
   missing `.env` / `SECRET_KEY`).
3. If the backend *is* running and this still happens on Safari/macOS
   specifically: `localhost` can resolve to both an IPv4 and IPv6 loopback
   address there, and uvicorn only listens on IPv4. The frontend already
   points at `http://127.0.0.1:8000` (not `localhost`) by default for
   exactly this reason — if you changed `VITE_API_BASE_URL` back to
   `localhost`, switch it back to `127.0.0.1`.

**Backend terminal shows `"OPTIONS /api/auth/... HTTP/1.1" 400 Bad Request`.**
This is the browser's CORS preflight being rejected — it means the backend
got reached (progress from the issue above) but doesn't recognize your
frontend's exact origin. Historically this happened because the backend
only allow-listed `http://localhost:5173` exactly, and Vite auto-increments
to 5174, 5175, etc. whenever 5173 is already taken (e.g. another `npm run
dev` left running) — so a mismatched port would fail every single request.
Fixed as of this delivery: the backend now matches any port on
`localhost`/`127.0.0.1` via `CORS_ORIGIN_REGEX` in `backend/app/config.py`
rather than one hardcoded port. If you still see this, check the origin
your frontend is actually running on (Vite prints it on startup) is
`http://localhost:<port>` or `http://127.0.0.1:<port>` — anything else
(a different hostname, or `https`) needs adding explicitly.

## Decision-engine scope

The current “AI” is an explainable rule-based decision engine, not a trained
ML model or external LLM. This makes recommendations reproducible and keeps
project data local. See [`docs/AI_ENGINE.md`](docs/AI_ENGINE.md) for inputs,
outputs and safe evolution guidance.

## Known, deliberate notes

- `npm audit` flags a high-severity advisory in `react-router` — it's specific
  to React Router's server-actions/RSC mode. This app only uses client-side
  `BrowserRouter`/`Routes`/`Route` (no RSC, no server actions), so it doesn't
  apply here. Re-check this when the app's routing usage changes.
