# Getting started (UI walkthrough)

Short portal tutorial for first-time designers: **Panels**, **resource setup**, and **AWS Design Review Fix this**.

## Watch

<p align="center">
  <a href="../assets/cognimesh-tutorial-demo.mp4">
    <img src="../assets/cognimesh-tutorial-demo.gif" alt="CogniMesh UI tutorial: Panels menu, Operations, Multi-Source pattern, setup-ready banner, AWS Fix this, Preview YAML" width="900" />
  </a>
</p>

Regenerate: `DEMO_ONLY=tutorial npm run docs:demo` (or full `npm run docs:demo`).

## What you will see

1. **Panels** (header) - Operations, Approvals, Run History, Lineage, Marketplace, Deploy results.
2. **Load Multi-Source workflow** - canvas + AWS Design Review.
3. **Properties → Setup ready** - Create new (Terraform) path needs no Secrets Manager ARN when the checklist is complete.
4. **Use existing database** - surfaces setup findings; **Fix this** opens the review guide.
5. **Preview YAML** - Step Functions / contract preview before deploy.

## Related

- [Tutorials hub](README.md)
- [Portal UI](../PORTAL_UI.md)
- [AWS PVDM runbook](../examples/aws-pvdm-runbook.md)
- [E2E architecture](../E2E_ARCHITECTURE.md)
