"use strict";

/**
 * Paper N11: consumer reads MUST be confined to the gated catalog snapshot.
 * Staged/unpublished branches MUST NOT be consumer-readable.
 */
class StagingSnapshotError extends Error {
  constructor(message) {
    super(message);
    this.name = "StagingSnapshotError";
    this.code = "STAGING_SNAPSHOT_DENIED";
  }
}

function publishedSnapshotId(proof) {
  return proof?.commit_receipt?.iceberg_snapshot_id || null;
}

function assertGatedConsumerSnapshot(proof, options = {}) {
  if (!proof) {
    throw new StagingSnapshotError("VRP proof required for consumer snapshot access");
  }
  if (proof.staging === true || proof.unpublished === true || proof.branch === "staging") {
    throw new StagingSnapshotError("staged branch is not consumer-readable (paper N11)");
  }
  const published = publishedSnapshotId(proof);
  if (!published) {
    throw new StagingSnapshotError("consumer reads require a gated catalog snapshot (paper N11)");
  }
  const requested = options.requestedSnapshotId;
  if (requested != null && String(requested) !== String(published)) {
    throw new StagingSnapshotError("requested snapshot is not the gated catalog snapshot (paper N11)");
  }
  return String(published);
}

module.exports = {
  StagingSnapshotError,
  publishedSnapshotId,
  assertGatedConsumerSnapshot,
};
