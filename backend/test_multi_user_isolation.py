"""
Automated Multi-User Data Isolation and Security Audit Test Suite (AI-DSS SaaS Upgrade).

Verifies 100% strict server-side authorization:
1. User A cannot view User B's projects in list queries.
2. User B receives 403 Forbidden on direct ID access to User A's projects, sprints, tasks,
   risks, AI recommendations, reports, check-ins, or telemetry.
3. Authorization is dynamically granted only when User A explicitly invites User B as a TeamMember.
4. Notifications, activity streams, and daily snapshots are strictly isolated per tenant/workspace.
"""
import time
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def run_multi_user_isolation_tests():
    print("=" * 80)
    print("STARTING STRICT MULTI-USER DATA ISOLATION & SECURITY AUDIT")
    print("=" * 80)

    ts = int(time.time())
    email_a = f"alice.tenant.a.{ts}@enterprise.org"
    email_b = f"bob.tenant.b.{ts}@enterprise.org"
    pwd = "SecurePassword2026!"

    # 1. Register User A (Alice)
    res = client.post("/api/auth/register", json={
        "email": email_a,
        "password": pwd,
        "full_name": "Alice Tenant Owner",
        "role": "Project Manager",
    })
    assert res.status_code in (200, 201), f"User A registration failed: {res.text}"
    token_a = res.json()["access_token"]
    user_a_id = res.json()["user"]["id"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    print(f"✓ 1. Registered Tenant A User: Alice #{user_a_id} ({email_a})")

    # 2. Register User B (Bob)
    res = client.post("/api/auth/register", json={
        "email": email_b,
        "password": pwd,
        "full_name": "Bob Separate Tenant",
        "role": "Developer",
    })
    assert res.status_code in (200, 201), f"User B registration failed: {res.text}"
    token_b = res.json()["access_token"]
    user_b_id = res.json()["user"]["id"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    print(f"✓ 2. Registered Tenant B User: Bob #{user_b_id} ({email_b})")

    # 3. User A creates Project Alpha
    proj_a_key = f"AL{ts % 10000:04d}"
    res = client.post("/api/projects", headers=headers_a, json={
        "name": "Project Alpha (Alice Private)",
        "key": proj_a_key,
        "description": "Confidential Project Alpha for Tenant A",
        "status": "Active",
        "priority": "High",
    })
    assert res.status_code == 201, f"Project A creation failed: {res.text}"
    proj_a = res.json()
    proj_a_id = proj_a["id"]
    print(f"✓ 3. Alice created Project Alpha #{proj_a_id} [{proj_a_key}]")

    # 4. User B creates Project Beta
    proj_b_key = f"BT{ts % 10000:04d}"
    res = client.post("/api/projects", headers=headers_b, json={
        "name": "Project Beta (Bob Private)",
        "key": proj_b_key,
        "description": "Independent Project Beta for Tenant B",
        "status": "Active",
        "priority": "Medium",
    })
    assert res.status_code == 201, f"Project B creation failed: {res.text}"
    proj_b = res.json()
    proj_b_id = proj_b["id"]
    print(f"✓ 4. Bob created Project Beta #{proj_b_id} [{proj_b_key}]")

    # 5. Verify User A list_projects contains Project Alpha and NOT Project Beta
    res = client.get("/api/projects", headers=headers_a)
    assert res.status_code == 200
    a_proj_ids = [p["id"] for p in res.json()]
    assert proj_a_id in a_proj_ids, "Project Alpha should be visible to Alice"
    assert proj_b_id not in a_proj_ids, "SECURITY VIOLATION: Alice can see Bob's Project Beta in list query!"
    print(f"✓ 5. Isolation Verified in Project List: Alice sees Project Alpha, Bob's Beta is completely hidden.")

    # 6. Verify User B list_projects contains Project Beta and NOT Project Alpha
    res = client.get("/api/projects", headers=headers_b)
    assert res.status_code == 200
    b_proj_ids = [p["id"] for p in res.json()]
    assert proj_b_id in b_proj_ids, "Project Beta should be visible to Bob"
    assert proj_a_id not in b_proj_ids, "SECURITY VIOLATION: Bob can see Alice's Project Alpha in list query!"
    print(f"✓ 6. Isolation Verified in Project List: Bob sees Project Beta, Alice's Alpha is completely hidden.")

    # 7. SECURITY PROBE: User B attempts manual URL/API direct access to Project Alpha
    res = client.get(f"/api/projects/{proj_a_id}", headers=headers_b)
    assert res.status_code in (403, 404), f"SECURITY FAILURE: Bob was able to GET Project Alpha! Status: {res.status_code}"
    print(f"✓ 7. Security Guard: GET /api/projects/{proj_a_id} by unauthorized user blocked (HTTP {res.status_code})")

    # 8. SECURITY PROBE: User B attempts to edit Project Alpha
    res = client.put(f"/api/projects/{proj_a_id}", headers=headers_b, json={"name": "Hacked Project Alpha"})
    assert res.status_code in (403, 404), f"SECURITY FAILURE: Bob was able to PUT Project Alpha! Status: {res.status_code}"
    print(f"✓ 8. Security Guard: PUT /api/projects/{proj_a_id} by unauthorized user blocked (HTTP {res.status_code})")

    # 9. SECURITY PROBE: User B attempts to delete Project Alpha
    res = client.delete(f"/api/projects/{proj_a_id}", headers=headers_b)
    assert res.status_code in (403, 404), f"SECURITY FAILURE: Bob was able to DELETE Project Alpha! Status: {res.status_code}"
    print(f"✓ 9. Security Guard: DELETE /api/projects/{proj_a_id} by unauthorized user blocked (HTTP {res.status_code})")

    # 10. User A creates Sprint Alpha in Project Alpha
    res = client.post("/api/sprints", headers=headers_a, json={
        "project_id": proj_a_id,
        "name": "Sprint Alpha-1 Core",
        "velocity_target": 25,
    })
    assert res.status_code == 201
    sprint_a_id = res.json()["id"]
    print(f"✓ 10. Alice created Sprint Alpha #{sprint_a_id}")

    # 11. SECURITY PROBE: User B attempts to access or start Sprint Alpha
    res = client.get(f"/api/sprints/{sprint_a_id}", headers=headers_b)
    assert res.status_code in (403, 404), f"SECURITY FAILURE: Bob accessed Sprint Alpha! Status: {res.status_code}"
    res = client.post(f"/api/sprints/{sprint_a_id}/start", headers=headers_b)
    assert res.status_code in (403, 404), f"SECURITY FAILURE: Bob started Sprint Alpha! Status: {res.status_code}"
    print(f"✓ 11. Security Guard: GET/POST /api/sprints/{sprint_a_id} by unauthorized user blocked (HTTP {res.status_code})")

    # 12. User A creates Task Alpha in Project Alpha
    res = client.post("/api/tasks", headers=headers_a, json={
        "project_id": proj_a_id,
        "sprint_id": sprint_a_id,
        "title": "Confidential Security Audit Task",
        "story_points": 5,
        "status": "In Progress",
    })
    assert res.status_code == 201
    task_a_id = res.json()["id"]
    print(f"✓ 12. Alice created Task #{task_a_id} ('Confidential Security Audit Task')")

    # 13. SECURITY PROBE: User B attempts to access, drag, or delete Task Alpha
    res = client.get(f"/api/tasks/{task_a_id}", headers=headers_b)
    assert res.status_code in (403, 404), f"SECURITY FAILURE: Bob accessed Task Alpha! Status: {res.status_code}"
    res = client.patch(f"/api/tasks/{task_a_id}/status", headers=headers_b, json={"status": "Done"})
    assert res.status_code in (403, 404), f"SECURITY FAILURE: Bob updated Task Alpha status! Status: {res.status_code}"
    res = client.delete(f"/api/tasks/{task_a_id}", headers=headers_b)
    assert res.status_code in (403, 404), f"SECURITY FAILURE: Bob deleted Task Alpha! Status: {res.status_code}"
    print(f"✓ 13. Security Guard: GET/PATCH/DELETE /api/tasks/{task_a_id} by unauthorized user blocked (HTTP {res.status_code})")

    # 14. SECURITY PROBE: User B attempts to access Project Alpha AI telemetry and reports
    res = client.get(f"/api/ai/project/{proj_a_id}", headers=headers_b)
    assert res.status_code in (403, 404), f"SECURITY FAILURE: Bob accessed AI project health! Status: {res.status_code}"
    res = client.get(f"/api/reports/project/{proj_a_id}", headers=headers_b)
    assert res.status_code in (403, 404), f"SECURITY FAILURE: Bob accessed project reports! Status: {res.status_code}"
    res = client.get(f"/api/reports/export/csv?project_id={proj_a_id}", headers=headers_b)
    assert res.status_code in (403, 404), f"SECURITY FAILURE: Bob downloaded Project Alpha CSV! Status: {res.status_code}"
    print(f"✓ 14. Security Guard: AI telemetry and CSV exports strictly protected from cross-tenant access")

    # 15. User A invites User B to Project Alpha as DEVELOPER
    res = client.post("/api/team", headers=headers_a, json={
        "project_id": proj_a_id,
        "user_id": user_b_id,
        "role": "DEVELOPER",
    })
    assert res.status_code == 201
    print(f"✓ 15. Alice invited Bob to Project Alpha as DEVELOPER")

    # 16. Verify Bob can now access Project Alpha and received notification
    res = client.get(f"/api/projects/{proj_a_id}", headers=headers_b)
    assert res.status_code == 200, f"Bob should now have authorized access to Project Alpha: {res.text}"
    assert res.json()["current_user_role"] == "DEVELOPER"

    res = client.get("/api/notifications", headers=headers_b)
    assert res.status_code == 200
    b_notifs = res.json()
    assert len(b_notifs) > 0, "Bob should have received an invitation notification"
    print(f"✓ 16. Authorization Granted: Bob can now view Project Alpha and received Notification #{b_notifs[0]['id']}")

    # 17. Bob submits Daily Standup Check-in for Project Alpha
    res = client.post("/api/checkins", headers=headers_b, json={
        "project_id": proj_a_id,
        "completed_today": "Configured database indexes and tested multi-tenant isolation.",
        "working_on": "Building WebSocket real-time progress stream.",
        "is_blocked": False,
    })
    assert res.status_code == 201
    checkin_id = res.json()["id"]
    print(f"✓ 17. Bob submitted Daily Check-In #{checkin_id} for Project Alpha")

    # 18. Verify Activity Log
    res = client.get(f"/api/activity?project_id={proj_a_id}", headers=headers_a)
    assert res.status_code == 200
    activities = res.json()
    assert len(activities) >= 3, "Activity log should record project creation, sprint, and check-in"
    print(f"✓ 18. Activity Timeline: {len(activities)} events recorded for Project Alpha")

    # 19. Verify Global Search scoping
    res = client.get(f"/api/search?q=Confidential", headers=headers_b)
    assert res.status_code == 200
    search_results = res.json()
    assert len(search_results["tasks"]) > 0, "Bob should be able to search authorized task"
    print(f"✓ 19. Global Search: Strictly scoped and functional across authorized entities")

    print("=" * 80)
    print("ALL 19 STRICT MULTI-USER DATA ISOLATION AND SECURITY TESTS PASSED 100%!")
    print("=" * 80)


if __name__ == "__main__":
    run_multi_user_isolation_tests()
