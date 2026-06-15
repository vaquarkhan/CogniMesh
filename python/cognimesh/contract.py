"""Safe YAML loading for DataContract manifests."""

from __future__ import annotations

import yaml

MAX_BYTES = 512 * 1024
MAX_ALIASES = 16


def safe_yaml_load(text: str) -> object:
    if len(text.encode("utf-8")) > MAX_BYTES:
        raise ValueError(f"YAML exceeds {MAX_BYTES} bytes")
    return yaml.load(text, Loader=yaml.SafeLoader)


def load_contract(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        data = safe_yaml_load(f.read())
    if not isinstance(data, dict):
        raise ValueError("Contract must be a YAML mapping")
    if data.get("apiVersion") != "cognimesh.io/v1":
        raise ValueError("apiVersion must be cognimesh.io/v1")
    return data
