# CogniMesh demos and audience guides

Moved out of the README so the front door stays technical and short.

## Captioned UI demos

| Demo | Link |
|------|------|
| How it works (~2 min) | [cognimesh-howto-demo.mp4](assets/cognimesh-howto-demo.mp4) |
| Getting started UI | [cognimesh-tutorial-demo.mp4](assets/cognimesh-tutorial-demo.mp4) |
| Platform features | [cognimesh-features-demo.mp4](assets/cognimesh-features-demo.mp4) |
| Pipeline end-to-end | [cognimesh-pipeline-demo.mp4](assets/cognimesh-pipeline-demo.mp4) |
| Agent Builder | [cognimesh-agent-demo.mp4](assets/cognimesh-agent-demo.mp4) |
| SDP export | [cognimesh-sdp-export-demo.mp4](assets/cognimesh-sdp-export-demo.mp4) |
| dbt export | [cognimesh-dbt-export-demo.mp4](assets/cognimesh-dbt-export-demo.mp4) |
| Marketplace proof verify | [cognimesh-marketplace-proof-demo.mp4](assets/cognimesh-marketplace-proof-demo.mp4) |

Regenerate: `npm run docs:demo` (Playwright + ffmpeg). Subsets: `DEMO_ONLY=howto` · `DEMO_ONLY=sdp-export,dbt-export,marketplace-proof`.

## Who should read what

| Audience | Start here |
|----------|------------|
| Engineer / architect | [README](../README.md) → [POSITIONING](POSITIONING.md) → [Vaquar Pattern](vaquar-pattern.md) |
| Business / steward | [Business & steward guide](README-business-stewards.md) |
| C-suite | [C-suite summary](README-business-stewards.md#for-c-suite--executive-leadership) |
| Marketplace consumer | [MARKETPLACE.md](MARKETPLACE.md) · [proof tutorial](tutorials/proof-gated-marketplace.md) |
| SDP / dbt export | [sdp-and-dbt tutorial](tutorials/sdp-and-dbt.md) |

## Pattern & agent catalogs

- Pipeline canvases & agent templates: [tutorials/README.md](tutorials/README.md)
- Portal UI / Architectures tab: [PORTAL_UI.md](PORTAL_UI.md)

← [Documentation map](README.md)
