"""Tests for Bearer token authentication middleware."""

from __future__ import annotations


class TestAuthMiddleware:
    """Verify the auth dependency on protected and public routes."""

    def test_valid_bearer_token_returns_200(self, client, auth_headers):
        """Request with a valid Bearer token should succeed."""
        resp = client.get("/forge/health", headers=auth_headers)
        assert resp.status_code == 200

    def test_missing_auth_header_returns_401(self, client):
        """Request without an Authorization header should be rejected."""
        resp = client.get("/forge/health")
        assert resp.status_code == 401

    def test_invalid_token_returns_401(self, client):
        """Request with a wrong token value should be rejected."""
        resp = client.get(
            "/forge/health",
            headers={"Authorization": "Bearer wrong-key"},
        )
        assert resp.status_code == 401

    def test_malformed_header_no_bearer_prefix_returns_401(self, client):
        """Authorization header without 'Bearer ' prefix should be rejected."""
        resp = client.get(
            "/forge/health",
            headers={"Authorization": "Token some-key"},
        )
        assert resp.status_code == 401

    def test_manifest_is_public(self, client):
        """GET /forge/manifest must be accessible without any auth."""
        resp = client.get("/forge/manifest")
        assert resp.status_code == 200
