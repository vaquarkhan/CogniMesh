package runtime

import (
	"context"
	"fmt"
)

// NoOpCompensation is a handler that logs intent without external side effects.
type NoOpCompensation struct{}

func (NoOpCompensation) Compensate(_ context.Context, job Job, reason error) error {
	return fmt.Errorf("compensating job %s epoch %d: %w", job.IdempotencyKey, job.Epoch, reason)
}

// MediaRollbackCompensation implements cognimesh.compensation.media-rollback.
type MediaRollbackCompensation struct {
	StorageDeleter func(ctx context.Context, uri string) error
}

func (m MediaRollbackCompensation) Compensate(ctx context.Context, job Job, reason error) error {
	if uri, ok := job.Payload["staging_uri"].(string); ok && m.StorageDeleter != nil {
		if err := m.StorageDeleter(ctx, uri); err != nil {
			return err
		}
	}
	return fmt.Errorf("media rollback for %s: %w", job.IdempotencyKey, reason)
}
