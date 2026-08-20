"""
Unit tests for Google ID Token verification edge cases in app.core.security
"""
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
import asyncio
from app.core.security import verify_google_identity
from app.config import settings


def run_unit_tests():
    print("Testing verify_google_identity edge cases...")

    # 1. Test missing token / credential
    try:
        asyncio.run(verify_google_identity())
        assert False, "Should raise HTTPException for missing token"
    except HTTPException as e:
        assert e.status_code == 400
        print("✓ Missing token raises 400")

    # 2. Test invalid issuer
    with patch("app.core.security.google_id_token.verify_oauth2_token", return_value={
        "iss": "malicious-issuer.com",
        "aud": settings.GOOGLE_CLIENT_ID or "test-client-id",
        "sub": "12345",
        "email": "test@gmail.com",
        "email_verified": True,
        "exp": 9999999999,
    }):
        try:
            asyncio.run(verify_google_identity(credential="fake_token"))
            assert False, "Should raise HTTPException for invalid issuer"
        except HTTPException as e:
            assert e.status_code == 401
            assert "Invalid Google token issuer" in e.detail
            print("✓ Invalid token issuer raises 401")

    # 3. Test expired token
    with patch("app.core.security.google_id_token.verify_oauth2_token", return_value={
        "iss": "accounts.google.com",
        "aud": settings.GOOGLE_CLIENT_ID or "test-client-id",
        "sub": "12345",
        "email": "test@gmail.com",
        "email_verified": True,
        "exp": 1000000000, # expired
    }):
        try:
            asyncio.run(verify_google_identity(credential="fake_token"))
            assert False, "Should raise HTTPException for expired token"
        except HTTPException as e:
            assert e.status_code == 401
            assert "expired" in e.detail
            print("✓ Expired token raises 401")

    # 4. Test unverified email
    with patch("app.core.security.google_id_token.verify_oauth2_token", return_value={
        "iss": "https://accounts.google.com",
        "aud": settings.GOOGLE_CLIENT_ID or "test-client-id",
        "sub": "12345",
        "email": "unverified@gmail.com",
        "email_verified": False,
        "exp": 9999999999,
    }):
        try:
            asyncio.run(verify_google_identity(credential="fake_token"))
            assert False, "Should raise HTTPException for unverified email"
        except HTTPException as e:
            assert e.status_code == 400
            assert "not verified" in e.detail
            print("✓ Unverified email raises 400")

    # 5. Test valid verified Google payload
    with patch("app.core.security.google_id_token.verify_oauth2_token", return_value={
        "iss": "https://accounts.google.com",
        "aud": settings.GOOGLE_CLIENT_ID or "test-client-id",
        "sub": "987654321",
        "email": "sandeep@gmail.com",
        "email_verified": True,
        "name": "Sandeep Yadav",
        "picture": "https://photo.jpg",
        "exp": 9999999999,
    }):
        profile = asyncio.run(verify_google_identity(credential="fake_token"))
        assert profile["email"] == "sandeep@gmail.com"
        assert profile["google_sub"] == "987654321"
        assert profile["full_name"] == "Sandeep Yadav"
        assert profile["email_verified"] is True
        print("✓ Valid Google token verified and parsed successfully")

    print("ALL EDGE CASE UNIT TESTS PASSED 100%!")


if __name__ == "__main__":
    run_unit_tests()
