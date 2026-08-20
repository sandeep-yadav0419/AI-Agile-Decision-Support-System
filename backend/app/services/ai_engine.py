"""
AI Decision Support Engine for Agile Software Project Management.

Analyzes actual project and sprint data from the database using deterministic,
explainable rules and agile formulas to compute:
- Sprint & Project Health Scores (0-100)
- Delivery Risk & Delay Probability
- Workload, Scope, and Deadline Risks
- Real-time intelligent actionable recommendations
- Explainable delivery forecasts
"""
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.sprint import Sprint
from app.models.task import Task
from app.models.team import TeamMember
from app.models.user import User
from app.models.risk import Risk
from app.models.recommendation import DecisionRecommendation
from app.schemas.ai import (
    MetricScore,
    SprintHealthAnalysis,
    DeliveryForecast,
    ProjectHealthSummary,
    AIAnalysisOverview,
)
from app.schemas.risk import RiskResponse
from app.schemas.recommendation import RecommendationResponse


def calculate_sprint_metrics(sprint: Sprint, tasks: List[Task], team_members: List[TeamMember]) -> Dict:
    """
    Computes statistical and progress metrics for a given sprint.
    """
    total_tasks = len(tasks)
    completed_tasks = [t for t in tasks if t.status == "Done"]
    in_progress_tasks = [t for t in tasks if t.status == "In Progress"]
    review_tasks = [t for t in tasks if t.status == "Review"]
    blocked_tasks = [t for t in tasks if t.status == "Blocked"]
    todo_tasks = [t for t in tasks if t.status in ("To Do", "Backlog")]

    today = date.today()
    overdue_tasks = [
        t for t in tasks
        if t.due_date and t.due_date < today and t.status != "Done"
    ]

    total_points = sum(t.story_points for t in tasks)
    completed_points = sum(t.story_points for t in completed_tasks)
    remaining_points = total_points - completed_points
    in_progress_points = sum(t.story_points for t in in_progress_tasks + review_tasks)
    blocked_points = sum(t.story_points for t in blocked_tasks)

    # Time calculation
    start = sprint.start_date or (today - timedelta(days=7))
    end = sprint.end_date or (start + timedelta(days=14))
    total_days = max(1, (end - start).days)
    
    if today < start:
        elapsed_days = 0
    elif today > end:
        elapsed_days = total_days
    else:
        elapsed_days = max(0, (today - start).days)

    time_elapsed_ratio = min(1.0, elapsed_days / total_days)
    points_completed_ratio = (completed_points / total_points) if total_points > 0 else 0.0

    return {
        "total_tasks": total_tasks,
        "completed_tasks_count": len(completed_tasks),
        "in_progress_tasks_count": len(in_progress_tasks),
        "review_tasks_count": len(review_tasks),
        "blocked_tasks_count": len(blocked_tasks),
        "todo_tasks_count": len(todo_tasks),
        "overdue_tasks_count": len(overdue_tasks),
        "overdue_tasks": overdue_tasks,
        "blocked_tasks": blocked_tasks,
        "total_points": total_points,
        "completed_points": completed_points,
        "remaining_points": remaining_points,
        "in_progress_points": in_progress_points,
        "blocked_points": blocked_points,
        "total_days": total_days,
        "elapsed_days": elapsed_days,
        "remaining_days": max(0, (end - today).days),
        "time_elapsed_ratio": time_elapsed_ratio,
        "points_completed_ratio": points_completed_ratio,
        "start_date": start,
        "end_date": end,
    }


