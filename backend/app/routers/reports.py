"""
Reports and analytics endpoints with strict multi-tenant authorization.
"""
import csv
import io
from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.security import (
    check_project_access,
    get_current_user,
    get_user_authorized_project_ids,
)
from app.database import get_db
from app.models.project import Project
from app.models.recommendation import DecisionRecommendation
from app.models.risk import Risk
from app.models.sprint import Sprint
from app.models.task import Task
from app.models.team import TeamMember
from app.models.user import User
from app.schemas.reports import (
    CategoryRecommendationCount,
    MemberWorkloadDistribution,
    PriorityDistribution,
    ReportsSummary,
    RiskSeverityDistribution,
    StatusDistribution,
    VelocityDataPoint,
)
from app.schemas.sprint import BurndownPoint
from app.services.ai_engine import evaluate_sprint_health

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/summary", response_model=ReportsSummary)
@router.get("/project/{project_id}", response_model=ReportsSummary)
def get_reports_summary(
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    authorized_project_ids = get_user_authorized_project_ids(current_user, db)
    if not authorized_project_ids:
        return ReportsSummary(
            project_id=None,
            project_name="No Projects",
            total_projects=0,
            total_sprints=0,
            total_tasks=0,
            completed_tasks=0,
            total_points=0,
            completed_points=0,
            completion_rate=0.0,
            average_velocity=0.0,
            overall_health_score=100,
            status_distribution=[],
            priority_distribution=[],
            velocity_history=[],
            burndown=[],
            workload_distribution=[],
            risk_distribution=[],
            recommendation_distribution=[],
        )

    selected_project = None
    if project_id:
        selected_project = check_project_access(project_id, current_user, db)
        target_ids = [project_id]
    else:
        target_ids = authorized_project_ids

    projects = db.query(Project).filter(Project.id.in_(target_ids)).all()
    tasks = db.query(Task).filter(Task.project_id.in_(target_ids)).all()
    sprints = db.query(Sprint).filter(Sprint.project_id.in_(target_ids)).all()
    risks = db.query(Risk).filter(Risk.project_id.in_(target_ids)).all()
    recs = db.query(DecisionRecommendation).filter(DecisionRecommendation.project_id.in_(target_ids)).all()

    total_tasks = len(tasks)
    completed_tasks = len([t for t in tasks if t.status == "Done"])
    total_points = sum(t.story_points for t in tasks)
    completed_points = sum(t.story_points for t in tasks if t.status == "Done")
    completion_rate = round((completed_points / total_points * 100), 1) if total_points > 0 else (
        round(completed_tasks / total_tasks * 100, 1) if total_tasks > 0 else 0.0
    )

    # 1. Status distribution
    statuses = ["Backlog", "To Do", "In Progress", "Review", "Done", "Blocked"]
    status_dist = []
    for s in statuses:
        matching = [t for t in tasks if t.status == s]
        pts = sum(t.story_points for t in matching)
        pct = round((len(matching) / total_tasks * 100), 1) if total_tasks > 0 else 0.0
        status_dist.append(StatusDistribution(status=s, count=len(matching), points=pts, percentage=pct))

    # 2. Priority distribution
    priorities = ["Low", "Medium", "High", "Critical"]
    priority_dist = []
    for p in priorities:
        matching = [t for t in tasks if t.priority == p]
        pct = round((len(matching) / total_tasks * 100), 1) if total_tasks > 0 else 0.0
        priority_dist.append(PriorityDistribution(priority=p, count=len(matching), percentage=pct))

    # 3. Velocity history across sprints
    velocity_history = []
    for sp in sprints:
        sp_tasks = [t for t in tasks if t.sprint_id == sp.id]
        committed_pts = sum(t.story_points for t in sp_tasks) or sp.velocity_target
        velocity_history.append(VelocityDataPoint(
            sprint_id=sp.id,
            sprint_name=sp.name,
            target_velocity=sp.velocity_target,
            completed_points=sp.completed_points or sum(t.story_points for t in sp_tasks if t.status == "Done"),
            committed_points=committed_pts,
        ))

    completed_sprints = [s for s in sprints if s.status == "Completed"]
    if completed_sprints:
        avg_velocity = round(sum(s.completed_points for s in completed_sprints) / len(completed_sprints), 1)
    else:
        avg_velocity = 20.0

    # 4. Burndown data for active sprint
    burndown_points = []
    active_sprint = next((s for s in sprints if s.status == "Active"), None)
    if active_sprint:
        sp_tasks = [t for t in tasks if t.sprint_id == active_sprint.id]
        sp_total_pts = sum(t.story_points for t in sp_tasks) or active_sprint.velocity_target
        sp_done_pts = sum(t.story_points for t in sp_tasks if t.status == "Done")

        start = active_sprint.start_date or (date.today() - timedelta(days=7))
        end = active_sprint.end_date or (start + timedelta(days=14))
        total_days = max(1, (end - start).days)
        today = date.today()
        pts_per_day = sp_total_pts / total_days if total_days > 0 else 0

        for day_idx in range(total_days + 1):
            curr_date = start + timedelta(days=day_idx)
            ideal = max(0.0, round(sp_total_pts - (pts_per_day * day_idx), 1))
            if curr_date > today:
                actual = None
            elif curr_date == today:
                actual = float(max(0, sp_total_pts - sp_done_pts))
            else:
                pct = (day_idx / max(1, (today - start).days)) if today > start else 0.0
                actual = float(max(0, round(sp_total_pts - (sp_done_pts * pct), 1)))

            burndown_points.append(BurndownPoint(
                day=f"Day {day_idx}",
                date=curr_date.strftime("%b %d"),
                ideal_points=ideal,
                actual_points=actual,
            ))

    # 5. Workload distribution
    team_members = db.query(TeamMember).filter(TeamMember.project_id.in_(target_ids)).all()
    user_ids = list({m.user_id for m in team_members})
    users = db.query(User).filter(User.id.in_(user_ids), User.is_active == True).all()

    workload_dist = []
    for u in users:
        u_tasks = [t for t in tasks if t.assignee_id == u.id and t.status != "Done"]
        u_pts = sum(t.story_points for t in u_tasks)
        status_label = "Overloaded" if u_pts >= 22 else "High" if u_pts >= 15 else "Normal" if u_pts >= 5 else "Low"
        workload_dist.append(MemberWorkloadDistribution(
            user_id=u.id,
            name=u.full_name,
            role=u.role,
            points=u_pts,
            task_count=len(u_tasks),
            status=status_label,
        ))

    # 6. Risk distribution
    severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    risk_dist = []
    for sev in severities:
        matching = [r for r in risks if r.severity == sev]
        active = [r for r in matching if r.status == "Active"]
        risk_dist.append(RiskSeverityDistribution(
            severity=sev,
            count=len(matching),
            active_count=len(active),
        ))

    # 7. Recommendations distribution
    categories = ["Schedule", "Resource", "Scope", "Technical", "Quality", "Team"]
    rec_dist = []
    for cat in categories:
        matching = [r for r in recs if r.category == cat]
        accepted = [r for r in matching if r.status == "accepted"]
        pending = [r for r in matching if r.status == "pending"]
        rec_dist.append(CategoryRecommendationCount(
            category=cat,
            total=len(matching),
            accepted=len(accepted),
            pending=len(pending),
        ))

    # Overall Health
    overall_health = 100
    if active_sprint:
        try:
            h_eval = evaluate_sprint_health(active_sprint, db)
            overall_health = h_eval.health_score
        except Exception:
            overall_health = 85

    return ReportsSummary(
        project_id=selected_project.id if selected_project else None,
        project_name=selected_project.name if selected_project else "All Monitored Projects",
        total_projects=len(projects),
        total_sprints=len(sprints),
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        total_points=total_points,
        completed_points=completed_points,
        completion_rate=completion_rate,
        average_velocity=avg_velocity,
        overall_health_score=overall_health,
        status_distribution=status_dist,
        priority_distribution=priority_dist,
        velocity_history=velocity_history,
        burndown=burndown_points,
        workload_distribution=workload_dist,
        risk_distribution=risk_dist,
        recommendation_distribution=rec_dist,
    )


@router.get("/sprint/{sprint_id}")
def get_sprint_report(
    sprint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")

    check_project_access(sprint.project_id, current_user, db)

    tasks = db.query(Task).filter(Task.sprint_id == sprint_id).all()
    health = evaluate_sprint_health(sprint, db)
    return {
        "sprint_id": sprint.id,
        "sprint_name": sprint.name,
        "goal": sprint.goal,
        "status": sprint.status,
        "start_date": sprint.start_date,
        "end_date": sprint.end_date,
        "velocity_target": sprint.velocity_target,
        "total_tasks": len(tasks),
        "completed_tasks": len([t for t in tasks if t.status == "Done"]),
        "story_points_completed": sum(t.story_points for t in tasks if t.status == "Done"),
        "story_points_total": sum(t.story_points for t in tasks),
        "health_score": health.health_score,
        "delivery_risk": health.delivery_risk,
        "summary_reason": health.summary_reason,
        "recommendation": health.primary_recommendation,
    }


@router.get("/export/csv")
def export_reports_csv(
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Exports project and task telemetry report as a downloadable CSV strictly for authorized projects.
    """
    authorized_project_ids = get_user_authorized_project_ids(current_user, db)
    if not authorized_project_ids:
        return Response(content="", media_type="text/csv")

    if project_id:
        project = check_project_access(project_id, current_user, db)
        tasks_query = db.query(Task).filter(Task.project_id == project_id)
        filename = f"ai_dss_report_{project.key}.csv"
    else:
        tasks_query = db.query(Task).filter(Task.project_id.in_(authorized_project_ids))
        filename = "ai_dss_executive_report.csv"

    tasks = tasks_query.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Task ID", "Project", "Sprint", "Title", "Status", "Priority",
        "Story Points", "Assignee", "Due Date", "Is Overdue"
    ])

    today = date.today()
    for t in tasks:
        is_overdue = bool(t.due_date and t.due_date < today and t.status != "Done")
        writer.writerow([
            t.id,
            t.project.name if t.project else "N/A",
            t.sprint.name if t.sprint else "Backlog",
            t.title,
            t.status,
            t.priority,
            t.story_points,
            t.assignee.full_name if t.assignee else "Unassigned",
            t.due_date.isoformat() if t.due_date else "",
            "YES" if is_overdue else "NO",
        ])

    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
