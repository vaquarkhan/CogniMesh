"""Tests for cognimesh.contract."""

from __future__ import annotations

from pathlib import Path

import pytest

from cognimesh.contract import load_contract, safe_yaml_load

REPO_ROOT = Path(__file__).resolve().parents[2]
EXAMPLE_CONTRACT = REPO_ROOT / "contracts" / "examples" / "structured-cdc-pipeline.yaml"


def test_safe_yaml_load_parses_mapping() -> None:
    data = safe_yaml_load("apiVersion: cognimesh.io/v1\nmetadata:\n  name: demo\n")
    assert isinstance(data, dict)
    assert data["apiVersion"] == "cognimesh.io/v1"


def test_safe_yaml_load_rejects_oversized_payload() -> None:
    huge = "x" * (512 * 1024 + 1)
    with pytest.raises(ValueError, match="exceeds"):
        safe_yaml_load(huge)


def test_load_contract_example_file() -> None:
    contract = load_contract(str(EXAMPLE_CONTRACT))
    assert contract["apiVersion"] == "cognimesh.io/v1"
    assert contract["metadata"]["name"]
    assert contract["spec"]["schemaEvolution"]["policy"] == "compatible"


def test_load_contract_rejects_non_mapping(tmp_path: Path) -> None:
    path = tmp_path / "bad.yaml"
    path.write_text("- not-a-mapping\n", encoding="utf-8")
    with pytest.raises(ValueError, match="mapping"):
        load_contract(str(path))


def test_load_contract_rejects_wrong_api_version(tmp_path: Path) -> None:
    path = tmp_path / "bad-version.yaml"
    path.write_text("apiVersion: v0\nmetadata:\n  name: x\n", encoding="utf-8")
    with pytest.raises(ValueError, match="apiVersion"):
        load_contract(str(path))