def evaluate_sprint_health(sprint: Sprint, db: Session) -> SprintHealthAnalysis:
    """
    Evaluates sprint health score and risks with detailed breakdown.
    """
    tasks = db.query(Task).filter(Task.sprint_id == sprint.id).all()
    project = db.query(Project).filter(Project.id == sprint.project_id).first()
    team_members = db.query(TeamMember).filter(TeamMember.project_id == sprint.project_id).all()

    m = calculate_sprint_metrics(sprint, tasks, team_members)
    metric_breakdown: List[MetricScore] = []

    # 1. Schedule Pace Metric (Weight: 35%)
    # Ratio comparison: points completed vs time elapsed
    if m["total_points"] == 0:
        schedule_score = 100
        schedule_status = "optimal"
        schedule_detail = "No tasks committed to sprint yet."
    else:
        lag = m["time_elapsed_ratio"] - m["points_completed_ratio"]
        if lag <= 0.05:  # On track or ahead
            schedule_score = 100
            schedule_status = "optimal"
            schedule_detail = f"{int(m['points_completed_ratio']*100)}% points finished vs {int(m['time_elapsed_ratio']*100)}% time elapsed."
        elif lag <= 0.25:  # Slight lag
            schedule_score = max(50, int(100 - (lag * 150)))
            schedule_status = "warning"
            schedule_detail = f"Slight pace lag: {int(m['points_completed_ratio']*100)}% done with {int(m['time_elapsed_ratio']*100)}% time elapsed."
        else:  # Severe lag
            schedule_score = max(15, int(100 - (lag * 200)))
            schedule_status = "critical"
            schedule_detail = f"Significant schedule slip: {m['remaining_points']} pts remain with {m['remaining_days']} days left."

    metric_breakdown.append(MetricScore(
        name="Schedule & Velocity Pace",
        score=schedule_score,
        weight=0.35,
        status=schedule_status,
        details=schedule_detail
    ))

    # 2. Blocked Task Impact (Weight: 25%)
    blocked_count = m["blocked_tasks_count"]
    if blocked_count == 0:
        blocker_score = 100
        blocker_status = "optimal"
        blocker_detail = "No blocked tasks detected in sprint."
    elif blocked_count == 1:
        blocker_score = 70
        blocker_status = "warning"
        blocker_detail = f"1 task ({m['blocked_points']} pts) is currently blocked."
    else:
        blocker_score = max(10, 100 - (blocked_count * 30))
        blocker_status = "critical"
        blocker_detail = f"{blocked_count} tasks ({m['blocked_points']} pts) are actively blocked."

    metric_breakdown.append(MetricScore(
        name="Blocker & Impediment Impact",
        score=blocker_score,
        weight=0.25,
        status=blocker_status,
        details=blocker_detail
    ))

    # 3. Deadline & Overdue Risk (Weight: 20%)
    overdue_count = m["overdue_tasks_count"]
    if overdue_count == 0:
        if m["remaining_days"] <= 2 and m["remaining_points"] > (sprint.velocity_target * 0.4):
            overdue_score = 60
            overdue_status = "warning"
            overdue_detail = f"{m['remaining_points']} points remaining with only {m['remaining_days']} days until sprint close."
        else:
            overdue_score = 100
            overdue_status = "optimal"
            overdue_detail = "All active tasks are within their scheduled deadlines."
    else:
        overdue_score = max(10, 100 - (overdue_count * 25))
        overdue_status = "critical"
        overdue_detail = f"{overdue_count} task(s) have passed their due dates."

    metric_breakdown.append(MetricScore(
        name="Due Date & Deadline Health",
        score=overdue_score,
        weight=0.20,
        status=overdue_status,
        details=overdue_detail
    ))

    # 4. Workload Balance & Capacity (Weight: 20%)
    assignee_points: Dict[int, int] = {}
    for t in tasks:
        if t.assignee_id:
            assignee_points[t.assignee_id] = assignee_points.get(t.assignee_id, 0) + (0 if t.status == "Done" else t.story_points)

    overloaded_assignees = [uid for uid, pts in assignee_points.items() if pts > 15]
    if not overloaded_assignees:
        workload_score = 100
        workload_status = "optimal"
        workload_detail = "Workload is evenly balanced across the sprint team."
    elif len(overloaded_assignees) == 1:
        workload_score = 65
        workload_status = "warning"
        workload_detail = f"1 team member has an elevated workload (> 15 remaining pts)."
    else:
        workload_score = max(20, 100 - (len(overloaded_assignees) * 35))
        workload_status = "critical"
        workload_detail = f"{len(overloaded_assignees)} team members are overloaded with work."

    metric_breakdown.append(MetricScore(
        name="Team Workload Distribution",
        score=workload_score,
        weight=0.20,
        status=workload_status,
        details=workload_detail
    ))

    # Calculate overall Health Score
    overall_health = int(
        (schedule_score * 0.35) +
        (blocker_score * 0.25) +
        (overdue_score * 0.20) +
        (workload_score * 0.20)
    )
    overall_health = max(0, min(100, overall_health))

    # Determine risk classifications
    if overall_health >= 80:
        delivery_risk = "LOW"
        delay_probability = max(5, int((100 - overall_health) * 0.8))
    elif overall_health >= 60:
        delivery_risk = "MEDIUM"
        delay_probability = int(25 + (80 - overall_health) * 1.2)
    elif overall_health >= 40:
        delivery_risk = "HIGH"
        delay_probability = int(50 + (60 - overall_health) * 1.3)
    else:
        delivery_risk = "CRITICAL"
        delay_probability = min(95, int(75 + (40 - overall_health) * 0.5))

    workload_risk = "LOW" if workload_score >= 80 else "MEDIUM" if workload_score >= 60 else "HIGH" if workload_score >= 40 else "CRITICAL"
    deadline_risk = "LOW" if overdue_score >= 80 else "MEDIUM" if overdue_score >= 60 else "HIGH" if overdue_score >= 40 else "CRITICAL"
    scope_risk = "LOW" if m["total_points"] <= sprint.velocity_target else "MEDIUM" if m["total_points"] <= sprint.velocity_target * 1.25 else "HIGH"

    # Construct concise explainable summary
    reasons = []
    if m["total_points"] > 0 and (m["time_elapsed_ratio"] - m["points_completed_ratio"]) > 0.15:
        reasons.append(f"{m['remaining_points']} story points remain while {int(m['time_elapsed_ratio']*100)}% of sprint timeline has elapsed")
    if m["blocked_tasks_count"] > 0:
        reasons.append(f"{m['blocked_tasks_count']} task(s) currently blocked")
    if m["overdue_tasks_count"] > 0:
        reasons.append(f"{m['overdue_tasks_count']} overdue task(s)")
    if overloaded_assignees:
        reasons.append(f"{len(overloaded_assignees)} team member(s) carrying excess load")

    if not reasons:
        summary_reason = "Sprint is progressing smoothly on schedule with healthy velocity and balanced workload."
        primary_rec = "Maintain current momentum and continue daily standup tracking."
    else:
        summary_reason = "; ".join(reasons) + "."
        if m["blocked_tasks_count"] > 0:
            first_blocked = m["blocked_tasks"][0]
            primary_rec = f"Prioritize unblocking task '{first_blocked.title}' and reallocate team capacity."
        elif (m["time_elapsed_ratio"] - m["points_completed_ratio"]) > 0.25 and m["remaining_points"] > 10:
            primary_rec = f"Consider deselecting 1-2 lower priority tasks to protect sprint commitment."
        elif overloaded_assignees:
            primary_rec = "Rebalance in-progress tasks among available team members to prevent bottlenecks."
        else:
            primary_rec = "Focus engineering capacity on completing active in-review and in-progress tasks."

    # Count active risks and recommendations
    active_risks_count = db.query(Risk).filter(
        Risk.sprint_id == sprint.id,
        Risk.status == "Active"
    ).count()

    pending_recs_count = db.query(DecisionRecommendation).filter(
        DecisionRecommendation.sprint_id == sprint.id,
        DecisionRecommendation.status == "pending"
    ).count()

    return SprintHealthAnalysis(
        sprint_id=sprint.id,
        sprint_name=sprint.name,
        project_id=project.id if project else sprint.project_id,
        project_name=project.name if project else "Project",
        health_score=overall_health,
        delivery_risk=delivery_risk,
        delay_probability=delay_probability,
        workload_risk=workload_risk,
        scope_risk=scope_risk,
        deadline_risk=deadline_risk,
        summary_reason=summary_reason,
        primary_recommendation=primary_rec,
        metric_breakdown=metric_breakdown,
        active_risks_count=active_risks_count,
        pending_recommendations_count=pending_recs_count,
    )


