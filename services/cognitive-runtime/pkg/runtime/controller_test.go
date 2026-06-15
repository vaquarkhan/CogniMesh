package runtime_test

import (
	"context"
	"errors"
	"testing"

	"github.com/cognimesh/cognitive-runtime/pkg/runtime"
)

func TestController_ExactlyOnceCommit(t *testing.T) {
	executor := runtime.NewInMemoryExecutor()
	ctrl := runtime.NewController(executor)
	ctrl.RegisterCompensation("rollback", runtime.NoOpCompensation{})

	job := runtime.Job{
		PipelineID:     "media-transcript-enrichment",
		PartitionKey:   "partition-0",
		IdempotencyKey: "s3://bucket/video.mp4:2026-06-15T10:00:00Z",
		Epoch:          1,
		Payload:        map[string]any{"staging_uri": "s3://staging/tmp/1"},
	}

	ctx := context.Background()

	result, err := ctrl.Commit(ctx, job, "rollback")
	if err != nil {
		t.Fatalf("commit failed: %v", err)
	}
	if !result.Committed || result.OutputURI == "" {
		t.Fatalf("expected committed result, got %+v", result)
	}

	// Duplicate epoch must be rejected.
	_, err = ctrl.Commit(ctx, job, "rollback")
	if !errors.Is(err, runtime.ErrEpochStale) {
		t.Fatalf("expected ErrEpochStale, got %v", err)
	}
}

func TestController_FrontierOrdering(t *testing.T) {
	executor := runtime.NewInMemoryExecutor()
	ctrl := runtime.NewController(executor)

	ctx := context.Background()
	base := runtime.Job{
		PipelineID:   "pipeline",
		PartitionKey: "p0",
		Epoch:        2,
	}

	_, err := ctrl.Commit(ctx, base, "")
	if !errors.Is(err, runtime.ErrFrontierBlocked) {
		t.Fatalf("expected frontier block for epoch 2 before epoch 1, got %v", err)
	}
}

func TestController_CompensationOnFailure(t *testing.T) {
	executor := runtime.NewInMemoryExecutor()
	executor.SetFailOn("fail-key")
	ctrl := runtime.NewController(executor)
	ctrl.RegisterCompensation("rollback", runtime.NoOpCompensation{})

	job := runtime.Job{
		PipelineID:     "pipeline",
		PartitionKey:   "p0",
		IdempotencyKey: "fail-key",
		Epoch:          1,
	}

	_, err := ctrl.Commit(context.Background(), job, "rollback")
	if err == nil {
		t.Fatal("expected agent failure")
	}
	if ctrl.CommittedEpoch("p0") != 0 {
		t.Fatalf("epoch should not advance on failure, got %d", ctrl.CommittedEpoch("p0"))
	}
}
