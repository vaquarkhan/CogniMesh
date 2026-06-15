"""HTTP client for CogniMesh API gateway."""

from __future__ import annotations

from typing import Any, Optional

import httpx


class CogniMeshClient:
    def __init__(self, base_url: str = "http://localhost:4000", token: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.token = token

    def _headers(self) -> dict[str, str]:
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def health(self) -> dict[str, Any]:
        r = httpx.get(f"{self.base_url}/health", timeout=10.0)
        r.raise_for_status()
        return r.json()

    def preview(self, nodes: list, edges: list, pipeline_meta: dict) -> dict[str, Any]:
        r = httpx.post(
            f"{self.base_url}/api/v1/pipelines/preview",
            headers=self._headers(),
            json={"nodes": nodes, "edges": edges, "pipelineMeta": pipeline_meta},
            timeout=60.0,
        )
        return r.json()

    def deploy(self, nodes: list, edges: list, pipeline_meta: dict) -> dict[str, Any]:
        r = httpx.post(
            f"{self.base_url}/api/v1/pipelines/deploy",
            headers=self._headers(),
            json={"nodes": nodes, "edges": edges, "pipelineMeta": pipeline_meta},
            timeout=120.0,
        )
        return r.json()

    def list_products(self) -> list[dict[str, Any]]:
        r = httpx.get(f"{self.base_url}/api/v1/products", headers=self._headers(), timeout=30.0)
        r.raise_for_status()
        return r.json()

    def lineage_catalog(self, domain: Optional[str] = None) -> dict[str, Any]:
        url = f"{self.base_url}/api/v1/lineage/catalog"
        if domain:
            url += f"?domain={domain}"
        r = httpx.get(url, headers=self._headers(), timeout=30.0)
        r.raise_for_status()
        return r.json()