def generate_delivery_forecast(project: Project, db: Session) -> DeliveryForecast:
    """
    Computes explainable project delivery forecast based on story points and velocity.
    """
    tasks = db.query(Task).filter(Task.project_id == project.id).all()
    sprints = db.query(Sprint).filter(Sprint.project_id == project.id).all()

    total_points = sum(t.story_points for t in tasks)
    completed_points = sum(t.story_points for t in tasks if t.status == "Done")
    remaining_points = max(0, total_points - completed_points)

    # Calculate average velocity from completed sprints or default target
    completed_sprints = [s for s in sprints if s.status == "Completed"]
    if completed_sprints:
        avg_sprint_velocity = sum(s.completed_points for s in completed_sprints) / len(completed_sprints)
    else:
        active_sprint = next((s for s in sprints if s.status == "Active"), None)
        avg_sprint_velocity = float(active_sprint.velocity_target if active_sprint else 20.0)

    # Normalize velocity to weekly rate (assuming standard 2-week sprint)
    weekly_velocity = max(2.0, avg_sprint_velocity / 2.0)

    if remaining_points == 0:
        weeks_remaining = 0.0
        expected_completion = date.today()
        delivery_confidence = 100
        delay_prob = 0
        is_at_risk = False
        forecast_summary = "All project story points are fully completed."
    else:
        weeks_remaining = round(remaining_points / weekly_velocity, 1)
        expected_completion = date.today() + timedelta(days=int(weeks_remaining * 7))

        if project.deadline:
            days_to_deadline = (project.deadline - date.today()).days
            weeks_to_deadline = max(0.1, days_to_deadline / 7.0)
            required_weekly_velocity = round(remaining_points / weeks_to_deadline, 1)

            if expected_completion <= project.deadline:
                delivery_confidence = min(95, int(85 + (days_to_deadline - (weeks_remaining * 7)) * 0.5))
                delay_prob = max(5, 100 - delivery_confidence)
                is_at_risk = False
                forecast_summary = f"On track for completion {int((project.deadline - expected_completion).days)} days before deadline at current velocity ({weekly_velocity} pts/wk)."
            else:
                days_overdue = (expected_completion - project.deadline).days
                delivery_confidence = max(15, int(70 - (days_overdue * 1.5)))
                delay_prob = min(95, 100 - delivery_confidence)
                is_at_risk = True
                forecast_summary = f"Delivery predicted ~{days_overdue} days past target deadline. Required velocity is {required_weekly_velocity} pts/wk vs current {weekly_velocity} pts/wk."
        else:
            required_weekly_velocity = weekly_velocity
            delivery_confidence = 80
            delay_prob = 20
            is_at_risk = False
            forecast_summary = f"Estimated completion in {weeks_remaining} weeks at current velocity of {weekly_velocity} pts/wk."

    return DeliveryForecast(
        project_id=project.id,
        project_name=project.name,
        total_story_points=total_points,
        completed_points=completed_points,
        remaining_points=remaining_points,
        current_velocity_per_week=weekly_velocity,
        required_velocity_per_week=required_weekly_velocity if project.deadline else weekly_velocity,
        estimated_weeks_remaining=weeks_remaining,
        target_deadline=project.deadline,
        expected_completion_date=expected_completion,
        delivery_confidence=delivery_confidence,
        delay_probability=delay_prob,
        is_at_risk=is_at_risk,
        forecast_summary=forecast_summary,
    )


