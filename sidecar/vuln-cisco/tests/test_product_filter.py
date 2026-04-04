"""Tests for _extract_model_family and _filter_by_product in cve_lookup."""

from __future__ import annotations

import pytest

from scanner.cve_lookup import _extract_model_family, _filter_by_product


# ─── _extract_model_family ───────────────────────────────────────────────


class TestExtractModelFamily:
    """Known model string parsing."""

    def test_ws_c_catalyst_with_letters(self):
        assert _extract_model_family("WS-C3560CX-12PD-S") == "3560-CX"

    def test_c_prefix_catalyst(self):
        assert _extract_model_family("C9200L-24P-4G") == "9200L"

    def test_c_prefix_subfamily_distinction(self):
        """C9200CX and C9200L must extract differently to avoid cross-matching."""
        assert _extract_model_family("C9200CX-12P-2X2G") == "9200CX"
        assert _extract_model_family("C9200L-24P-4G") != _extract_model_family("C9200CX-12P-2X2G")

    def test_ie_prefix(self):
        assert _extract_model_family("IE-3300-8T2S") == "3300"

    def test_asa_prefix(self):
        assert _extract_model_family("ASA5525-K9") == "ASA 5525"

    def test_isr_prefix(self):
        assert _extract_model_family("ISR4331/K9") == "ISR 4331"

    def test_unknown_model_returns_none(self):
        assert _extract_model_family("UNKNOWN-MODEL-123") is None

    def test_ws_c_catalyst_digits_only(self):
        """WS-C model with no trailing letters after digits."""
        assert _extract_model_family("WS-C3750-24PS") == "3750"


# ─── _filter_by_product ─────────────────────────────────────────────────


def _make_advisory(
    advisory_id: str = "cisco-sa-test",
    product_names: list[str] | None = None,
) -> dict:
    """Build a minimal advisory dict for testing."""
    adv: dict = {"advisoryId": advisory_id}
    if product_names is not None:
        adv["productNames"] = product_names
    return adv


class TestFilterByProduct:
    """Advisory filtering logic."""

    def test_unverified_when_model_unknown(self):
        """Unknown model -> all advisories kept with product_match='unverified'."""
        advs = [_make_advisory("sa-1", ["Cisco Something"])]
        result = _filter_by_product(advs, "UNKNOWN-MODEL-123")
        assert len(result) == 1
        assert result[0]["product_match"] == "unverified"

    def test_no_data_when_product_names_empty(self):
        """Advisory with empty productNames list -> kept with 'no_data'."""
        advs = [_make_advisory("sa-1", [])]
        result = _filter_by_product(advs, "WS-C3560CX-12PD-S")
        assert len(result) == 1
        assert result[0]["product_match"] == "no_data"

    def test_no_data_when_product_names_null(self):
        """Advisory with no productNames key at all -> kept with 'no_data'."""
        adv = {"advisoryId": "sa-1"}  # no productNames key
        result = _filter_by_product([adv], "C9200L-24P-4G")
        assert len(result) == 1
        assert result[0]["product_match"] == "no_data"

    def test_verified_match(self):
        """Advisory whose productNames contain the family -> 'verified'."""
        advs = [
            _make_advisory(
                "sa-1",
                ["Cisco Catalyst 3560-CX Series Switches"],
            )
        ]
        result = _filter_by_product(advs, "WS-C3560CX-12PD-S")
        assert len(result) == 1
        assert result[0]["product_match"] == "verified"

    def test_non_matching_filtered_out(self):
        """Advisory with product names that don't match -> excluded."""
        advs = [
            _make_advisory(
                "sa-1",
                ["Cisco Nexus 9000 Series Switches"],
            )
        ]
        result = _filter_by_product(advs, "WS-C3560CX-12PD-S")
        assert len(result) == 0

    def test_case_insensitive_matching(self):
        """Family match should be case-insensitive."""
        advs = [
            _make_advisory(
                "sa-1",
                ["CISCO CATALYST 3560-cx SERIES SWITCHES"],
            )
        ]
        result = _filter_by_product(advs, "WS-C3560CX-12PD-S")
        assert len(result) == 1
        assert result[0]["product_match"] == "verified"

    def test_mixed_advisories(self):
        """Mix of matching, non-matching, and no-data advisories."""
        advs = [
            _make_advisory("sa-match", ["Cisco Catalyst 9200L Series Switches"]),
            _make_advisory("sa-miss", ["Cisco ASA 5500 Series"]),
            _make_advisory("sa-empty", []),
        ]
        result = _filter_by_product(advs, "C9200L-24P-4G")
        ids = [a["advisoryId"] for a in result]
        assert "sa-match" in ids
        assert "sa-miss" not in ids
        assert "sa-empty" in ids
        # Verify tags
        by_id = {a["advisoryId"]: a for a in result}
        assert by_id["sa-match"]["product_match"] == "verified"
        assert by_id["sa-empty"]["product_match"] == "no_data"

    def test_asa_model_verified(self):
        """ASA model matches advisory mentioning ASA 5525."""
        advs = [
            _make_advisory("sa-asa", ["Cisco ASA 5525-X Adaptive Security Appliance"])
        ]
        result = _filter_by_product(advs, "ASA5525-K9")
        assert len(result) == 1
        assert result[0]["product_match"] == "verified"

    def test_isr_model_verified(self):
        """ISR model matches advisory mentioning ISR 4331."""
        advs = [
            _make_advisory("sa-isr", ["Cisco ISR 4331 Integrated Services Router"])
        ]
        result = _filter_by_product(advs, "ISR4331/K9")
        assert len(result) == 1
        assert result[0]["product_match"] == "verified"
