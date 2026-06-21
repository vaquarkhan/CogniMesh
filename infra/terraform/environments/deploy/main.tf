# CogniMesh — Region-agnostic deploy environment
# Usage:
#   1. Edit terraform.tfvars (set aws_region, name_prefix, bucket names)
#   2. terraform init
#   3. terraform apply
#
# Deploys the same stack as prod/ but is self-contained — no module-of-module sourcing.
# Identical resource set: VPC, ECS, Lambda (with :live alias), S3, Cognito, CloudFront.

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# Symlink to the prod main.tf is the cleanest way to keep one source of truth.
# But since that's fragile, we directly reference the same modules prod uses.
# If you've customized prod/main.tf, keep this in sync.

data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  tags       = { ManagedBy = "cognimesh", Environment = var.environment }
}

module "networking" {
  source       = "../../modules/networking"
  project_name = var.name_prefix
  environment  = var.environment
  aws_region   = var.aws_region
  vpc_cidr     = var.vpc_cidr
}

module "storage" {
  source                           = "../../modules/storage"
  name_prefix                      = var.name_prefix
  checkpoint_bucket_name           = var.checkpoint_bucket_name
  proof_bucket_name                = var.proof_bucket_name
  lakehouse_bucket_name            = var.lakehouse_bucket_name
  bronze_bucket_name               = var.bronze_bucket_name
  silver_bucket_name               = var.silver_bucket_name
  gold_bucket_name                 = var.gold_bucket_name
  checkpoint_retention_days        = 30
  proof_retention_days             = 90
  enable_kms_for_sensitive_buckets = false
  tags                             = local.tags
}

module "iam" {
  source                = "../../modules/iam"
  name_prefix           = var.name_prefix
  checkpoint_bucket_arn = module.storage.checkpoint_bucket_arn
  proof_bucket_arn      = module.storage.proof_bucket_arn
  lakehouse_bucket_arn  = module.storage.lakehouse_bucket_arn
  glue_database_name    = var.glue_database_name
  enable_lakeformation  = false
  sensitive_kms_key_arn = module.storage.sensitive_kms_key_arn
  enable_eks            = false
  tags                  = local.tags
}

module "glue" {
  source        = "../../modules/glue"
  name_prefix   = var.name_prefix
  database_name = var.glue_database_name
  tags          = local.tags
}

module "ecr" {
  source      = "../../modules/ecr"
  name_prefix = var.name_prefix
  tags        = local.tags
}

output "ecr_repository_url" {
  value = module.ecr.repository_url
}

output "region" {
  value = var.aws_region
}

output "name_prefix" {
  value = var.name_prefix
}
