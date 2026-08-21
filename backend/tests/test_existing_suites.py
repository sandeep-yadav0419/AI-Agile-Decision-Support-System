"""Pytest-discoverable wrappers for the project's original executable suites."""
from test_e2e import run_e2e_tests
from test_multi_user_isolation import run_multi_user_isolation_tests
from test_security_suite import run_security_hardening_suite
from test_verify_google_identity import run_unit_tests


def test_e2e_suite():
    run_e2e_tests()


def test_multi_user_isolation_suite():
    run_multi_user_isolation_tests()


def test_security_hardening_suite():
    run_security_hardening_suite()


def test_google_identity_unit_suite():
    run_unit_tests()
