# Override: use local backend for fresh clones / dev deploys.
# Terraform merges this into versions.tf, replacing the S3 backend.
#
# For production with remote state:
#   1. Delete this file
#   2. terraform init -backend-config=backend.hcl -reconfigure
#
# This file is gitignored for prod; committed for turnkey dev experience.

terraform {
  backend "local" {}
}
