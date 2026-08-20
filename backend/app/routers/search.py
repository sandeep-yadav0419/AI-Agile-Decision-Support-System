"""
Unified global search endpoint with strict multi-tenant filtering.
"""
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user, get_user_authorized_project_ids
from app.database import get_db
from app.models.project import Project
from app.models.sprint import Sprint
from app.models.task import Task
from app.models.team import TeamMember
from app.models.user import User

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
def global_search(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Search projects, tasks, sprints, and team members strictly across projects
    the current user is authorized to access.
    """
    authorized_ids = get_user_authorized_project_ids(current_user, db)
    if not authorized_ids:
        return {"projects": [], "tasks": [], "sprints": [], "members": []}

    search_str = f"%{q.strip()}%"

    # 1. Projects
    projects = (
        db.query(Project)
        .filter(
            Project.id.in_(authorized_ids),
            (Project.name.ilike(search_str)) | (Project.key.ilike(search_str)) | (Project.description.ilike(search_str)),
        )
        .limit(5)
        .all()
    )
    p_results = [
        {"id": p.id, "name": p.name, "key": p.key, "status": p.status, "link": f"/projects/{p.id}"}
        for p in projects
    ]

    # 2. Tasks
    tasks = (
        db.query(Task)
        .filter(
            Task.project_id.in_(authorized_ids),
            (Task.title.ilike(search_str)) | (Task.description.ilike(search_str)),
        )
        .limit(8)
        .all()
    )
    t_results = [
        {"id": t.id, "title": t.title, "project_key": t.project.key if t.project else "", "status": t.status, "link": "/kanban"}
        for t in tasks
    ]

    # 3. Sprints
    sprints = (
        db.query(Sprint)
        .filter(
            Sprint.project_id.in_(authorized_ids),
            (Sprint.name.ilike(search_str)) | (Sprint.goal.ilike(search_str)),
        )
        .limit(5)
        .all()
    )
    s_results = [
        {"id": s.id, "name": s.name, "status": s.status, "link": f"/sprints/{s.id}"}
        for s in sprints
    ]

    # 4. Members in authorized projects
    members = (
        db.query(User)
        .join(TeamMember, TeamMember.user_id == User.id)
        .filter(
            TeamMember.project_id.in_(authorized_ids),
            (User.full_name.ilike(search_str)) | (User.email.ilike(search_str)),
        )
        .distinct()
        .limit(5)
        .all()
    )
    m_results = [
        {"id": m.id, "name": m.full_name, "email": m.email, "role": m.role, "link": "/team"}
        for m in members
    ]

    return {
        "projects": p_results,
        "tasks": t_results,
        "sprints": s_results,
        "members": m_results,
    }
