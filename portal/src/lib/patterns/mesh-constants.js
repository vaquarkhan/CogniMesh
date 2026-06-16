/**
 * Federated data mesh dummy AWS accounts & regions - aligned with Vaquar SDM mesh spec.
 * @see lib/vaquar/contract-to-mesh.js
 * @see https://github.com/vaquarkhan/aws-serverless-datamesh-framework examples/contracts/payments.mesh.pipeline.yaml
 */

/** Producer / steward / publisher roles for a domain data product pipeline */
export const VAQUAR_MESH_ACCOUNTS = {
  producer: "123456789012",
  steward: "234567890123",
  publisher: "345678901234",
};

/** Three parallel domain producers in multi-domain Customer 360 mesh */
export const MESH_DOMAIN_BRANCHES = {
  orders: {
    accountId: "111122223333",
    region: "us-east-1",
    domain: "commerce",
    role: "producer",
    label: "Orders",
  },
  inventory: {
    accountId: "222233334444",
    region: "us-west-2",
    domain: "supply-chain",
    role: "producer",
    label: "Inventory",
  },
  customers: {
    accountId: "333344445555",
    region: "eu-west-1",
    domain: "crm",
    role: "producer",
    label: "Customers",
  },
};

export const MESH_SWIMLANES = [
  { id: "orders", ...MESH_DOMAIN_BRANCHES.orders },
  { id: "inventory", ...MESH_DOMAIN_BRANCHES.inventory },
  { id: "customers", ...MESH_DOMAIN_BRANCHES.customers },
];

export function meshNodeDetail({ accountId, region, domain, role }) {
  const acShort = accountId ? accountId.slice(-4) : "????";
  const parts = [`AC …${acShort}`, region, domain];
  if (role) parts.push(role);
  return parts.join(" · ");
}

export function withMeshContext(data, branchKey, roleOverride) {
  const branch = MESH_DOMAIN_BRANCHES[branchKey];
  if (!branch) return data;
  const role = roleOverride || branch.role;
  return {
    ...data,
    meshBranch: branchKey,
    meshDomain: branch.domain,
    meshAccount: branch.accountId,
    meshRegion: branch.region,
    meshRole: role,
    detail: meshNodeDetail({ ...branch, role }),
  };
}

export function withMeshRole(data, role, region = "us-east-2") {
  const accountId = VAQUAR_MESH_ACCOUNTS[role];
  if (!accountId) return data;
  return {
    ...data,
    meshAccount: accountId,
    meshRegion: region,
    meshRole: role,
    detail: meshNodeDetail({ accountId, region, domain: data.meshDomain || role, role }),
  };
}

export function meshAccountsForPipelineMeta(extra = {}) {
  return {
    meshAccounts: { ...VAQUAR_MESH_ACCOUNTS },
    awsRegion: extra.awsRegion || "us-east-2",
    enableLakeFormation: true,
    ...extra,
  };
}
