"""
Task management endpoints and Kanban status updates with strict multi-tenant authorization.
"""
from datetime import date
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
from app.models.user import User
from app.models.risk import Risk
from app.schemas.task import TaskCreate, TaskResponse, TaskStatusUpdate, TaskUpdate
from app.services.ai_engine import sync_project_ai_insights

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def enrich_task_response(task: Task, db: Session) -> TaskResponse:
    today = date.today()
    is_overdue = bool(task.due_date and task.due_date < today and task.status != "Done")
    has_risk = db.query(Risk).filter(Risk.task_id == task.id, Risk.status == "Active").count() > 0

    t_resp = TaskResponse.model_validate(task)
    t_resp.is_overdue = is_overdue
    t_resp.has_risk = has_risk or task.status == "Blocked" or is_overdue
    return t_resp


@router.get("", response_model=List[TaskResponse])
def list_tasks(
    project_id: Optional[int] = Query(None),
    sprint_id: Optional[int] = Query(None),
    assignee_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    priority_filter: Optional[str] = Query(None, alias="priority"),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List tasks strictly filtered to authorized projects of current user.
    """
    authorized_project_ids = get_user_authorized_project_ids(current_user, db)
    if not authorized_project_ids:
        return []

    if project_id:
        check_project_access(project_id, current_user, db)
        query = db.query(Task).filter(Task.project_id == project_id)
    else:
        query = db.query(Task).filter(Task.project_id.in_(authorized_project_ids))

    if sprint_id:
        query = query.filter(Task.sprint_id == sprint_id)
    if assignee_id:
        query = query.filter(Task.assignee_id == assignee_id)
    if status_filter and status_filter != "All":
        query = query.filter(Task.status == status_filter)
    if priority_filter and priority_filter != "All":
        query = query.filter(Task.priority == priority_filter)
    if search:
        s = f"%{search.strip()}%"
        query = query.filter((Task.title.ilike(s)) | (Task.description.ilike(s)))

    tasks = query.order_by(Task.position.asc(), Task.id.desc()).all()
    return [enrich_task_response(t, db) for t in tasks]


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new task inside an authorized project.
    """
    project = check_project_access(payload.project_id, current_user, db, disallow_viewer=True)

    if payload.sprint_id:
        sprint = db.query(Sprint).filter(Sprint.id == payload.sprint_id, Sprint.project_id == project.id).first()
        if not sprint:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found in this project")

    if payload.assignee_id:
        assignee = db.query(User).filter(User.id == payload.assignee_id).first()
        if not assignee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignee user not found")

    task = Task(
        project_id=payload.project_id,
        sprint_id=payload.sprint_id,
        assignee_id=payload.assignee_id,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        priority=payload.priority or "Medium",
        status=payload.status or "To Do",
        story_points=payload.story_points if payload.story_points is not None else 3,
        due_date=payload.due_date,
        position=payload.position or 0,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    log_activity(
        db,
        project_id=project.id,
        actor_user_id=current_user.id,
        event_type="TASK_CREATED",
        description=f"{current_user.full_name} created task '{task.title}' ({task.story_points} pts).",
    )

    if payload.assignee_id and payload.assignee_id != current_user.id:
        create_notification(
            db,
            user_id=payload.assignee_id,
            title="Task Assigned",
            message=f"You were assigned task '{task.title}' in project '{project.name}'.",
            type="INFO",
            project_id=project.id,
            link="/kanban",
        )

    sync_project_ai_insights(task.project_id, db)
    return enrich_task_response(task, db)


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    check_project_access(task.project_id, current_user, db)
    return enrich_task_response(task, db)


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    check_project_access(task.project_id, current_user, db, disallow_viewer=True)
    old_assignee = task.assignee_id

    if payload.title is not None:
        task.title = payload.title.strip()
    if payload.description is not None:
        task.description = payload.description.strip() if payload.description else None
    if payload.project_id is not None and payload.project_id != task.project_id:
        check_project_access(payload.project_id, current_user, db)
        task.project_id = payload.project_id
    if payload.sprint_id is not None:
        task.sprint_id = payload.sprint_id
    if payload.assignee_id is not None:
        task.assignee_id = payload.assignee_id
    if payload.priority is not None:
        task.priority = payload.priority
    if payload.status is not None:
        task.status = payload.status
    if payload.story_points is not None:
        task.story_points = payload.story_points
    if payload.due_date is not None:
        task.due_date = payload.due_date
    if payload.position is not None:
        task.position = payload.position

    db.commit()
    db.refresh(task)

    if task.assignee_id and task.assignee_id != old_assignee and task.assignee_id != current_user.id:
        create_notification(
            db,
            user_id=task.assignee_id,
            title="Task Reassigned",
            message=f"You were assigned task '{task.title}' in '{project.name}'.",
            type="INFO",
            project_id=project.id,
            link="/kanban",
        )

    log_activity(
        db,
        project_id=project.id,
        actor_user_id=current_user.id,
        event_type="TASK_UPDATED",
        description=f"{current_user.full_name} updated task '{task.title}'.",
    )

    sync_project_ai_insights(task.project_id, db)
    return enrich_task_response(task, db)


@router.patch("/{task_id}/status", response_model=TaskResponse)
def update_task_status(
    task_id: int,
    payload: TaskStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update task status column in Kanban board with activity tracking.
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    project = check_project_access(task.project_id, current_user, db, disallow_viewer=True)

    valid_statuses = ["Backlog", "To Do", "In Progress", "Review", "Done", "Blocked"]
    if payload.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{payload.status}'. Must be one of {valid_statuses}",
        )

    old_status = task.status
    task.status = payload.status
    if payload.position is not None:
        task.position = payload.position

    db.commit()
    db.refresh(task)

    if old_status != payload.status:
        log_activity(
            db,
            project_id=project.id,
            actor_user_id=current_user.id,
            event_type="TASK_STATUS_CHANGED",
            description=f"{current_user.full_name} moved '{task.title}' to {payload.status}.",
        )

        if payload.status == "Blocked":
            create_notification(
                db,
                user_id=project.owner_id,
                title="Task Blocked Alert",
                message=f"Task '{task.title}' was marked as Blocked by {current_user.full_name}.",
                type="ALERT",
                project_id=project.id,
                link="/kanban",
            )

    sync_project_ai_insights(task.project_id, db)
    return enrich_task_response(task, db)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    project = check_project_access(task.project_id, current_user, db, disallow_viewer=True)
    title = task.title
    project_id = task.project_id

    db.delete(task)
    db.commit()

    log_activity(
        db,
        project_id=project_id,
        actor_user_id=current_user.id,
        event_type="TASK_DELETED",
        description=f"{current_user.full_name} deleted task '{title}'.",
    )

    sync_project_ai_insights(project_id, db)
    return None
