"""
Sprint management endpoints with strict multi-tenant authorization.
"""
from datetime import date, timedelta
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
from app.models.sprint import Sprint
from app.models.task import Task
from app.models.team import TeamMember
from app.models.user import User
from app.schemas.sprint import (
    BurndownPoint,
    SprintCreate,
    SprintHealthSummary,
    SprintResponse,
    SprintStats,
    SprintUpdate,
)
from app.services.ai_engine import calculate_sprint_metrics, evaluate_sprint_health, sync_project_ai_insights

router = APIRouter(prefix="/api/sprints", tags=["sprints"])


def compute_sprint_stats(sprint: Sprint, db: Session) -> SprintStats:
    tasks = db.query(Task).filter(Task.sprint_id == sprint.id).all()
    team_members = db.query(TeamMember).filter(TeamMember.project_id == sprint.project_id).all()
    m = calculate_sprint_metrics(sprint, tasks, team_members)

    health_summary = None
    if sprint.status == "Active":
        try:
            h_eval = evaluate_sprint_health(sprint, db)
            health_summary = SprintHealthSummary(
                health_score=h_eval.health_score,
                delivery_risk=h_eval.delivery_risk,
                delay_probability=h_eval.delay_probability,
                reason=h_eval.summary_reason,
                recommendation=h_eval.primary_recommendation,
            )
        except Exception:
            pass

    return SprintStats(
        total_tasks=m["total_tasks"],
        completed_tasks=m["completed_tasks_count"],
        in_progress_tasks=m["in_progress_tasks_count"],
        blocked_tasks=m["blocked_tasks_count"],
        overdue_tasks=m["overdue_tasks_count"],
        total_points=m["total_points"],
        completed_points=m["completed_points"],
        remaining_points=m["remaining_points"],
        completion_percentage=round(m["points_completed_ratio"] * 100, 1),
        elapsed_days=m["elapsed_days"],
        total_days=m["total_days"],
        time_progress_percentage=round(m["time_elapsed_ratio"] * 100, 1),
        health=health_summary,
    )


