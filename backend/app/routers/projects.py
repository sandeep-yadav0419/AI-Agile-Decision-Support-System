"""
Project management endpoints with strict multi-tenant authorization and daily progress tracking.
"""
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import (
    check_project_access,
    create_notification,
    get_current_user,
    get_user_authorized_project_ids,
    log_activity,
)
from app.database import get_db
from app.models.project import Project
from app.models.snapshot import DailyProjectSnapshot
from app.models.sprint import Sprint
from app.models.task import Task
from app.models.team import TeamMember
from app.models.user import User
from app.models.risk import Risk
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectStats, ProjectUpdate
from app.schemas.snapshot import DailyProjectSnapshotResponse
from app.services.ai_engine import evaluate_sprint_health, sync_project_ai_insights

router = APIRouter(prefix="/api/projects", tags=["projects"])


def capture_daily_snapshot(project: Project, db: Session) -> DailyProjectSnapshot:
    """
    Captures or updates today's snapshot for historical progress tracking.
    """
    today = date.today()
    tasks = db.query(Task).filter(Task.project_id == project.id).all()
    members_count = db.query(TeamMember).filter(TeamMember.project_id == project.id).count()
    risks_count = db.query(Risk).filter(Risk.project_id == project.id, Risk.status == "Active").count()

    total_tasks = len(tasks)
    completed_tasks = len([t for t in tasks if t.status == "Done"])
    open_tasks = total_tasks - completed_tasks
    blocked_tasks = len([t for t in tasks if t.status == "Blocked"])
    overdue_tasks = len([t for t in tasks if t.due_date and t.due_date < today and t.status != "Done"])

    total_points = sum(t.story_points for t in tasks)
    completed_points = sum(t.story_points for t in tasks if t.status == "Done")
    remaining_points = total_points - completed_points
    progress_pct = round((completed_points / total_points * 100), 1) if total_points > 0 else (
        round(completed_tasks / total_tasks * 100, 1) if total_tasks > 0 else 0.0
    )

    snapshot = (
        db.query(DailyProjectSnapshot)
        .filter(DailyProjectSnapshot.project_id == project.id, DailyProjectSnapshot.date == today)
        .first()
    )

    if not snapshot:
        snapshot = DailyProjectSnapshot(
            project_id=project.id,
            date=today,
            progress_percentage=progress_pct,
            completed_tasks=completed_tasks,
            open_tasks=open_tasks,
            blocked_tasks=blocked_tasks,
            overdue_tasks=overdue_tasks,
            completed_story_points=completed_points,
            remaining_story_points=remaining_points,
            total_story_points=total_points,
            active_members=members_count,
            velocity=float(completed_points),
            health_score=85,
            risk_score=min(100, (blocked_tasks * 15 + overdue_tasks * 10)),
        )
        db.add(snapshot)
    else:
        snapshot.progress_percentage = progress_pct
        snapshot.completed_tasks = completed_tasks
        snapshot.open_tasks = open_tasks
        snapshot.blocked_tasks = blocked_tasks
        snapshot.overdue_tasks = overdue_tasks
        snapshot.completed_story_points = completed_points
        snapshot.remaining_story_points = remaining_points
        snapshot.total_story_points = total_points
        snapshot.active_members = members_count
        snapshot.risk_score = min(100, (blocked_tasks * 15 + overdue_tasks * 10))

    try:
        db.commit()
    except Exception:
        db.rollback()
    return snapshot


