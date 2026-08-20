"""
Rate Limiting and Brute-Force Login Protection Engine.
Thread-safe sliding window rate limiter with failed-login throttling.
"""
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Dict, List, Tuple
from fastapi import HTTPException, Request, status

from app.config import settings

# Thread-safe in-memory sliding window request store: key -> list of timestamps
_request_records: Dict[str, List[float]] = defaultdict(list)
_lock = Lock()


def check_rate_limit(key: str, max_requests: int = 20, window_seconds: int = 60) -> bool:
    """
    Checks if a key (e.g. client IP + endpoint) has exceeded the allowed rate limit.
    Returns True if request is permitted, False if rate limited.
    """
    if not settings.ENABLE_RATE_LIMITING:
        return True

    now = time.time()
    cutoff = now - window_seconds

    with _lock:
        timestamps = _request_records[key]
        # Discard expired timestamps outside window
        _request_records[key] = [ts for ts in timestamps if ts > cutoff]
        if len(_request_records[key]) >= max_requests:
            return False
        _request_records[key].append(now)
        return True


def enforce_rate_limit(
    request: Request,
    max_requests: int = 20,
    window_seconds: int = 60,
    prefix: str = "general",
):
    """
    FastAPI dependency helper that raises HTTP 429 if rate limit is exceeded.
    """
    client_ip = request.client.host if request.client else "unknown"
    key = f"{prefix}:{client_ip}"
    if not check_rate_limit(key, max_requests=max_requests, window_seconds=window_seconds):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please slow down and try again shortly.",
            headers={"Retry-After": str(window_seconds)},
        )


def check_login_lockout(user) -> Tuple[bool, int]:
    """
    Checks if an account is temporarily locked due to consecutive failed login attempts.
    Returns (is_locked, remaining_seconds).
    """
    if not user or not user.lockout_until:
        return False, 0

    now = datetime.now(timezone.utc)
    lockout = user.lockout_until
    if lockout.tzinfo is None:
        lockout = lockout.replace(tzinfo=timezone.utc)

    if now < lockout:
        remaining = int((lockout - now).total_seconds())
        return True, max(1, remaining)

    return False, 0
