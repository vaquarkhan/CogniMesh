"use strict";

const { sha256Canonical } = require("./canonical");

function hashContract(contract) {
  if (!contract) return null;
  return sha256Canonical(contract);
}

function contractBinding(contract) {
  const hash = hashContract(contract);
  if (!hash) return null;
  return {
    contract_hash: hash,
    contract_version: contract?.metadata?.version || "0.0.0",
    contract_name: contract?.metadata?.name || null,
    contract_domain: contract?.metadata?.domain || null,
  };
}

function verifyContractBinding(proof, contract) {
  const bound = proof?.contract_binding;
  if (!bound?.contract_hash) {
    return { valid: true, skipped: true, reason: "no contract_binding in proof" };
  }
  if (!contract) {
    return { valid: true, skipped: true, reason: "no contract provided for re-hash" };
  }
  const expected = hashContract(contract);
  const valid = expected === bound.contract_hash;
  return {
    valid,
    reason: valid ? null : "contract_hash mismatch — proof not minted under this contract version",
  };
}

module.exports = { hashContract, contractBinding, verifyContractBinding };