def compute_project_stats(project: Project, db: Session) -> ProjectStats:
    tasks = db.query(Task).filter(Task.project_id == project.id).all()
    sprints = db.query(Sprint).filter(Sprint.project_id == project.id).all()
    members_count = db.query(TeamMember).filter(TeamMember.project_id == project.id).count()
    risks_count = db.query(Risk).filter(Risk.project_id == project.id, Risk.status == "Active").count()

    total_tasks = len(tasks)
    completed_tasks = len([t for t in tasks if t.status == "Done"])
    in_progress_tasks = len([t for t in tasks if t.status == "In Progress"])
    blocked_tasks = len([t for t in tasks if t.status == "Blocked"])

    today = date.today()
    overdue_tasks = len([t for t in tasks if t.due_date and t.due_date < today and t.status != "Done"])

    total_points = sum(t.story_points for t in tasks)
    completed_points = sum(t.story_points for t in tasks if t.status == "Done")
    progress_pct = round((completed_points / total_points * 100), 1) if total_points > 0 else (
        round(completed_tasks / total_tasks * 100, 1) if total_tasks > 0 else 0.0
    )

    active_sprints = [s for s in sprints if s.status == "Active"]
    health_score = 100
    if active_sprints:
        try:
            h_eval = evaluate_sprint_health(active_sprints[0], db)
            health_score = h_eval.health_score
        except Exception:
            health_score = 85

    # Daily snapshots progress comparison
    yesterday = today - timedelta(days=1)
    seven_days_ago = today - timedelta(days=7)

    yesterday_snap = (
        db.query(DailyProjectSnapshot)
        .filter(DailyProjectSnapshot.project_id == project.id, DailyProjectSnapshot.date == yesterday)
        .first()
    )
    seven_day_snap = (
        db.query(DailyProjectSnapshot)
        .filter(DailyProjectSnapshot.project_id == project.id, DailyProjectSnapshot.date <= seven_days_ago)
        .order_by(DailyProjectSnapshot.date.desc())
        .first()
    )

    yesterday_progress = yesterday_snap.progress_percentage if yesterday_snap else max(0.0, progress_pct - 2.0)
    today_change = round(progress_pct - yesterday_progress, 1)
    seven_day_change = round(progress_pct - (seven_day_snap.progress_percentage if seven_day_snap else max(0.0, progress_pct - 10.0)), 1)

    return ProjectStats(
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        in_progress_tasks=in_progress_tasks,
        blocked_tasks=blocked_tasks,
        overdue_tasks=overdue_tasks,
        total_story_points=total_points,
        completed_story_points=completed_points,
        progress_percentage=progress_pct,
        active_sprints_count=len(active_sprints),
        total_sprints_count=len(sprints),
        team_members_count=members_count,
        risks_count=risks_count,
        health_score=health_score,
        today_progress_change=today_change,
        yesterday_progress=yesterday_progress,
        seven_day_progress_change=seven_day_change,
    )


