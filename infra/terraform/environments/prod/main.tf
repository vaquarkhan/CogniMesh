locals {
  account_id = data.aws_caller_identity.current.account_id
  tags = {
    Domain = "platform"
  }
}

data "aws_caller_identity" "current" {}

module "networking" {
  source = "../../modules/networking"

  project_name = var.name_prefix
  environment  = var.environment
  aws_region   = var.aws_region
  vpc_cidr     = var.vpc_cidr
}

module "storage" {
  source = "../../modules/storage"

  name_prefix             = var.name_prefix
  checkpoint_bucket_name  = var.checkpoint_bucket_name
  proof_bucket_name       = var.proof_bucket_name
  lakehouse_bucket_name   = var.lakehouse_bucket_name
  bronze_bucket_name      = var.bronze_bucket_name
  silver_bucket_name      = var.silver_bucket_name
  gold_bucket_name        = var.gold_bucket_name
  checkpoint_retention_days = 30
  proof_retention_days      = 90
  tags                    = local.tags
}

module "messaging" {
  source = "../../modules/messaging"

  name_prefix = var.name_prefix
  tags        = local.tags
}

module "iam" {
  source = "../../modules/iam"

  name_prefix            = var.name_prefix
  checkpoint_bucket_arn  = module.storage.checkpoint_bucket_arn
  proof_bucket_arn       = module.storage.proof_bucket_arn
  lakehouse_bucket_arn   = module.storage.lakehouse_bucket_arn
  glue_database_name     = var.glue_database_name
  enable_lakeformation   = var.enable_lake_formation_governance
  tags                   = local.tags
}

module "glue" {
  source = "../../modules/glue"

  name_prefix   = var.name_prefix
  database_name = var.glue_database_name
  tags          = local.tags
}

module "dynamodb" {
  source = "../../modules/dynamodb"

  name_prefix = var.name_prefix
  tags        = local.tags
}

module "orchestration" {
  count  = var.enable_step_functions ? 1 : 0
  source = "../../modules/orchestration"

  name_prefix = var.name_prefix
  role_arn    = module.iam.pipeline_orchestrator_role_arn
  tags        = local.tags
}

module "governance" {
  count  = var.enable_lake_formation_governance ? 1 : 0
  source = "../../modules/governance"

  name_prefix            = var.name_prefix
  consumer_principal_arn = var.consumer_principal_arn
  database_name          = var.glue_database_name
  table_name             = "portal_output"
  steward_role_name      = module.iam.domain_writer_role_name
  tags                   = local.tags
}

module "cognito" {
  count  = var.enable_cognito ? 1 : 0
  source = "../../modules/cognito"

  name_prefix          = var.name_prefix
  default_admin_email  = var.default_admin_email
  portal_callback_urls = var.portal_callback_urls
  portal_logout_urls   = var.portal_logout_urls
  tags                 = local.tags
}

module "integrity_gate_lambda" {
  count  = var.enable_integrity_gate_lambda ? 1 : 0
  source = "../../modules/lambda"

  name_prefix       = var.name_prefix
  function_suffix   = "integrity-gate"
  role_arn          = module.iam.domain_writer_role_arn
  package_path      = abspath("${path.module}/${data.external.integrity_gate_package.result.path}")
  source_code_hash  = data.external.integrity_gate_package.result.hash
  handler           = "handler.handler"
  tags              = local.tags
}

module "domain_writer_lambda" {
  count  = var.enable_integrity_gate_lambda ? 1 : 0
  source = "../../modules/lambda"

  name_prefix       = var.name_prefix
  function_suffix   = "domain-writer"
  role_arn          = module.iam.domain_writer_role_arn
  package_path      = abspath("${path.module}/${data.external.domain_writer_package.result.path}")
  source_code_hash  = data.external.domain_writer_package.result.hash
  handler           = "handler.handler"
  timeout           = 120
  memory_size       = 512
  tags              = merge(local.tags, { Component = "domain-writer" })
}

module "eks" {
  count  = var.enable_eks ? 1 : 0
  source = "../../modules/eks"

  name_prefix         = var.name_prefix
  vpc_id              = module.networking.vpc_id
  private_subnet_ids  = module.networking.private_subnet_ids
  tags                = local.tags
}

module "portal_cdn" {
  count  = var.enable_portal_cdn ? 1 : 0
  source = "../../modules/portal-cdn"

  name_prefix        = var.name_prefix
  portal_bucket_name = var.portal_bucket_name
  tags               = local.tags
}
