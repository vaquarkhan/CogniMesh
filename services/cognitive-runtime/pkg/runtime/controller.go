// Package runtime implements CogniMesh's progress-aware transactional controller
// for exactly-once AI agent pipeline execution on Kubernetes.
package runtime

import (
	"context"
	"errors"
	"fmt"
	"sync"
)

var (
	ErrEpochStale      = errors.New("epoch is stale: a newer epoch has been committed")
	ErrFrontierBlocked = errors.New("transaction blocked: frontier not reached")
	ErrCompensation    = errors.New("compensation handler failed")
)

// Job represents a single agentic transform invocation.
type Job struct {
	PipelineID     string
	PartitionKey   string
	IdempotencyKey string
	Epoch          uint64
	Payload        map[string]any
}

// JobResult is the outcome of a committed agent job.
type JobResult struct {
	Job       Job
	OutputURI string
	Committed bool
}

// CompensationHandler rolls back side effects of a failed or aborted job.
type CompensationHandler interface {
	Compensate(ctx context.Context, job Job, reason error) error
}

// AgentExecutor runs the AI agent transform.
type AgentExecutor interface {
	Execute(ctx context.Context, job Job) (outputURI string, err error)
}

// Controller manages epoch ordering, frontier isolation, and compensation.
type Controller struct {
	mu        sync.Mutex
	epochs    map[string]uint64 // partitionKey -> last committed epoch
	frontiers map[string]uint64 // partitionKey -> frontier epoch (in-flight ceiling)
	handlers  map[string]CompensationHandler
	executor  AgentExecutor
}

func NewController(executor AgentExecutor) *Controller {
	return &Controller{
		epochs:    make(map[string]uint64),
		frontiers: make(map[string]uint64),
		handlers:  make(map[string]CompensationHandler),
		executor:  executor,
	}
}

func (c *Controller) RegisterCompensation(name string, h CompensationHandler) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.handlers[name] = h
}

// BeginTransaction validates epoch ordering and advances the frontier.
func (c *Controller) BeginTransaction(job Job) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	partition := job.PartitionKey
	lastCommitted := c.epochs[partition]
	if job.Epoch <= lastCommitted {
		return fmt.Errorf("%w: partition=%s epoch=%d committed=%d",
			ErrEpochStale, partition, job.Epoch, lastCommitted)
	}

	frontier := c.frontiers[partition]
	if job.Epoch > frontier+1 {
		return fmt.Errorf("%w: partition=%s epoch=%d frontier=%d",
			ErrFrontierBlocked, partition, job.Epoch, frontier)
	}

	c.frontiers[partition] = job.Epoch
	return nil
}

// Commit executes the agent job and records the epoch on success.
func (c *Controller) Commit(ctx context.Context, job Job, compensationName string) (JobResult, error) {
	if err := c.BeginTransaction(job); err != nil {
		return JobResult{}, err
	}

	outputURI, err := c.executor.Execute(ctx, job)
	if err != nil {
		compErr := c.compensate(ctx, job, compensationName, err)
		if compErr != nil {
			return JobResult{}, fmt.Errorf("%w: %v", ErrCompensation, compErr)
		}
		return JobResult{Job: job, Committed: false}, err
	}

	c.mu.Lock()
	c.epochs[job.PartitionKey] = job.Epoch
	c.mu.Unlock()

	return JobResult{Job: job, OutputURI: outputURI, Committed: true}, nil
}

func (c *Controller) compensate(ctx context.Context, job Job, name string, reason error) error {
	c.mu.Lock()
	handler, ok := c.handlers[name]
	c.mu.Unlock()

	if !ok || handler == nil {
		return nil
	}
	return handler.Compensate(ctx, job, reason)
}

// CommittedEpoch returns the last committed epoch for a partition.
func (c *Controller) CommittedEpoch(partitionKey string) uint64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.epochs[partitionKey]
}