def sync_project_ai_insights(project_id: int, db: Session) -> Tuple[List[Risk], List[DecisionRecommendation]]:
    """
    Scans project data, detects risks, synthesizes actionable recommendations,
    and syncs them to the database while preserving existing user statuses.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return [], []

    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    sprints = db.query(Sprint).filter(Sprint.project_id == project_id).all()
    team_members = db.query(TeamMember).filter(TeamMember.project_id == project_id).all()
    today = date.today()

    new_risks: List[Risk] = []
    new_recommendations: List[DecisionRecommendation] = []

    # Helper to check if similar active risk already exists
    def risk_exists(rtype: str, task_id: Optional[int] = None, sprint_id: Optional[int] = None) -> bool:
        q = db.query(Risk).filter(
            Risk.project_id == project_id,
            Risk.risk_type == rtype,
            Risk.status == "Active"
        )
        if task_id:
            q = q.filter(Risk.task_id == task_id)
        if sprint_id:
            q = q.filter(Risk.sprint_id == sprint_id)
        return q.first() is not None

    # Helper to check if similar pending recommendation exists
    def rec_exists(title: str) -> bool:
        return db.query(DecisionRecommendation).filter(
            DecisionRecommendation.project_id == project_id,
            DecisionRecommendation.title == title,
            DecisionRecommendation.status == "pending"
        ).first() is not None

    # 1. Detect Blocked Tasks
    blocked_tasks = [t for t in tasks if t.status == "Blocked"]
    for bt in blocked_tasks:
        if not risk_exists("Blocked Task", task_id=bt.id):
            r = Risk(
                project_id=project_id,
                sprint_id=bt.sprint_id,
                task_id=bt.id,
                risk_type="Blocked Task",
                severity="HIGH" if bt.priority in ("High", "Critical") else "MEDIUM",
                description=f"Task '{bt.title}' ({bt.story_points} pts) is blocked and impeding sprint workflow.",
                mitigation="Schedule an immediate blocker-clearing pairing session or reassign dependent work.",
                status="Active"
            )
            db.add(r)
            new_risks.append(r)

        rec_title = f"Unblock critical path task '{bt.title}'"
        if not rec_exists(rec_title):
            rec = DecisionRecommendation(
                project_id=project_id,
                sprint_id=bt.sprint_id,
                title=rec_title,
                category="Technical",
                priority="High" if bt.priority in ("High", "Critical") else "Medium",
                reason=f"Task '{bt.title}' is currently blocked, holding up {bt.story_points} story points.",
                action_text="Convene a short pairing session with the assignee to identify and remove the blocker or reassign the task.",
                status="pending",
                impact_score=85
            )
            db.add(rec)
            new_recommendations.append(rec)

    # 2. Detect Overdue Tasks
    for ot in tasks:
        if ot.due_date and ot.due_date < today and ot.status != "Done":
            if not risk_exists("Overdue Task", task_id=ot.id):
                r = Risk(
                    project_id=project_id,
                    sprint_id=ot.sprint_id,
                    task_id=ot.id,
                    risk_type="Overdue Task",
                    severity="CRITICAL" if ot.priority == "Critical" else "HIGH",
                    description=f"Task '{ot.title}' was due on {ot.due_date.isoformat()} and is currently {ot.status}.",
                    mitigation="Review task scope, adjust due date, or assign additional developer capacity.",
                    status="Active"
                )
                db.add(r)
                new_risks.append(r)

    # 3. Detect Team Member Workload Imbalance
    member_points: Dict[int, int] = {}
    member_tasks: Dict[int, List[Task]] = {}
    for t in tasks:
        if t.assignee_id and t.status != "Done":
            member_points[t.assignee_id] = member_points.get(t.assignee_id, 0) + t.story_points
            member_tasks.setdefault(t.assignee_id, []).append(t)

    for uid, pts in member_points.items():
        if pts >= 18:
            user = db.query(User).filter(User.id == uid).first()
            user_name = user.full_name if user else f"User #{uid}"
            if not risk_exists(f"Workload Overload - {user_name}"):
                r = Risk(
                    project_id=project_id,
                    risk_type="Workload Overload",
                    severity="HIGH" if pts > 22 else "MEDIUM",
                    description=f"{user_name} is assigned {pts} remaining story points across {len(member_tasks[uid])} tasks, exceeding recommended capacity.",
                    mitigation="Redistribute non-critical tasks to other team members with available bandwidth.",
                    status="Active"
                )
                db.add(r)
                new_risks.append(r)

            rec_title = f"Redistribute workload from {user_name}"
            if not rec_exists(rec_title):
                rec = DecisionRecommendation(
                    project_id=project_id,
                    title=rec_title,
                    category="Resource",
                    priority="High",
                    reason=f"{user_name} has {pts} points in progress/todo, creating a delivery bottleneck.",
                    action_text=f"Reassign 1-2 lower priority tasks from {user_name} to team members with lower utilization.",
                    status="pending",
                    impact_score=80
                )
                db.add(rec)
                new_recommendations.append(rec)

    # 4. Detect Sprint Schedule Slip for Active Sprints
    active_sprint = next((s for s in sprints if s.status == "Active"), None)
    if active_sprint:
        sprint_tasks = [t for t in tasks if t.sprint_id == active_sprint.id]
        s_metrics = calculate_sprint_metrics(active_sprint, sprint_tasks, team_members)
        
        if s_metrics["total_points"] > 0:
            lag = s_metrics["time_elapsed_ratio"] - s_metrics["points_completed_ratio"]
            if lag > 0.20 and s_metrics["remaining_points"] > 8:
                if not risk_exists("Sprint Schedule Slip", sprint_id=active_sprint.id):
                    r = Risk(
                        project_id=project_id,
                        sprint_id=active_sprint.id,
                        risk_type="Sprint Schedule Slip",
                        severity="HIGH" if lag > 0.35 else "MEDIUM",
                        description=f"Active Sprint '{active_sprint.name}' is {int(s_metrics['time_elapsed_ratio']*100)}% through its timeline with only {int(s_metrics['points_completed_ratio']*100)}% points completed.",
                        mitigation="Descope low-priority backlog items or adjust sprint velocity expectation.",
                        status="Active"
                    )
                    db.add(r)
                    new_risks.append(r)

                rec_title = f"Descope lower-priority items in '{active_sprint.name}'"
                if not rec_exists(rec_title):
                    rec = DecisionRecommendation(
                        project_id=project_id,
                        sprint_id=active_sprint.id,
                        title=rec_title,
                        category="Scope",
                        priority="High",
                        reason=f"{s_metrics['remaining_points']} points remain with only {s_metrics['remaining_days']} days left in the sprint.",
                        action_text=f"Move lowest priority tasks back to the project backlog to ensure on-time delivery of primary sprint goals.",
                        status="pending",
                        impact_score=90
                    )
                    db.add(rec)
                    new_recommendations.append(rec)

        # Rule 5: Progress Stagnation Detection
        from app.models.snapshot import DailyProjectSnapshot
        recent_snaps = (
            db.query(DailyProjectSnapshot)
            .filter(DailyProjectSnapshot.project_id == project_id)
            .order_by(DailyProjectSnapshot.date.desc())
            .limit(3)
            .all()
        )
        if len(recent_snaps) >= 3:
            progs = [s.progress_percentage for s in recent_snaps]
            open_count = recent_snaps[0].open_tasks
            blocked_count = recent_snaps[0].blocked_tasks
            if len(set(progs)) == 1 and progs[0] < 100 and open_count > 0:
                if not risk_exists("Progress Stagnation"):
                    r = Risk(
                        project_id=project_id,
                        risk_type="Progress Stagnation",
                        severity="HIGH" if blocked_count > 0 else "MEDIUM",
                        description=f"Project progress has remained stagnant at {progs[0]}% for 3 working days with {open_count} open tasks and {blocked_count} blockers.",
                        mitigation="Review daily check-ins and unblock critical path items before pulling new work.",
                        status="Active",
                    )
                    db.add(r)
                    new_risks.append(r)

                rec_title = f"Address Progress Stagnation in '{project.name}'"
                if not rec_exists(rec_title):
                    rec = DecisionRecommendation(
                        project_id=project_id,
                        title=rec_title,
                        category="Schedule",
                        priority="High",
                        reason=f"Project progress has remained at {progs[0]}% for 3 working days with {open_count} open tasks.",
                        action_text="Convene a blocker resolution session to unblock pending tasks.",
                        status="pending",
                        impact_score=85,
                    )
                    db.add(rec)
                    new_recommendations.append(rec)

    db.commit()
    all_risks = db.query(Risk).filter(Risk.project_id == project_id).all()
    all_recs = db.query(DecisionRecommendation).filter(DecisionRecommendation.project_id == project_id).all()
    return all_risks, all_recs


def get_full_project_health(project_id: int, db: Session) -> ProjectHealthSummary:
    """
    Returns unified project health analysis including active sprint analysis,
    forecast, critical risks, and actionable recommendations.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise ValueError(f"Project #{project_id} not found")

    # Sync insights
    sync_project_ai_insights(project_id, db)

    # Active sprint analysis
    active_sprint = db.query(Sprint).filter(
        Sprint.project_id == project_id,
        Sprint.status == "Active"
    ).first()

    sprint_analysis = evaluate_sprint_health(active_sprint, db) if active_sprint else None
    forecast = generate_delivery_forecast(project, db)

    # Compute overall project health score
    if sprint_analysis:
        overall_score = int((sprint_analysis.health_score * 0.6) + (forecast.delivery_confidence * 0.4))
    else:
        overall_score = forecast.delivery_confidence

    if overall_score >= 80:
        risk_level = "LOW"
    elif overall_score >= 60:
        risk_level = "MEDIUM"
    elif overall_score >= 40:
        risk_level = "HIGH"
    else:
        risk_level = "CRITICAL"

    critical_risks_orm = db.query(Risk).filter(
        Risk.project_id == project_id,
        Risk.status == "Active"
    ).order_by(Risk.id.desc()).limit(5).all()

    top_recs_orm = db.query(DecisionRecommendation).filter(
        DecisionRecommendation.project_id == project_id,
        DecisionRecommendation.status == "pending"
    ).order_by(DecisionRecommendation.impact_score.desc()).limit(5).all()

    critical_risks = [
        RiskResponse(
            id=r.id,
            project_id=r.project_id,
            sprint_id=r.sprint_id,
            task_id=r.task_id,
            risk_type=r.risk_type,
            severity=r.severity,
            description=r.description,
            mitigation=r.mitigation,
            status=r.status,
            detected_at=r.detected_at,
            task_title=r.task.title if r.task else None,
            sprint_name=r.sprint.name if r.sprint else None,
        )
        for r in critical_risks_orm
    ]

    top_recommendations = [
        RecommendationResponse(
            id=rec.id,
            project_id=rec.project_id,
            sprint_id=rec.sprint_id,
            title=rec.title,
            category=rec.category,
            priority=rec.priority,
            reason=rec.reason,
            action_text=rec.action_text,
            status=rec.status,
            impact_score=rec.impact_score,
            created_at=rec.created_at,
            updated_at=rec.updated_at,
            sprint_name=rec.sprint.name if rec.sprint else None,
        )
        for rec in top_recs_orm
    ]

    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    today_dt = date.today()
    blocked_count = len([t for t in tasks if t.status == "Blocked"])
    overdue_count = len([t for t in tasks if t.due_date and t.due_date < today_dt and t.status != "Done"])

    factors = []
    if blocked_count > 0:
        factors.append(f"{blocked_count} task(s) currently blocked")
    if overdue_count > 0:
        factors.append(f"{overdue_count} overdue task(s)")
    if sprint_analysis and sprint_analysis.workload_risk in ["HIGH", "CRITICAL"]:
        factors.append("1 team member(s) carrying excess load")
    if sprint_analysis and sprint_analysis.delay_probability > 30:
        factors.append("Sprint burn velocity trailing expected timeline")

    reason_summary = "; ".join(factors) if factors else "All sprint deliverables, capacity margins, and task timelines are in nominal state."

    return ProjectHealthSummary(
        project_id=project.id,
        project_name=project.name,
        overall_health_score=overall_score,
        risk_level=risk_level,
        delivery_risk=risk_level,
        reason=reason_summary,
        active_sprint=sprint_analysis,
        forecast=forecast,
        critical_risks=critical_risks,
        top_recommendations=top_recommendations,
        analysis_timestamp=datetime.now(timezone.utc),
    )


