terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "cognimesh"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  tags       = { Domain = "dev" }
}

module "networking" {
  source       = "../../modules/networking"
  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region
  vpc_cidr     = var.vpc_cidr
}

module "storage" {
  source = "../../modules/storage"

  name_prefix            = "${var.project_name}-${var.environment}"
  checkpoint_bucket_name = "${var.project_name}-${var.environment}-checkpoints-${local.account_id}"
  proof_bucket_name      = "${var.project_name}-${var.environment}-proofs-${local.account_id}"
  lakehouse_bucket_name  = "${var.project_name}-${var.environment}-lakehouse-${local.account_id}"
  bronze_bucket_name     = "${var.project_name}-${var.environment}-bronze-${local.account_id}"
  silver_bucket_name     = "${var.project_name}-${var.environment}-silver-${local.account_id}"
  gold_bucket_name       = "${var.project_name}-${var.environment}-gold-${local.account_id}"
  tags                   = local.tags
}

module "glue" {
  source        = "../../modules/glue"
  name_prefix   = "${var.project_name}-${var.environment}"
  database_name = "cognimesh_dev"
  tags          = local.tags
}

module "dynamodb" {
  source      = "../../modules/dynamodb"
  name_prefix = "${var.project_name}-${var.environment}"
  tags        = local.tags
}

module "iam" {
  source = "../../modules/iam"

  name_prefix           = "${var.project_name}-${var.environment}"
  checkpoint_bucket_arn = module.storage.checkpoint_bucket_arn
  proof_bucket_arn      = module.storage.proof_bucket_arn
  lakehouse_bucket_arn  = module.storage.lakehouse_bucket_arn
  glue_database_name    = module.glue.database_name
  enable_lakeformation  = false
  tags                  = local.tags
}

module "orchestration" {
  count  = var.enable_pvdm_lambdas ? 1 : 0
  source = "../../modules/orchestration"

  name_prefix = "${var.project_name}-${var.environment}"
  role_arn    = module.iam.pipeline_orchestrator_role_arn
  tags        = local.tags
}

module "integrity_gate_lambda" {
  count  = var.enable_pvdm_lambdas ? 1 : 0
  source = "../../modules/lambda"

  name_prefix      = "${var.project_name}-${var.environment}"
  function_suffix  = "integrity-gate"
  role_arn         = module.iam.domain_writer_role_arn
  package_path     = abspath("${path.module}/${data.external.integrity_gate_package.result.path}")
  source_code_hash = data.external.integrity_gate_package.result.hash
  handler          = "handler.handler"
  tags             = local.tags
}

module "domain_writer_lambda" {
  count  = var.enable_pvdm_lambdas ? 1 : 0
  source = "../../modules/lambda"

  name_prefix      = "${var.project_name}-${var.environment}"
  function_suffix  = "domain-writer"
  role_arn         = module.iam.domain_writer_role_arn
  package_path     = abspath("${path.module}/${data.external.domain_writer_package.result.path}")
  source_code_hash = data.external.domain_writer_package.result.hash
  handler          = "handler.handler"
  timeout          = 120
  memory_size      = 512
  tags             = merge(local.tags, { Component = "domain-writer" })
}

module "platform_ops" {
  count  = var.enable_platform_ops ? 1 : 0
  source = "../../modules/platform-ops"

  name_prefix           = "${var.project_name}-${var.environment}"
  lakehouse_bucket_arn  = module.storage.lakehouse_bucket_arn
  lakehouse_bucket_name = "${var.project_name}-${var.environment}-lakehouse-${local.account_id}"
  glue_database_name    = module.glue.database_name
  tags                  = local.tags
}

output "vpc_id" {
  value = module.networking.vpc_id
}

output "gold_bucket" {
  value = module.storage.gold_bucket
}

output "glue_database" {
  value = module.glue.database_name
}

output "catalog_table" {
  value = module.dynamodb.table_name
}

output "pipeline_orchestrator_role_arn" {
  value = module.iam.pipeline_orchestrator_role_arn
}

output "checkpoint_bucket" {
  value = module.storage.checkpoint_bucket_arn
}

output "proof_bucket" {
  value = module.storage.proof_bucket_arn
}

output "bedrock_agent_role_arn" {
  value = var.enable_platform_ops ? module.platform_ops[0].bedrock_agent_role_arn : null
}

output "platform_env" {
  value = var.enable_platform_ops ? module.platform_ops[0].platform_env : {}
}

output "aws_deploy_env" {
  description = "Copy into .env for live Step Functions deploy from the portal"
  value = {
    AWS_DEPLOY_ENABLED          = "true"
    AWS_AGENT_DEPLOY_ENABLED    = var.enable_platform_ops ? "true" : "false"
    AWS_BEDROCK_AGENT_ROLE_ARN  = var.enable_platform_ops ? module.platform_ops[0].bedrock_agent_role_arn : null
    AWS_REGION                  = var.aws_region
    AWS_STEP_FUNCTIONS_ROLE_ARN = module.iam.pipeline_orchestrator_role_arn
    CHECKPOINT_BUCKET_NAME      = "${var.project_name}-${var.environment}-checkpoints-${local.account_id}"
    PROOF_BUCKET_NAME           = "${var.project_name}-${var.environment}-proofs-${local.account_id}"
    VAQUAR_DOMAIN_WRITER_ARN    = var.enable_pvdm_lambdas ? module.domain_writer_lambda[0].function_arn : null
    INTEGRITY_GATE_FUNCTION     = var.enable_pvdm_lambdas ? module.integrity_gate_lambda[0].function_name : null
  }
}
