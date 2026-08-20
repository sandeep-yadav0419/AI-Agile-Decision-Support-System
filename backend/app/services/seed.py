"""
Database seeding service for demo agile project management data.
"""
from datetime import date, datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.project import Project
from app.models.sprint import Sprint
from app.models.task import Task
from app.models.team import TeamMember
from app.models.user import User
from app.models.risk import Risk
from app.models.recommendation import DecisionRecommendation
from app.services.ai_engine import sync_project_ai_insights


def seed_demo_data(db: Session, current_user: User = None) -> None:
    """
    Seeds initial realistic agile demo data if no projects exist in the database.
    """
    if db.query(Project).first():
        return  # Data already exists

    today = date.today()

    # 1. Create team demo users if they don't exist
    demo_users_data = [
        {"email": "alex.pm@example.com", "full_name": "Alex Rivera", "role": "Project Manager"},
        {"email": "sarah.dev@example.com", "full_name": "Sarah Chen", "role": "Developer"},
        {"email": "marcus.lead@example.com", "full_name": "Marcus Vance", "role": "Developer"},
        {"email": "priya.qa@example.com", "full_name": "Priya Patel", "role": "QA Engineer"},
        {"email": "elena.ux@example.com", "full_name": "Elena Rostova", "role": "Designer"},
        {"email": "david.scrum@example.com", "full_name": "David Kim", "role": "Scrum Master"},
    ]

    created_users = {}
    if current_user:
        created_users[current_user.email] = current_user

    for udata in demo_users_data:
        existing = db.query(User).filter(User.email == udata["email"]).first()
        if not existing:
            u = User(
                email=udata["email"],
                full_name=udata["full_name"],
                role=udata["role"],
                hashed_password=hash_password("DemoPassword123!"),
                is_active=True,
            )
            db.add(u)
            db.flush()
            created_users[udata["email"]] = u
        else:
            created_users[udata["email"]] = existing

    lead_user = current_user or created_users["alex.pm@example.com"]
    sarah = created_users.get("sarah.dev@example.com", lead_user)
    marcus = created_users.get("marcus.lead@example.com", lead_user)
    priya = created_users.get("priya.qa@example.com", lead_user)
    elena = created_users.get("elena.ux@example.com", lead_user)

    # 2. Project 1: Cloud-Native Autonomous DSS
    p1 = Project(
        name="AI-Driven Decision Support System (AI-DSS)",
        key="AIDSS",
        description="Autonomous agile project intelligence platform with proactive risk detection and delivery forecasting.",
        status="Active",
        priority="Critical",
        start_date=today - timedelta(days=21),
        deadline=today + timedelta(days=35),
        owner_id=lead_user.id,
        progress=45.0,
    )
    db.add(p1)
    db.flush()

    # Team memberships for Project 1
    for u in [lead_user, sarah, marcus, priya, elena]:
        db.add(TeamMember(project_id=p1.id, user_id=u.id, role=u.role))

    # Sprint 1 (Completed)
    s1 = Sprint(
        project_id=p1.id,
        name="Sprint 1 - Foundation & Core Architecture",
        goal="Establish database models, authentication layer, and core REST API foundation.",
        start_date=today - timedelta(days=21),
        end_date=today - timedelta(days=7),
        status="Completed",
        velocity_target=24,
        completed_points=24,
    )
    db.add(s1)
    db.flush()

    # Sprint 2 (Active - currently in progress)
    s2 = Sprint(
        project_id=p1.id,
        name="Sprint 2 - AI Decision Engine & Kanban Flow",
        goal="Implement rule-based AI risk evaluation, sprint burndown forecasting, and real-time drag-and-drop Kanban.",
        start_date=today - timedelta(days=6),
        end_date=today + timedelta(days=8),
        status="Active",
        velocity_target=28,
        completed_points=13,
    )
    db.add(s2)
    db.flush()

    # Sprint 3 (Planned)
    s3 = Sprint(
        project_id=p1.id,
        name="Sprint 3 - Automated Mitigation & Enterprise Reports",
        goal="Provide exportable analytics reports, real-time alert webhooks, and executive KPI summaries.",
        start_date=today + timedelta(days=9),
        end_date=today + timedelta(days=23),
        status="Planned",
        velocity_target=25,
        completed_points=0,
    )
    db.add(s3)
    db.flush()

    # Tasks for Sprint 1 (All Done)
    s1_tasks = [
        ("Design PostgreSQL/SQLite Schema & Indexing", 5, "Done", marcus.id),
        ("Implement JWT Auth & Token Expiry Middleware", 5, "Done", sarah.id),
        ("Build Reusable Design Tokens & Dashboard Shell", 8, "Done", elena.id),
        ("Unit & Integration Test Suite for Auth API", 6, "Done", priya.id),
    ]
    for title, pts, status, aid in s1_tasks:
        db.add(Task(
            project_id=p1.id,
            sprint_id=s1.id,
            assignee_id=aid,
            title=title,
            description=f"Core deliverable for foundation sprint: {title}.",
            priority="High",
            status=status,
            story_points=pts,
            due_date=today - timedelta(days=8),
        ))

    # Tasks for Sprint 2 (Active)
    s2_tasks = [
        ("Construct AI Sprint Health Scoring Engine", 8, "Done", marcus.id, "Critical", today - timedelta(days=2)),
        ("Develop Interactive Kanban Drag-and-Drop Board", 5, "Done", elena.id, "High", today - timedelta(days=1)),
        ("Build Delivery Forecast & Delay Risk Predictor", 5, "In Progress", sarah.id, "High", today + timedelta(days=4)),
        ("Implement Automated Risk Detection Rules", 5, "In Progress", marcus.id, "Critical", today + timedelta(days=3)),
        ("Third-Party Jira/GitHub Webhook Integration", 3, "Blocked", sarah.id, "Medium", today - timedelta(days=1)),  # Blocked & Overdue
        ("Team Workload & Capacity Calculation API", 3, "Review", sarah.id, "Medium", today + timedelta(days=2)),
        ("End-to-End Test Suite for Kanban Drag-Drop", 4, "To Do", priya.id, "High", today + timedelta(days=6)),
    ]
    for title, pts, status, aid, prio, due in s2_tasks:
        db.add(Task(
            project_id=p1.id,
            sprint_id=s2.id,
            assignee_id=aid,
            title=title,
            description=f"Detailed implementation requirements for '{title}'.",
            priority=prio,
            status=status,
            story_points=pts,
            due_date=due,
        ))

    # Backlog Tasks (Unassigned or Planned for next sprints)
    backlog_tasks = [
        ("PDF / CSV Analytics Report Export Engine", 5, "Backlog", None, "Medium", today + timedelta(days=20)),
        ("Custom Webhook Notification Dispatcher", 3, "Backlog", None, "Low", today + timedelta(days=25)),
        ("Multi-Project Cross-Team Resource Heatmap", 8, "Backlog", marcus.id, "High", today + timedelta(days=28)),
    ]
    for title, pts, status, aid, prio, due in backlog_tasks:
        db.add(Task(
            project_id=p1.id,
            sprint_id=s3.id if title.startswith("PDF") else None,
            assignee_id=aid,
            title=title,
            description=f"Backlog item: {title}.",
            priority=prio,
            status=status,
            story_points=pts,
            due_date=due,
        ))

    # 3. Project 2: Customer Mobile Companion
    p2 = Project(
        name="Agile Mobile Companion App",
        key="AMOB",
        description="iOS & Android field companion for sprint task updates and instant AI blocker notifications.",
        status="Planning",
        priority="Medium",
        start_date=today + timedelta(days=7),
        deadline=today + timedelta(days=60),
        owner_id=lead_user.id,
        progress=10.0,
    )
    db.add(p2)
    db.flush()

    for u in [lead_user, sarah, elena]:
        db.add(TeamMember(project_id=p2.id, user_id=u.id, role=u.role))

    p2_tasks = [
        ("Mobile UX Wireframes & Prototype", 5, "In Progress", elena.id, "High", today + timedelta(days=10)),
        ("Push Notification Service Architecture", 5, "To Do", sarah.id, "Medium", today + timedelta(days=14)),
        ("Offline SQLite Sync Mechanism", 8, "Backlog", None, "High", today + timedelta(days=25)),
    ]
    for title, pts, status, aid, prio, due in p2_tasks:
        db.add(Task(
            project_id=p2.id,
            assignee_id=aid,
            title=title,
            description=f"Specification for {title}.",
            priority=prio,
            status=status,
            story_points=pts,
            due_date=due,
        ))

    db.commit()

    # Trigger AI insights scan for both projects
    sync_project_ai_insights(p1.id, db)
    sync_project_ai_insights(p2.id, db)
