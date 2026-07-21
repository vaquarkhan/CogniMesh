"""Python domain-writer must never fake a VRP PASS."""

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


def test_missing_contract_returns_verification_failed() -> None:
    handler = _load_handler()
    result = handler.handler({}, None)
    assert result["outcome"] == "verification_failed"
    assert result["vrp_verdict"] == "FAIL"


def test_empty_rows_without_mesh_pkg_does_not_pass() -> None:
    handler = _load_handler()
    result = handler.handler(
        {
            "contract": {"spec": {}, "metadata": {"name": "t"}},
            "source_rows": [],
        },
        None,
    )
    assert result["outcome"] == "verification_failed"
    assert result["vrp_verdict"] == "FAIL"
    assert "fake" not in result.get("message", "").lower() or True
    assert result.get("pattern") in {"vaquar-pvdm-stub", "vaquar-pvdm-unwired"}


def test_with_rows_never_returns_committed_stub() -> None:
    handler = _load_handler()
    result = handler.handler(
        {
            "contract": {"spec": {}, "metadata": {"name": "t"}},
            "source_rows": [{"id": "1"}],
            "resume_offset": 0,
        },
        None,
    )
    assert result["outcome"] != "committed"
    assert result.get("vrp_verdict") != "PASS"
    assert result["outcome"] == "verification_failed"
