"use strict";

const crypto = require("crypto");

const DEFAULT_TTL_SEC = Number(process.env.VRP_PROOF_TTL_SEC || 86400);

/**
 * Sign proof bytes via AWS KMS (production) or local Ed25519 (dev only).
 * Trust model: production = KMS key policy + CloudTrail; not "no trust required".
 */
async function signProofPayload(payloadBytes, options = {}) {
  const keyId = options.keyId || process.env.VRP_KMS_KEY_ID;
  const mode = (process.env.VRP_SIGNING_MODE || (keyId ? "kms" : "dev")).toLowerCase();

  if (mode === "kms" && keyId) {
    const { KMSClient, SignCommand, GetPublicKeyCommand } = require("@aws-sdk/client-kms");
    const client = new KMSClient({});
    const signRes = await client.send(
      new SignCommand({
        KeyId: keyId,
        Message: payloadBytes,
        MessageType: "RAW",
        SigningAlgorithm: process.env.VRP_KMS_SIGNING_ALGORITHM || "ECDSA_SHA_256",
      })
    );
    let publicKeyPem = options.publicKeyPem;
    if (!publicKeyPem) {
      const pub = await client.send(new GetPublicKeyCommand({ KeyId: keyId }));
      publicKeyPem = pub.PublicKey
        ? `-----BEGIN PUBLIC KEY-----\n${Buffer.from(pub.PublicKey).toString("base64")}\n-----END PUBLIC KEY-----`
        : undefined;
    }
    return {
      source: "kms",
      keyId,
      algorithm: signRes.SigningAlgorithm,
      signature: Buffer.from(signRes.Signature).toString("base64"),
      publicKeyPem,
    };
  }

  if (mode === "dev" || mode === "local") {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
    const signature = crypto.sign(null, payloadBytes, privateKey);
    return {
      source: "dev-ephemeral",
      keyId: "dev-ephemeral",
      algorithm: "Ed25519",
      signature: signature.toString("base64"),
      publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
      warning: "Dev-only ephemeral key — use VRP_KMS_KEY_ID in production",
    };
  }

  throw new Error(`VRP signing misconfigured: set VRP_KMS_KEY_ID or VRP_SIGNING_MODE=dev`);
}

function proofValidityWindow(issuedAtIso, ttlSec = DEFAULT_TTL_SEC) {
  const notBefore = issuedAtIso;
  const notAfter = new Date(new Date(issuedAtIso).getTime() + ttlSec * 1000).toISOString();
  return { not_before: notBefore, not_after: notAfter, ttl_sec: ttlSec };
}

module.exports = { signProofPayload, proofValidityWindow, DEFAULT_TTL_SEC };
