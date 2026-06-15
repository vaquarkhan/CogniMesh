package runtime

import (
	"context"
	"fmt"
	"sync"
)

// InMemoryExecutor simulates agent execution for local development and tests.
type InMemoryExecutor struct {
	mu      sync.Mutex
	seen    map[string]string
	failKey string
}

func NewInMemoryExecutor() *InMemoryExecutor {
	return &InMemoryExecutor{seen: make(map[string]string)}
}

func (e *InMemoryExecutor) SetFailOn(idempotencyKey string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.failKey = idempotencyKey
}

func (e *InMemoryExecutor) Execute(_ context.Context, job Job) (string, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	if job.IdempotencyKey == e.failKey {
		return "", fmt.Errorf("simulated agent failure for %s", job.IdempotencyKey)
	}

	if uri, ok := e.seen[job.IdempotencyKey]; ok {
		return uri, nil
	}

	uri := fmt.Sprintf("s3://cognimesh-staging/%s/epoch-%d.parquet", job.PipelineID, job.Epoch)
	e.seen[job.IdempotencyKey] = uri
	return uri, nil
}
