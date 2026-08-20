"""
Comprehensive Google OAuth Lifecycle, Local User Linking, Duplicate Prevention,
and Multi-Tenant Data Isolation Test Suite.
"""
import time
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.user import User
from app.models.oauth import OAuthAccount
from app.models.project import Project
from app.models.task import Task
from app.models.sprint import Sprint

client = TestClient(app)


def test_google_auth_complete_flow():
    print("=" * 80)
    print("STARTING GOOGLE AUTHENTICATION & MULTI-TENANT ISOLATION SUITE")
    print("=" * 80)

    ts = int(time.time())
    google_sub_1 = f"google_sub_user1_{ts}"
    email_1 = f"sandeep.google.{ts}@gmail.com"
    name_1 = "Sandeep Yadav"
    avatar_1 = "https://lh3.googleusercontent.com/a/test_avatar_1"

    google_sub_2 = f"google_sub_user2_{ts}"
    email_2 = f"rahul.google.{ts}@gmail.com"
    name_2 = "Rahul Sharma"
    avatar_2 = "https://lh3.googleusercontent.com/a/test_avatar_2"

    # -------------------------------------------------------------------------
    # TEST 1: Rejection of invalid / missing / expired credentials
    # -------------------------------------------------------------------------
    res = client.post("/api/auth/google", json={})
    assert res.status_code in (400, 422), f"Expected 400/422 on empty body, got {res.status_code}"
    print("✓ TEST 1: Empty / missing Google credential rejected (HTTP 400/422)")

    res = client.post("/api/auth/google", json={"credential": "invalid.jwt.token"})
    assert res.status_code == 401, f"Expected 401 on invalid token, got {res.status_code}"
    print("✓ TEST 2: Invalid Google credential signature rejected (HTTP 401)")

    # Test route alias /auth/google as well
    res = client.post("/auth/google", json={"credential": "invalid.jwt.token"})
    assert res.status_code == 401, f"Expected 401 on alias endpoint, got {res.status_code}"
    print("✓ TEST 3: Route alias /auth/google verified and operational (HTTP 401 on bad token)")

    # -------------------------------------------------------------------------
    # TEST 4: First-time Google Login for User 1 (Sandeep)
    # -------------------------------------------------------------------------
    mock_payload_1 = {
        "email": email_1,
        "full_name": name_1,
        "google_sub": google_sub_1,
        "avatar_url": avatar_1,
        "email_verified": True,
    }

    with patch("app.routers.auth.verify_google_identity", return_value=mock_payload_1):
        res = client.post("/api/auth/google", json={"credential": "mock_google_credential_1"})
        assert res.status_code == 200, f"Google login failed: {res.text}"
        data_1 = res.json()
        token_1 = data_1["access_token"]
        user_1 = data_1["user"]
        assert user_1["email"] == email_1
        assert user_1["full_name"] == name_1
        assert user_1["google_sub"] == google_sub_1
        assert user_1["auth_provider"] == "google"
        user_1_id = user_1["id"]
        headers_1 = {"Authorization": f"Bearer {token_1}"}
        print(f"✓ TEST 4: Google User 1 created & authenticated (#{user_1_id}, {email_1})")

    # Verify User and OAuthAccount records in DB
    db = SessionLocal()
    try:
        db_user_1 = db.query(User).filter(User.id == user_1_id).first()
        assert db_user_1 is not None
        assert db_user_1.google_sub == google_sub_1

        db_oauth_1 = db.query(OAuthAccount).filter(
            OAuthAccount.user_id == user_1_id,
            OAuthAccount.provider == "GOOGLE",
            OAuthAccount.provider_user_id == google_sub_1,
        ).first()
        assert db_oauth_1 is not None, "OAuthAccount record must exist"
        print(f"✓ TEST 5: OAuthAccount external identity linked in DB for User 1")
    finally:
        db.close()

    # -------------------------------------------------------------------------
    # TEST 6: User 1 accesses Protected APIs with Application JWT
    # -------------------------------------------------------------------------
    # /api/auth/me (browser refresh test)
    res = client.get("/api/auth/me", headers=headers_1)
    assert res.status_code == 200
    assert res.json()["id"] == user_1_id
    print("✓ TEST 6: Browser refresh simulation: /api/auth/me validates application JWT successfully")

    # User 1 creates Project Alpha
    res = client.post("/api/projects", headers=headers_1, json={
        "name": "Sandeep AI Architecture Project",
        "key": f"SA{ts % 1000:03d}",
        "description": "Private project owned by Sandeep",
        "status": "Active",
        "priority": "High",
    })
    assert res.status_code == 201, f"Failed to create project: {res.text}"
    proj_1 = res.json()
    proj_1_id = proj_1["id"]
    print(f"✓ TEST 7: User 1 created Project #{proj_1_id} ('{proj_1['name']}')")

    # User 1 creates Sprint and Task
    res = client.post("/api/sprints", headers=headers_1, json={
        "project_id": proj_1_id,
        "name": "Sprint 1 - Foundation",
        "velocity_target": 30,
    })
    assert res.status_code == 201
    sprint_1_id = res.json()["id"]

    res = client.post("/api/tasks", headers=headers_1, json={
        "project_id": proj_1_id,
        "sprint_id": sprint_1_id,
        "title": "Sandeep Confidential Core Feature",
        "story_points": 8,
        "status": "In Progress",
    })
    assert res.status_code == 201
    task_1_id = res.json()["id"]
    print(f"✓ TEST 8: User 1 created Sprint #{sprint_1_id} and Task #{task_1_id}")

    # -------------------------------------------------------------------------
    # TEST 9: Login again with SAME Google account -> No duplicate user created
    # -------------------------------------------------------------------------
    with patch("app.routers.auth.verify_google_identity", return_value=mock_payload_1):
        res = client.post("/api/auth/google", json={"credential": "mock_google_credential_1_again"})
        assert res.status_code == 200
        relogin_data = res.json()
        assert relogin_data["user"]["id"] == user_1_id, "Must return the exact same user record"
        print(f"✓ TEST 9: Duplicate Prevention: Re-login returned identical User #{user_1_id}, NO duplicates created")

    # Verify count in DB
    db = SessionLocal()
    try:
        user_count = db.query(User).filter(User.email == email_1).count()
        assert user_count == 1, f"Expected exactly 1 user for {email_1}, found {user_count}"
        oauth_count = db.query(OAuthAccount).filter(OAuthAccount.provider_user_id == google_sub_1).count()
        assert oauth_count == 1, f"Expected exactly 1 OAuthAccount for {google_sub_1}, found {oauth_count}"
        print("✓ TEST 10: Database integrity verified: exactly 1 User and 1 OAuthAccount")
    finally:
        db.close()

    # -------------------------------------------------------------------------
    # TEST 11: Login with SECOND Google account (Rahul) -> Separate Local User
    # -------------------------------------------------------------------------
    mock_payload_2 = {
        "email": email_2,
        "full_name": name_2,
        "google_sub": google_sub_2,
        "avatar_url": avatar_2,
        "email_verified": True,
    }

    with patch("app.routers.auth.verify_google_identity", return_value=mock_payload_2):
        res = client.post("/api/auth/google", json={"credential": "mock_google_credential_2"})
        assert res.status_code == 200
        data_2 = res.json()
        token_2 = data_2["access_token"]
        user_2 = data_2["user"]
        user_2_id = user_2["id"]
        assert user_2_id != user_1_id, "User 2 must have a distinct user ID"
        assert user_2["email"] == email_2
        headers_2 = {"Authorization": f"Bearer {token_2}"}
        print(f"✓ TEST 11: Google User 2 created & authenticated (#{user_2_id}, {email_2})")

    # -------------------------------------------------------------------------
    # TEST 12: STRICT MULTI-USER DATA ISOLATION BETWEEN GOOGLE ACCOUNTS
    # -------------------------------------------------------------------------
    # User 2 lists projects: Project Alpha must NOT appear
    res = client.get("/api/projects", headers=headers_2)
    assert res.status_code == 200
    user_2_projects = [p["id"] for p in res.json()]
    assert proj_1_id not in user_2_projects, "SECURITY VIOLATION: User 2 sees User 1's project in list!"
    print("✓ TEST 12a: Project List Isolation: Sandeep's project is completely invisible to Rahul")

    # User 2 attempts direct access to User 1's project -> 403 Forbidden
    res = client.get(f"/api/projects/{proj_1_id}", headers=headers_2)
    assert res.status_code in (403, 404), f"Expected 403/404, got {res.status_code}"
    print(f"✓ TEST 12b: Direct Project Access: GET /api/projects/{proj_1_id} blocked for Rahul (HTTP {res.status_code})")

    # User 2 attempts direct access to User 1's sprint -> 403 Forbidden
    res = client.get(f"/api/sprints/{sprint_1_id}", headers=headers_2)
    assert res.status_code in (403, 404), f"Expected 403/404, got {res.status_code}"
    print(f"✓ TEST 12c: Direct Sprint Access: GET /api/sprints/{sprint_1_id} blocked for Rahul (HTTP {res.status_code})")

    # User 2 attempts direct access to User 1's task -> 403 Forbidden
    res = client.get(f"/api/tasks/{task_1_id}", headers=headers_2)
    assert res.status_code in (403, 404), f"Expected 403/404, got {res.status_code}"
    print(f"✓ TEST 12d: Direct Task Access: GET /api/tasks/{task_1_id} blocked for Rahul (HTTP {res.status_code})")

    # User 2 attempts direct access to User 1's AI project insights -> 403 Forbidden
    res = client.get(f"/api/ai/project/{proj_1_id}", headers=headers_2)
    assert res.status_code in (403, 404), f"Expected 403/404, got {res.status_code}"
    print(f"✓ TEST 12e: AI Health Isolation: GET /api/ai/project/{proj_1_id} blocked for Rahul (HTTP {res.status_code})")

    # -------------------------------------------------------------------------
    # TEST 13: Existing Local Email/Password User links verified Google Account
    # -------------------------------------------------------------------------
    local_email = f"existing.local.{ts}@enterprise.org"
    local_pwd = "StrongLocalPass2026!#"
    res = client.post("/api/auth/register", json={
        "email": local_email,
        "password": local_pwd,
        "confirm_password": local_pwd,
        "full_name": "Local Account User",
        "role": "QA Engineer",
    })
    assert res.status_code == 201
    local_user_id = res.json()["user"]["id"]
    print(f"✓ TEST 13a: Registered standard local email/password user #{local_user_id} ({local_email})")

    # Now this user signs in via Google with the same verified email
    google_sub_local = f"google_sub_linked_{ts}"
    mock_payload_link = {
        "email": local_email,
        "full_name": "Local Account User (Google Linked)",
        "google_sub": google_sub_local,
        "avatar_url": "https://lh3.googleusercontent.com/a/linked_avatar",
        "email_verified": True,
    }

    with patch("app.routers.auth.verify_google_identity", return_value=mock_payload_link):
        res = client.post("/api/auth/google", json={"credential": "mock_google_link_token"})
        assert res.status_code == 200
        linked_data = res.json()
        assert linked_data["user"]["id"] == local_user_id, "Must link to existing user account"
        assert linked_data["user"]["google_sub"] == google_sub_local
        print(f"✓ TEST 13b: Existing local user #{local_user_id} safely linked with Google identity (No duplicate)")

    # -------------------------------------------------------------------------
    # TEST 14: Logout clears session
    # -------------------------------------------------------------------------
    res = client.post("/api/auth/logout", headers=headers_1)
    assert res.status_code == 200
    print("✓ TEST 14: Logout endpoint succeeded and cleared session")

    print("=" * 80)
    print("ALL 14 GOOGLE AUTHENTICATION & MULTI-TENANT ISOLATION TESTS PASSED 100%!")
    print("=" * 80)


if __name__ == "__main__":
    test_google_auth_complete_flow()
