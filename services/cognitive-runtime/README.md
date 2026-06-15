# CogniMesh Cognitive Runtime

Progress-aware transactional controller for exactly-once AI agent pipeline execution on EKS.

## Concepts

| Concept | Purpose |
|---------|---------|
| **Epoch** | Monotonic sequence per partition; rejects stale commits |
| **Frontier** | In-flight ceiling; enforces strict ordering (epoch N before N+1) |
| **Compensation** | Rollback handler invoked on agent failure |

## Usage

```go
executor := runtime.NewInMemoryExecutor()
ctrl := runtime.NewController(executor)
ctrl.RegisterCompensation("cognimesh.compensation.media-rollback", runtime.MediaRollbackCompensation{})

result, err := ctrl.Commit(ctx, job, "cognimesh.compensation.media-rollback")
```

## Test

```bash
go test ./...
```