@router.get("", response_model=List[ProjectResponse])
def list_projects(
    status_filter: Optional[str] = Query(None, alias="status"),
    priority_filter: Optional[str] = Query(None, alias="priority"),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List only projects owned by current user OR where current user is an authorized member.
    """
    authorized_ids = get_user_authorized_project_ids(current_user, db)
    if not authorized_ids:
        return []

    query = db.query(Project).filter(Project.id.in_(authorized_ids))

    if status_filter and status_filter != "All":
        query = query.filter(Project.status == status_filter)
    if priority_filter and priority_filter != "All":
        query = query.filter(Project.priority == priority_filter)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter((Project.name.ilike(s)) | (Project.key.ilike(s)) | (Project.description.ilike(s)))

    projects = query.order_by(Project.id.desc()).all()
    results = []
    for p in projects:
        stats = compute_project_stats(p, db)
        p.progress = stats.progress_percentage
        
        # User role determination
        user_role = "OWNER" if p.owner_id == current_user.id else "DEVELOPER"
        m = db.query(TeamMember).filter(TeamMember.project_id == p.id, TeamMember.user_id == current_user.id).first()
        if m:
            user_role = m.role

        p_dict = ProjectResponse.model_validate(p)
        p_dict.stats = stats
        p_dict.current_user_role = user_role
        results.append(p_dict)
    return results


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Creates a new project strictly owned by current_user.
    Adds creator as OWNER in TeamMember, adds optional team members, and logs activity.
    """
    existing_key = db.query(Project).filter(Project.key == payload.key.upper().strip()).first()
    if existing_key:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Project key '{payload.key}' is already in use",
        )

    project = Project(
        name=payload.name.strip(),
        key=payload.key.upper().strip(),
        description=payload.description.strip() if payload.description else None,
        goal=payload.goal.strip() if payload.goal else None,
        status=payload.status or "Active",
        priority=payload.priority or "Medium",
        start_date=payload.start_date,
        deadline=payload.deadline,
        sprint_duration_weeks=payload.sprint_duration_weeks or 2,
        working_days=payload.working_days or "Mon-Fri",
        owner_id=current_user.id,
        progress=0.0,
    )
    db.add(project)
    db.flush()

    # Automatically add creator as OWNER
    db.add(TeamMember(project_id=project.id, user_id=current_user.id, role="OWNER"))

    # Add optional team members if provided
    if payload.team_member_ids:
        for uid in payload.team_member_ids:
            if uid != current_user.id:
                db.add(TeamMember(project_id=project.id, user_id=uid, role="DEVELOPER"))
                create_notification(
                    db,
                    user_id=uid,
                    title="Added to Project",
                    message=f"You were added to project '{project.name}' ({project.key}) by {current_user.full_name}.",
                    type="INFO",
                    project_id=project.id,
                    link=f"/projects/{project.id}",
                )

    log_activity(
        db,
        project_id=project.id,
        actor_user_id=current_user.id,
        event_type="PROJECT_CREATED",
        description=f"{current_user.full_name} created project '{project.name}' ({project.key}).",
    )

    db.commit()
    db.refresh(project)

    capture_daily_snapshot(project, db)
    stats = compute_project_stats(project, db)

    p_resp = ProjectResponse.model_validate(project)
    p_resp.stats = stats
    p_resp.current_user_role = "OWNER"
    return p_resp


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get project details with strict authorization check.
    """
    project = check_project_access(project_id, current_user, db)
    capture_daily_snapshot(project, db)

    stats = compute_project_stats(project, db)
    project.progress = stats.progress_percentage
    db.commit()

    user_role = "OWNER" if project.owner_id == current_user.id else "DEVELOPER"
    m = db.query(TeamMember).filter(TeamMember.project_id == project.id, TeamMember.user_id == current_user.id).first()
    if m:
        user_role = m.role

    p_resp = ProjectResponse.model_validate(project)
    p_resp.stats = stats
    p_resp.current_user_role = user_role
    return p_resp


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update project settings. Requires OWNER or PROJECT_MANAGER permissions.
    """
    project = check_project_access(project_id, current_user, db, require_owner_or_pm=True)

    if payload.name is not None:
        project.name = payload.name.strip()
    if payload.key is not None:
        key_val = payload.key.upper().strip()
        existing = db.query(Project).filter(Project.key == key_val, Project.id != project_id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Project key is already in use")
        project.key = key_val
    if payload.description is not None:
        project.description = payload.description.strip() if payload.description else None
    if payload.goal is not None:
        project.goal = payload.goal.strip() if payload.goal else None
    if payload.status is not None:
        project.status = payload.status
    if payload.priority is not None:
        project.priority = payload.priority
    if payload.start_date is not None:
        project.start_date = payload.start_date
    if payload.deadline is not None:
        project.deadline = payload.deadline
    if payload.sprint_duration_weeks is not None:
        project.sprint_duration_weeks = payload.sprint_duration_weeks
    if payload.working_days is not None:
        project.working_days = payload.working_days

    log_activity(
        db,
        project_id=project.id,
        actor_user_id=current_user.id,
        event_type="PROJECT_UPDATED",
        description=f"{current_user.full_name} updated project details for '{project.name}'.",
    )

    db.commit()
    db.refresh(project)

    sync_project_ai_insights(project.id, db)
    capture_daily_snapshot(project, db)
    stats = compute_project_stats(project, db)

    p_resp = ProjectResponse.model_validate(project)
    p_resp.stats = stats
    p_resp.current_user_role = "OWNER" if project.owner_id == current_user.id else "PROJECT_MANAGER"
    return p_resp


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Deletes project. Strict: Only the Project OWNER can delete the project.
    """
    project = check_project_access(project_id, current_user, db)
    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project creator / owner can delete this project.",
        )

    db.delete(project)
    db.commit()
    return None


@router.get("/{project_id}/snapshots", response_model=List[DailyProjectSnapshotResponse])
def get_project_snapshots(
    project_id: int,
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns historical daily progress snapshots for the project (up to specified days).
    """
    check_project_access(project_id, current_user, db)
    cutoff = date.today() - timedelta(days=days)
    snapshots = (
        db.query(DailyProjectSnapshot)
        .filter(DailyProjectSnapshot.project_id == project_id, DailyProjectSnapshot.date >= cutoff)
        .order_by(DailyProjectSnapshot.date.asc())
        .all()
    )
    return snapshots
