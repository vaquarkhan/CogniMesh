"""Tests for services/domain-writer/handler.py stub contract."""

from __future__ import annotations

import importlib.util
from pathlib import Path

HANDLER_PATH = Path(__file__).resolve().parents[2] / "services" / "domain-writer" / "handler.py"


def _load_handler():
    spec = importlib.util.spec_from_file_location("domain_writer_handler", HANDLER_PATH)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_empty_source_rows_returns_unverified() -> None:
    handler = _load_handler()
    result = handler.handler(
        {
            "contract": {"spec": {}, "metadata": {"name": "t"}},
            "source_rows": [],
        },
        None,
    )
    assert result["outcome"] == "unverified"
    assert result["vrp_verdict"] == "UNVERIFIED"


def test_missing_contract_returns_verification_failed() -> None:
    handler = _load_handler()
    result = handler.handler({}, None)
    assert result["outcome"] == "verification_failed"
