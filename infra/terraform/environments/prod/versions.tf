terraform {
  required_version = ">= 1.6.0"

  # Remote state (recommended for prod):
  #   1. Apply infra/terraform/bootstrap/remote-state once
  #   2. Copy backend.hcl.example to backend.hcl and fill values
  #   3. terraform init -backend-config=backend.hcl
  backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}
