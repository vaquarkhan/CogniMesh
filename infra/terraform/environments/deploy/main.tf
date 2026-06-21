# CogniMesh — Single source of truth deploy environment
#
# This is a thin wrapper that sources the full prod config.
# All 17 modules (VPC, ECS, Lambda, Cognito, CloudFront, etc.) are included.
#
# Usage:
#   1. Edit terraform.tfvars (set aws_region + name_prefix at minimum)
#   2. terraform init
#   3. terraform apply
#
# The prod module handles all inter-module wiring. This env just passes variables.

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = ">= 5.0" }
  }
}

provider "aws" {
  region = var.aws_region
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  # Auto-generate bucket names from prefix + account to ensure global uniqueness
  auto_checkpoint = "${var.name_prefix}-checkpoints-${local.account_id}"
  auto_proof      = "${var.name_prefix}-proofs-${local.account_id}"
  auto_lakehouse  = "${var.name_prefix}-lakehouse-${local.account_id}"
  auto_bronze     = "${var.name_prefix}-bronze-${local.account_id}"
  auto_silver     = "${var.name_prefix}-silver-${local.account_id}"
  auto_gold       = "${var.name_prefix}-gold-${local.account_id}"
  auto_portal     = "${var.name_prefix}-portal-${local.account_id}"
}

# ─── Use the FULL prod environment as a module (all 17 modules included) ───
# This ensures deploy/ always has parity with prod/ — no missing modules.
module "cognimesh" {
  source = "../prod"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  aws_region   = var.aws_region
  name_prefix  = var.name_prefix
  environment  = var.environment
  vpc_cidr     = var.vpc_cidr

  # Bucket names: use auto-generated (globally unique) unless overridden
  checkpoint_bucket_name = coalesce(var.checkpoint_bucket_name, local.auto_checkpoint)
  proof_bucket_name      = coalesce(var.proof_bucket_name, local.auto_proof)
  lakehouse_bucket_name  = coalesce(var.lakehouse_bucket_name, local.auto_lakehouse)
  bronze_bucket_name     = coalesce(var.bronze_bucket_name, local.auto_bronze)
  silver_bucket_name     = coalesce(var.silver_bucket_name, local.auto_silver)
  gold_bucket_name       = coalesce(var.gold_bucket_name, local.auto_gold)
  portal_bucket_name     = coalesce(var.portal_bucket_name, local.auto_portal)

  api_container_image = var.api_container_image
  api_desired_count   = var.api_desired_count
  default_admin_email = var.default_admin_email
  glue_database_name  = var.glue_database_name

  # Feature flags — sensible defaults for a full working deploy
  enable_step_functions            = true
  enable_integrity_gate_lambda     = true
  enable_cognito                   = true
  enable_api_service               = true
  enable_portal_cdn                = true
  enable_platform_ops              = true
  enable_waf                       = true
  enable_observability             = true
  enable_lake_formation_governance = false
  enable_eks                       = false
  enable_security_logging          = false
}

# ─── ECR for API image (not in prod module — added here) ───
module "ecr" {
  source      = "../../modules/ecr"
  name_prefix = var.name_prefix
  tags        = { ManagedBy = "cognimesh", Environment = var.environment }
}

# ─── Outputs ───
output "ecr_repository_url" {
  value = module.ecr.repository_url
}

output "region" {
  value = var.aws_region
}

output "name_prefix" {
  value = var.name_prefix
}

output "account_id" {
  value = local.account_id
}