@router.get("", response_model=List[SprintResponse])
def list_sprints(
    project_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List sprints strictly filtered to authorized projects of current user.
    """
    authorized_project_ids = get_user_authorized_project_ids(current_user, db)
    if not authorized_project_ids:
        return []

    if project_id:
        check_project_access(project_id, current_user, db)
        query = db.query(Sprint).filter(Sprint.project_id == project_id)
    else:
        query = db.query(Sprint).filter(Sprint.project_id.in_(authorized_project_ids))

    if status_filter and status_filter != "All":
        query = query.filter(Sprint.status == status_filter)

    sprints = query.order_by(Sprint.id.desc()).all()
    results = []
    for s in sprints:
        stats = compute_sprint_stats(s, db)
        s_resp = SprintResponse.model_validate(s)
        s_resp.stats = stats
        results.append(s_resp)
    return results


@router.post("", response_model=SprintResponse, status_code=status.HTTP_201_CREATED)
def create_sprint(
    payload: SprintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = check_project_access(payload.project_id, current_user, db, require_owner_or_pm=True)

    today = date.today()
    start_date = payload.start_date or today
    end_date = payload.end_date or (start_date + timedelta(days=14))

    sprint = Sprint(
        project_id=payload.project_id,
        name=payload.name.strip(),
        goal=payload.goal.strip() if payload.goal else None,
        start_date=start_date,
        end_date=end_date,
        status=payload.status or "Planned",
        velocity_target=payload.velocity_target or 20,
        completed_points=0,
    )
    db.add(sprint)
    db.commit()
    db.refresh(sprint)

    log_activity(
        db,
        project_id=project.id,
        actor_user_id=current_user.id,
        event_type="SPRINT_CREATED",
        description=f"{current_user.full_name} created sprint '{sprint.name}' (Target: {sprint.velocity_target} pts).",
    )

    stats = compute_sprint_stats(sprint, db)
    s_resp = SprintResponse.model_validate(sprint)
    s_resp.stats = stats
    return s_resp


@router.get("/{sprint_id}", response_model=SprintResponse)
def get_sprint(
    sprint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")

    check_project_access(sprint.project_id, current_user, db)

    stats = compute_sprint_stats(sprint, db)
    s_resp = SprintResponse.model_validate(sprint)
    s_resp.stats = stats
    return s_resp


@router.put("/{sprint_id}", response_model=SprintResponse)
def update_sprint(
    sprint_id: int,
    payload: SprintUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")

    check_project_access(sprint.project_id, current_user, db, require_owner_or_pm=True)

    if payload.name is not None:
        sprint.name = payload.name.strip()
    if payload.goal is not None:
        sprint.goal = payload.goal.strip() if payload.goal else None
    if payload.start_date is not None:
        sprint.start_date = payload.start_date
    if payload.end_date is not None:
        sprint.end_date = payload.end_date
    if payload.status is not None:
        sprint.status = payload.status
    if payload.velocity_target is not None:
        sprint.velocity_target = payload.velocity_target
    if payload.completed_points is not None:
        sprint.completed_points = payload.completed_points

    db.commit()
    db.refresh(sprint)

    log_activity(
        db,
        project_id=sprint.project_id,
        actor_user_id=current_user.id,
        event_type="SPRINT_UPDATED",
        description=f"{current_user.full_name} updated sprint '{sprint.name}'.",
    )

    sync_project_ai_insights(sprint.project_id, db)
    stats = compute_sprint_stats(sprint, db)
    s_resp = SprintResponse.model_validate(sprint)
    s_resp.stats = stats
    return s_resp


@router.post("/{sprint_id}/start", response_model=SprintResponse)
def start_sprint(
    sprint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")

    project = check_project_access(sprint.project_id, current_user, db, require_owner_or_pm=True)

    sprint.status = "Active"
    if not sprint.start_date:
        sprint.start_date = date.today()
    if not sprint.end_date:
        sprint.end_date = sprint.start_date + timedelta(days=14)

    db.commit()
    db.refresh(sprint)

    log_activity(
        db,
        project_id=project.id,
        actor_user_id=current_user.id,
        event_type="SPRINT_STARTED",
        description=f"{current_user.full_name} started active sprint '{sprint.name}'.",
    )

    sync_project_ai_insights(sprint.project_id, db)
    stats = compute_sprint_stats(sprint, db)
    s_resp = SprintResponse.model_validate(sprint)
    s_resp.stats = stats
    return s_resp


@router.post("/{sprint_id}/complete", response_model=SprintResponse)
def complete_sprint(
    sprint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")

    project = check_project_access(sprint.project_id, current_user, db, require_owner_or_pm=True)

    tasks = db.query(Task).filter(Task.sprint_id == sprint.id).all()
    completed_points = sum(t.story_points for t in tasks if t.status == "Done")

    sprint.status = "Completed"
    sprint.completed_points = completed_points
    db.commit()
    db.refresh(sprint)

    log_activity(
        db,
        project_id=project.id,
        actor_user_id=current_user.id,
        event_type="SPRINT_COMPLETED",
        description=f"{current_user.full_name} completed sprint '{sprint.name}' ({completed_points} pts achieved).",
    )

    sync_project_ai_insights(sprint.project_id, db)
    stats = compute_sprint_stats(sprint, db)
    s_resp = SprintResponse.model_validate(sprint)
    s_resp.stats = stats
    return s_resp


@router.delete("/{sprint_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sprint(
    sprint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")

    project = check_project_access(sprint.project_id, current_user, db, require_owner_or_pm=True)

    # Move associated tasks to Backlog
    db.query(Task).filter(Task.sprint_id == sprint_id).update({"sprint_id": None, "status": "Backlog"})
    db.delete(sprint)
    db.commit()

    log_activity(
        db,
        project_id=project.id,
        actor_user_id=current_user.id,
        event_type="SPRINT_DELETED",
        description=f"{current_user.full_name} deleted sprint '{sprint.name}'.",
    )
    return None


@router.get("/{sprint_id}/burndown", response_model=List[BurndownPoint])
def get_sprint_burndown(
    sprint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")

    check_project_access(sprint.project_id, current_user, db)

    tasks = db.query(Task).filter(Task.sprint_id == sprint.id).all()
    total_points = sum(t.story_points for t in tasks) or sprint.velocity_target or 20
    completed_points = sum(t.story_points for t in tasks if t.status == "Done")

    start = sprint.start_date or (date.today() - timedelta(days=7))
    end = sprint.end_date or (start + timedelta(days=14))
    total_days = max(1, (end - start).days)

    today = date.today()
    points_per_day = total_points / total_days if total_days > 0 else 0

    points_list: List[BurndownPoint] = []
    
    for day_idx in range(total_days + 1):
        curr_date = start + timedelta(days=day_idx)
        ideal = max(0.0, round(total_points - (points_per_day * day_idx), 1))

        if curr_date > today:
            actual = -1.0
        elif curr_date == today:
            actual = float(max(0, total_points - completed_points))
        else:
            pct_done_estimate = (day_idx / max(1, (today - start).days)) if today > start else 0.0
            actual_burnt = completed_points * pct_done_estimate
            actual = float(max(0, round(total_points - actual_burnt, 1)))

        points_list.append(BurndownPoint(
            day=f"Day {day_idx}",
            date=curr_date.strftime("%b %d"),
            ideal_points=ideal,
            actual_points=actual if actual >= 0 else None,
        ))

    return points_list
