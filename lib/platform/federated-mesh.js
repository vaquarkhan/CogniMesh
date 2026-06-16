"use strict";

const { listProducts } = require("../catalog-client");
const { listPending } = require("../access-requests");

const federatedOrgs = [
  { orgId: "org-commerce", name: "Commerce Domain", accountId: "111122223333", region: "us-east-1" },
  { orgId: "org-supply", name: "Supply Chain", accountId: "222233334444", region: "us-west-2" },
  { orgId: "org-crm", name: "CRM Publisher", accountId: "333344445555", region: "eu-west-1" },
];

async function listFederatedProducts(auth) {
  const local = await listProducts(undefined, auth || {});
  const products = (local.products || []).map((p) => ({
    ...p,
    federation: { scope: "local", orgId: "local" },
  }));

  for (const org of federatedOrgs) {
    products.push({
      id: `fed-${org.orgId}-customer-360`,
      name: "customer-360-federated",
      domain: org.orgId.replace("org-", ""),
      version: "1.0.0",
      description: `Federated product from ${org.name}`,
      federation: {
        scope: "cross-org",
        orgId: org.orgId,
        accountId: org.accountId,
        region: org.region,
        discovery: "cognimesh-mesh-registry",
      },
    });
  }

  return {
    organizations: federatedOrgs,
    products,
    pendingCrossOrgRequests: listPending().filter((r) => r.federation),
  };
}

module.exports = { listFederatedProducts, federatedOrgs };
