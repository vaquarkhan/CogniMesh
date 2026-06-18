/** Common AWS regions for deploy / infrastructure export. */
export const AWS_REGIONS = [
  { id: "us-east-1", label: "US East (N. Virginia)" },
  { id: "us-east-2", label: "US East (Ohio)" },
  { id: "us-west-1", label: "US West (N. California)" },
  { id: "us-west-2", label: "US West (Oregon)" },
  { id: "eu-west-1", label: "Europe (Ireland)" },
  { id: "eu-west-2", label: "Europe (London)" },
  { id: "eu-central-1", label: "Europe (Frankfurt)" },
  { id: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { id: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
  { id: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
];

export const DEFAULT_AWS_REGION = "us-east-1";

export function regionLabel(regionId) {
  return AWS_REGIONS.find((r) => r.id === regionId)?.label || regionId;
}
