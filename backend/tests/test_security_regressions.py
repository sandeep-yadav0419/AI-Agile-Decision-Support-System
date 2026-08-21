from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app


def register(client, email="manager@example.com"):
    response = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "SecureTestPassword2026!",
            "confirm_password": "SecureTestPassword2026!",
            "full_name": "Test Manager",
            "role": "Project Manager",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_production_rejects_default_secrets_and_demo_seed():
    try:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="replace-with-a-secure-random-secret-key-in-production",
            JWT_SECRET_KEY=None,
            CSRF_SECRET=None,
            ENABLE_DEMO_SEED=False,
            _env_file=None,
        )
    except ValueError as error:
        assert "Production security configuration is invalid" in str(error)
    else:
        raise AssertionError("Production configuration accepted development secrets")


def test_seed_requires_authentication_and_csrf_for_cookie_session():
    with TestClient(app) as client:
        unauthenticated = client.post("/api/seed")
        assert unauthenticated.status_code == 401

        register(client)
        cookie_only = client.post("/api/seed")
        assert cookie_only.status_code == 403


def test_password_reset_is_enumeration_safe_and_changes_password():
    with TestClient(app) as client:
        register(client, "reset@example.com")

        missing = client.post("/api/auth/forgot-password", json={"email": "missing@example.com"})
        existing = client.post("/api/auth/forgot-password", json={"email": "reset@example.com"})
        assert missing.status_code == existing.status_code == 200
        assert missing.json()["message"] == existing.json()["message"]
        assert missing.json()["reset_token"] is None

        token = existing.json()["reset_token"]
        assert token
        changed = client.post(
            "/api/auth/reset-password",
            json={
                "token": token,
                "new_password": "NewSecurePassword2026!",
                "confirm_new_password": "NewSecurePassword2026!",
            },
        )
        assert changed.status_code == 200
        login = client.post(
            "/api/auth/login",
            json={"email": "reset@example.com", "password": "NewSecurePassword2026!"},
        )
        assert login.status_code == 200
