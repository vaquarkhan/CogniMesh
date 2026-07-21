"""
CogniMesh Python domain-writer entrypoint.

Honest outcomes only: never return a fake VRP PASS. Production PVDM runs in the
Node Lambda at services/lambda/domain-writer (runPvdmWorkload).
"""
from __future__ import annotations

import json
import os


def handler(event, context):
    contract = event.get("contract") or (event.get("workload") or {}).get("contract")
    if not contract:
        return {
            "outcome": "verification_failed",
            "vrp_verdict": "FAIL",
            "message": "Missing contract",
            "pattern": "vaquar-pvdm",
        }

    source_rows = event.get("source_rows") or (event.get("workload") or {}).get("source_rows") or []
    workload_id = event.get("workload_id") or (event.get("workload") or {}).get("workload_id") or "py-writer"
    resume_offset = int(event.get("resume_offset") or (event.get("workload") or {}).get("resume_offset") or 0)

    # Prefer Node PVDM unless an explicit full coordinator is available and invoked.
    try:
        from serverless_data_mesh import (  # noqa: F401
            DomainTransactionBoundary,
        )
    except ImportError:
        return {
            "outcome": "verification_failed",
            "workload_id": workload_id,
            "resume_offset": resume_offset,
            "vrp_verdict": "FAIL",
            "message": (
                "Python domain-writer does not simulate VRP PASS. "
                "Deploy services/lambda/domain-writer (Node PVDM) "
                "or install and wire a full serverless-data-mesh coordinator."
            ),
            "pattern": "vaquar-pvdm-stub",
            "row_count": len(source_rows),
        }

    # Package present but this handler still does not run IceGuard/VRP/catalog commit.
    return {
        "outcome": "verification_failed",
        "workload_id": workload_id,
        "resume_offset": resume_offset,
        "vrp_verdict": "FAIL",
        "message": (
            "serverless_data_mesh is importable but this handler does not execute "
            "Physical→Verify→Metadata. Use the Node domain-writer Lambda for production PVDM."
        ),
        "pattern": "vaquar-pvdm-unwired",
        "row_count": len(source_rows),
    }
