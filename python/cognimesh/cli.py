#!/usr/bin/env python3
"""CogniMesh CLI — validate contracts and call local API."""

from __future__ import annotations

import argparse
import json
import sys

from cognimesh.client import CogniMeshClient
from cognimesh.contract import load_contract


def cmd_validate(args: argparse.Namespace) -> int:
    contract = load_contract(args.path)
    name = contract.get("metadata", {}).get("name", "?")
    version = contract.get("metadata", {}).get("version", "?")
    print(f"OK: {name}@{version}")
    return 0


def cmd_health(args: argparse.Namespace) -> int:
    client = CogniMeshClient(args.api)
    print(json.dumps(client.health(), indent=2))
    return 0


def cmd_lineage(args: argparse.Namespace) -> int:
    client = CogniMeshClient(args.api, token=args.token)
    print(json.dumps(client.lineage_catalog(args.domain), indent=2))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="cognimesh", description="CogniMesh Python SDK CLI")
    parser.add_argument("--api", default="http://localhost:4000", help="API base URL")
    parser.add_argument("--token", default=None, help="Bearer JWT (optional)")

    sub = parser.add_subparsers(dest="command", required=True)

    p_val = sub.add_parser("validate", help="Validate a DataContract YAML file")
    p_val.add_argument("path")
    p_val.set_defaults(func=cmd_validate)

    p_health = sub.add_parser("health", help="GET /health")
    p_health.set_defaults(func=cmd_health)

    p_lin = sub.add_parser("lineage", help="GET /api/v1/lineage/catalog")
    p_lin.add_argument("--domain", default=None)
    p_lin.set_defaults(func=cmd_lineage)

    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except Exception as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