def generate_system_ai_overview(db: Session, authorized_project_ids: Optional[List[int]] = None) -> AIAnalysisOverview:
    """
    Computes aggregated decision support analytics strictly for authorized projects.
    """
    if authorized_project_ids is not None:
        projects = db.query(Project).filter(Project.id.in_(authorized_project_ids)).all()
        target_ids = authorized_project_ids
    else:
        projects = db.query(Project).all()
        target_ids = [p.id for p in projects]

    summaries: List[ProjectHealthSummary] = []
    for p in projects:
        try:
            summaries.append(get_full_project_health(p.id, db))
        except Exception:
            continue

    if summaries:
        system_health = int(sum(s.overall_health_score for s in summaries) / len(summaries))
    else:
        system_health = 100

    active_sprints_count = db.query(Sprint).filter(Sprint.project_id.in_(target_ids), Sprint.status == "Active").count()
    high_risks_count = db.query(Risk).filter(
        Risk.project_id.in_(target_ids),
        Risk.status == "Active",
        Risk.severity.in_(["HIGH", "CRITICAL"])
    ).count()
    pending_recs_count = db.query(DecisionRecommendation).filter(
        DecisionRecommendation.project_id.in_(target_ids),
        DecisionRecommendation.status == "pending"
    ).count()

    latest_risks_orm = db.query(Risk).filter(
        Risk.project_id.in_(target_ids),
        Risk.status == "Active"
    ).order_by(Risk.id.desc()).limit(8).all()

    latest_recs_orm = db.query(DecisionRecommendation).filter(
        DecisionRecommendation.project_id.in_(target_ids)
    ).order_by(DecisionRecommendation.impact_score.desc()).limit(8).all()

    latest_risks = [
        RiskResponse(
            id=r.id,
            project_id=r.project_id,
            sprint_id=r.sprint_id,
            task_id=r.task_id,
            risk_type=r.risk_type,
            severity=r.severity,
            description=r.description,
            mitigation=r.mitigation,
            status=r.status,
            detected_at=r.detected_at,
            task_title=r.task.title if r.task else None,
            sprint_name=r.sprint.name if r.sprint else None,
        )
        for r in latest_risks_orm
    ]

    latest_recs = [
        RecommendationResponse(
            id=rec.id,
            project_id=rec.project_id,
            sprint_id=rec.sprint_id,
            title=rec.title,
            category=rec.category,
            priority=rec.priority,
            reason=rec.reason,
            action_text=rec.action_text,
            status=rec.status,
            impact_score=rec.impact_score,
            created_at=rec.created_at,
            updated_at=rec.updated_at,
            sprint_name=rec.sprint.name if rec.sprint else None,
        )
        for rec in latest_recs_orm
    ]

    return AIAnalysisOverview(
        overall_system_health=system_health,
        total_projects_monitored=len(projects),
        active_sprints_monitored=active_sprints_count,
        high_priority_risks_count=high_risks_count,
        pending_recommendations_count=pending_recs_count,
        project_summaries=summaries,
        latest_risks=latest_risks,
        latest_recommendations=latest_recs,
        generated_at=datetime.now(timezone.utc),
    )
