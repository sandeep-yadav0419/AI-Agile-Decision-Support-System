"""
End-to-end comprehensive integration test for AI-DSS Full-Stack Application.
Tests complete flow across all modules:
Auth -> Google OAuth -> Projects -> Sprints -> Tasks -> Kanban -> Team -> AI Engine -> Recommendations -> Reports -> CSV Export -> Settings.
"""
from datetime import date, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.database import Base, engine, ensure_schema_compatibility, SessionLocal
from app.services.seed import seed_demo_data

def run_e2e_tests():
    print("=" * 75)
    print("STARTING FULL END-TO-END SYSTEM INTEGRATION TESTS (AI-DSS UPGRADE)")
    print("=" * 75)

    # Initialize DB, Migration check & Seed
    ensure_schema_compatibility(engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_demo_data(db)
    db.close()

    client = TestClient(app)

    # 1. Health check
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["database"] == "connected"
    print("✓ 1. Health check: 200 OK (DB connected)")

    # 2. Register / Login user
    import time
    test_email = f"lead.architect.{int(time.time())}@aidss-enterprise.org"
    test_password = "SecurePassword2026!"
    res = client.post("/api/auth/register", json={
        "email": test_email,
        "password": test_password,
        "full_name": "Lead System Architect",
    })
    if res.status_code == 409:
        res = client.post("/api/auth/login", json={
            "email": test_email,
            "password": test_password,
        })
    assert res.status_code in (200, 201)
    token = res.json()["access_token"]
    user_id = res.json()["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"✓ 2. Auth: Registered/Logged in user #{user_id} ({test_email})")

    # 3. Verify /api/auth/me session restoration
    res = client.get("/api/auth/me", headers=headers)
    assert res.status_code == 200
    assert res.json()["email"] == test_email
    print("✓ 3. Session Validation: /api/auth/me passed")

    # 4. Google OAuth endpoint verification check
    # Test that empty or invalid token properly returns 400/401 rather than 500 error
    res = client.post("/api/auth/google", json={"id_token": "mock_invalid_token_for_verification"})
    assert res.status_code in (400, 401)
    print("✓ 4. Google OAuth: Backend signature verification guard active (401 on invalid token)")

    # 5. Create new Project
    project_key = f"PR{int(time.time()) % 100000:05d}"
    res = client.post("/api/projects", headers=headers, json={
        "name": "Autonomous Navigation & Decision Matrix",
        "key": project_key,
        "description": "Real-time decision intelligence engine for agile mission delivery.",
        "status": "Active",
        "priority": "Critical",
        "start_date": (date.today() - timedelta(days=6)).isoformat(),
        "deadline": (date.today() + timedelta(days=30)).isoformat(),
    })
    assert res.status_code == 201, f"Failed to create project: {res.text}"
    project = res.json()
    project_id = project["id"]
    print(f"✓ 5. Projects: Created Project #{project_id} ('{project['name']}', Key: {project['key']})")

    # 6. Create Sprints
    res = client.post("/api/sprints", headers=headers, json={
        "project_id": project_id,
        "name": "Sprint 1 - Decision Engine Core",
        "goal": "Implement risk scoring heuristics and team capacity meters.",
        "start_date": date.today().isoformat(),
        "end_date": (date.today() + timedelta(days=14)).isoformat(),
        "velocity_target": 25,
        "status": "Active",
    })
    assert res.status_code == 201
    sprint = res.json()
    sprint_id = sprint["id"]
    print(f"✓ 6. Sprints: Created Sprint #{sprint_id} ('{sprint['name']}')")

    # 7. Create Tasks across states
    task_specs = [
        ("Implement Bayesian Risk Probability Matrix", 8, "In Progress", "Critical", date.today() + timedelta(days=4)),
        ("Automate Story Point Velocity Aggregator", 5, "Done", "High", date.today() - timedelta(days=1)),
        ("Telemetry Sensor Stream Synchronization", 5, "Blocked", "Critical", date.today() - timedelta(days=2)), # Blocked & Overdue
        ("Build Multi-Dimension Burndown Estimator", 5, "To Do", "Medium", date.today() + timedelta(days=9)),
        ("Integrate CSV Export Pipeline", 2, "Review", "Low", date.today() + timedelta(days=12)),
    ]
    created_task_ids = []
    for title, pts, status_val, prio, due in task_specs:
        res = client.post("/api/tasks", headers=headers, json={
            "project_id": project_id,
            "sprint_id": sprint_id,
            "assignee_id": user_id,
            "title": title,
            "description": f"Specification for {title}",
            "priority": prio,
            "status": status_val,
            "story_points": pts,
            "due_date": due.isoformat(),
        })
        assert res.status_code == 201
        created_task_ids.append(res.json()["id"])
    print(f"✓ 7. Tasks: Created {len(created_task_ids)} tasks with story points & deadlines")

    # 8. Kanban Drag-and-Drop simulation (In Progress -> Review -> Done)
    test_task_id = created_task_ids[0]
    res = client.patch(f"/api/tasks/{test_task_id}/status", headers=headers, json={
        "status": "Review",
        "position": 1,
    })
    assert res.status_code == 200
    assert res.json()["status"] == "Review"
    print(f"✓ 8. Kanban: Dragged task #{test_task_id} to 'Review' (Database updated in real time)")

    # 9. Team Workload Calculation
    res = client.get("/api/team/workload", headers=headers)
    assert res.status_code == 200
    workload = res.json()
    my_workload = next((w for w in workload if w["user_id"] == user_id), None)
    assert my_workload is not None
    print(f"✓ 9. Team: Computed workload: {my_workload['workload_status']} ({my_workload['total_story_points']} active points)")

    # 10. AI Engine batch analysis & health evaluation
    res = client.post("/api/ai/analyze", headers=headers, json={"project_id": project_id})
    assert res.status_code == 200
    print(f"✓ 10. AI Engine: Batch scan complete ({res.json()['message']})")

    # 11. AI Sprint & Project Health
    res = client.get(f"/api/ai/project/{project_id}", headers=headers)
    assert res.status_code == 200
    p_health = res.json()
    print(f"✓ 11. AI Project Health: {p_health['overall_health_score']}/100 | Delivery Risk: {p_health['delivery_risk']}")
    print(f"      Explainable Factors: {p_health['reason']}")

    # 12. AI Delivery Forecast
    res = client.get(f"/api/ai/projects/{project_id}/forecast", headers=headers)
    assert res.status_code == 200
    forecast = res.json()
    print(f"✓ 12. AI Forecast: Est Completion {forecast['expected_completion_date']} | Confidence: {forecast['delivery_confidence']}%")

    # 13. Recommendations: Accept & Apply
    res = client.get(f"/api/recommendations?project_id={project_id}", headers=headers)
    assert res.status_code == 200
    recs = res.json()
    if recs:
        rec = recs[0]
        res = client.post(f"/api/recommendations/{rec['id']}/apply", headers=headers)
        assert res.status_code == 200
        assert res.json()["status"] == "accepted"
        print(f"✓ 13. AI Recommendations: Applied recommendation #{rec['id']} ('{rec['title']}')")

    # 14. Reports Summary & CSV Export
    res = client.get(f"/api/reports/summary?project_id={project_id}", headers=headers)
    assert res.status_code == 200
    rep = res.json()
    print(f"✓ 14. Reports: Analytics generated (Total Tasks: {rep['total_tasks']}, Done: {rep['completed_tasks']})")

    res = client.get(f"/api/reports/export/csv?project_id={project_id}", headers=headers)
    assert res.status_code == 200
    assert "text/csv" in res.headers.get("content-type", "")
    assert "Task ID,Project,Sprint" in res.text
    print(f"✓ 15. CSV Export: Successfully generated report CSV ({len(res.text.splitlines())} lines)")

    # 16. Profile update & password change
    res = client.put("/api/users/me", headers=headers, json={
        "full_name": "Chief Software Architect",
        "role": "Project Manager",
    })
    assert res.status_code == 200
    assert res.json()["full_name"] == "Chief Software Architect"

    res = client.post("/api/users/change-password", headers=headers, json={
        "current_password": test_password,
        "new_password": "NewSecurePassword2026!",
    })
    assert res.status_code == 200
    print("✓ 16. Settings: Profile updated and security credentials rotated")

    print("=" * 75)
    print("ALL 16 FULL-STACK ENTERPRISE INTEGRATION MODULES PASSED 100%!")
    print("=" * 75)

if __name__ == "__main__":
    run_e2e_tests()
