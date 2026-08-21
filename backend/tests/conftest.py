import os
import tempfile

_test_dir = tempfile.TemporaryDirectory()
os.environ["DATABASE_URL"] = f"sqlite:///{_test_dir.name}/test.db"
os.environ["ENABLE_DEMO_SEED"] = "False"
os.environ["ENABLE_RATE_LIMITING"] = "False"
os.environ["SECRET_KEY"] = "test-only-secret-key-that-is-long-enough-123456789"


def pytest_sessionfinish(session, exitstatus):
    _test_dir.cleanup()
