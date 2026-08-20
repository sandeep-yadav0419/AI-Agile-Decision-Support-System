"""
Team management and workload analysis endpoints with strict multi-tenant authorization.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import (
    check_project_access,
    create_notification,
    get_current_user,
    get_user_authorized_project_ids,
    hash_password,
    log_activity,
)
from app.database import get_db
from app.models.project import Project
from app.models.task import Task
from app.models.team import TeamMember
from app.models.user import User
from app.schemas.team import MemberWorkloadResponse, TeamMemberCreate, TeamMemberResponse

router = APIRouter(prefix="/api/team", tags=["team"])


@router.get("", response_model=List[TeamMemberResponse])
def list_team_members(
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    authorized_project_ids = get_user_authorized_project_ids(current_user, db)
    if not authorized_project_ids:
        return []

    if project_id:
        check_project_access(project_id, current_user, db)
        query = db.query(TeamMember).filter(TeamMember.project_id == project_id)
    else:
        query = db.query(TeamMember).filter(TeamMember.project_id.in_(authorized_project_ids))

    members = query.order_by(TeamMember.id.desc()).all()
    return members


@router.post("", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
def add_team_member(
    payload: TeamMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="project_id is required")

    project = check_project_access(payload.project_id, current_user, db, require_owner_or_pm=True)

    user_id = payload.user_id

    # If email provided and user_id not provided, find or create user
    if not user_id and payload.email:
        existing_user = db.query(User).filter(User.email == payload.email.lower().strip()).first()
        if existing_user:
            user_id = existing_user.id
        else:
            new_user = User(
                email=payload.email.lower().strip(),
                full_name=payload.full_name or payload.email.split("@")[0].capitalize(),
                role=payload.role or "DEVELOPER",
                hashed_password=hash_password("TemporaryPassword123!"),
                is_active=True,
            )
            db.add(new_user)
            db.flush()
            user_id = new_user.id

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either user_id or email must be provided",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    existing_member = db.query(TeamMember).filter(
        TeamMember.project_id == payload.project_id,
        TeamMember.user_id == user_id,
    ).first()
    if existing_member:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this project",
        )

    member = TeamMember(
        project_id=payload.project_id,
        user_id=user_id,
        role=payload.role or user.role or "DEVELOPER",
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    log_activity(
        db,
        project_id=project.id,
        actor_user_id=current_user.id,
        event_type="MEMBER_JOINED",
        description=f"{user.full_name} joined project '{project.name}' as {member.role}.",
    )

    if user.id != current_user.id:
        create_notification(
            db,
            user_id=user.id,
            title="Invited to Project",
            message=f"You were added to '{project.name}' by {current_user.full_name}.",
            type="INFO",
            project_id=project.id,
            link=f"/projects/{project.id}",
        )

    return member


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_team_member(
    member_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = db.query(TeamMember).filter(TeamMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found")

    project = check_project_access(member.project_id, current_user, db, require_owner_or_pm=True)

    if member.user_id == project.owner_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove project owner from project")

    db.delete(member)
    db.commit()

    log_activity(
        db,
        project_id=project.id,
        actor_user_id=current_user.id,
        event_type="MEMBER_REMOVED",
        description=f"{current_user.full_name} removed a team member from '{project.name}'.",
    )
    return None


@router.get("/workload", response_model=List[MemberWorkloadResponse])
def get_team_workload(
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Computes workload strictly for users and tasks inside authorized projects.
    """
    authorized_project_ids = get_user_authorized_project_ids(current_user, db)
    if not authorized_project_ids:
        return []

    if project_id:
        check_project_access(project_id, current_user, db)
        members = db.query(TeamMember).filter(TeamMember.project_id == project_id).all()
        user_ids = list({m.user_id for m in members})
        target_project_ids = [project_id]
    else:
        members = db.query(TeamMember).filter(TeamMember.project_id.in_(authorized_project_ids)).all()
        user_ids = list({m.user_id for m in members})
        target_project_ids = authorized_project_ids

    users = db.query(User).filter(User.id.in_(user_ids), User.is_active == True).all()
    results: List[MemberWorkloadResponse] = []

    for u in users:
        tasks_query = db.query(Task).filter(
            Task.assignee_id == u.id,
            Task.project_id.in_(target_project_ids),
        )

        user_tasks = tasks_query.all()
        assigned_count = len(user_tasks)
        in_progress_tasks = [t for t in user_tasks if t.status in ("In Progress", "Review")]
        completed_tasks = [t for t in user_tasks if t.status == "Done"]
        blocked_tasks = [t for t in user_tasks if t.status == "Blocked"]

        total_pts = sum(t.story_points for t in user_tasks)
        in_progress_pts = sum(t.story_points for t in in_progress_tasks)
        remaining_pts = sum(t.story_points for t in user_tasks if t.status != "Done")

        if remaining_pts >= 25 or len(in_progress_tasks) >= 6:
            workload_status = "Overloaded"
            utilization = min(150, int((remaining_pts / 20.0) * 100))
        elif remaining_pts >= 16:
            workload_status = "High Workload"
            utilization = min(99, int((remaining_pts / 20.0) * 100))
        elif remaining_pts >= 5:
            workload_status = "Normal Workload"
            utilization = int((remaining_pts / 20.0) * 100)
        else:
            workload_status = "Low Workload"
            utilization = int((remaining_pts / 20.0) * 100)

        user_projects = (
            db.query(Project.name)
            .join(TeamMember, TeamMember.project_id == Project.id)
            .filter(TeamMember.user_id == u.id, Project.id.in_(authorized_project_ids))
            .distinct()
            .all()
        )
        project_names = [p[0] for p in user_projects]

        results.append(MemberWorkloadResponse(
            user_id=u.id,
            full_name=u.full_name,
            email=u.email,
            role=u.role,
            assigned_tasks_count=assigned_count,
            in_progress_tasks_count=len(in_progress_tasks),
            completed_tasks_count=len(completed_tasks),
            blocked_tasks_count=len(blocked_tasks),
            total_story_points=total_pts,
            in_progress_points=in_progress_pts,
            workload_status=workload_status,
            utilization_percentage=utilization,
            active_projects=project_names,
        ))

    return results
