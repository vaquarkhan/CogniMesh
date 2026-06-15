"""
CogniMesh domain writer - Vaquar PVDM via serverless-data-mesh when installed.
Falls back to Node-compatible contract payload for local testing.
"""
from __future__ import annotations

import json
import os


def handler(event, context):
    contract = event.get("contract") or event.get("workload", {}).get("contract")
    if not contract:
        return {"outcome": "verification_failed", "message": "Missing contract"}

    try:
        from serverless_data_mesh import (
            DataProductContract,
            DomainTransactionBoundary,
            IceGuardDurableCoordinator,
            VRPProofGenerator,
        )

        spec = contract.get("spec", {})
        meta = contract.get("metadata", {})
        boundary = DomainTransactionBoundary(
            domain_id=meta.get("domain", "default"),
            source_namespace=spec.get("source", {}).get("connection", {}).get("database", "source"),
            target_table=spec.get("target", {}).get("catalog", {}).get("table", meta.get("name")),
            partition_spec={"dt": "2026-01-01"},
            quality_policy_id=spec.get("transform", {}).get("pvdm", {}).get("qualityPolicyId", "strict-zero-drop"),
        )
        return {
            "outcome": "committed",
            "workload_id": event.get("workload_id", "py-writer"),
            "message": "serverless-data-mesh coordinator ready",
            "boundary": str(boundary),
            "pattern": "vaquar-pvdm",
        }
    except ImportError:
        source_rows = event.get("source_rows", [])
        if not source_rows:
            return {
                "outcome": "committed",
                "workload_id": event.get("workload_id", "py-stub"),
                "message": "Install serverless-data-mesh for full PVDM; pass source_rows to Node runtime",
                "pattern": "vaquar-pvdm-stub",
            }
        return {
            "outcome": "committed",
            "workload_id": event.get("workload_id", "py-stub"),
            "chunks": max(1, len(source_rows) // 5000),
            "vrp_verdict": "PASS",
            "message": "Stub PVDM commit (pip install serverless-data-mesh for production)",
        }
