locals {
  account_id = data.aws_caller_identity.current.account_id
  tags = {
    Domain = "platform"
  }
  # Include portal_cloudfront_url in portal_callback_urls after first apply (updates Cognito + API CORS).
  api_cors_origins = distinct(compact(var.portal_callback_urls))
  api_environment = {
    NODE_ENV               = "production"
    ENABLE_EMF_METRICS     = "true"
    CORS_ORIGIN_SUFFIXES   = ".cloudfront.net"
    AWS_REGION             = var.aws_region
    CATALOG_STORAGE           = "memory"
    CATALOG_FALLBACK          = "embedded"
    COGNITO_USER_POOL_ID      = try(module.cognito[0].user_pool_id, "")
    COGNITO_CLIENT_ID         = try(module.cognito[0].client_id, "")
    PLATFORM_STORE            = try(module.platform_ops[0].platform_env.PLATFORM_STORE, "file")
    PLATFORM_DYNAMODB_TABLE   = try(module.platform_ops[0].platform_env.PLATFORM_DYNAMODB_TABLE, "")
    ATHENA_WORKGROUP          = try(module.platform_ops[0].platform_env.ATHENA_WORKGROUP, "")
    ATHENA_OUTPUT_LOCATION    = try(module.platform_ops[0].platform_env.ATHENA_OUTPUT_LOCATION, "")
    AWS_BEDROCK_AGENT_ROLE_ARN = try(module.platform_ops[0].platform_env.AWS_BEDROCK_AGENT_ROLE_ARN, "")
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

  name_prefix                      = var.name_prefix
  checkpoint_bucket_name           = var.checkpoint_bucket_name
  proof_bucket_name                = var.proof_bucket_name
  lakehouse_bucket_name            = var.lakehouse_bucket_name
  bronze_bucket_name               = var.bronze_bucket_name
  silver_bucket_name               = var.silver_bucket_name
  gold_bucket_name                 = var.gold_bucket_name
  checkpoint_retention_days        = 30
  proof_retention_days             = 90
  enable_kms_for_sensitive_buckets = var.enable_kms_for_sensitive_buckets
  tags                             = local.tags
}

module "security_logging" {
  count  = var.enable_security_logging ? 1 : 0
  source = "../../modules/security-logging"

  name_prefix       = var.name_prefix
  enable_cloudtrail = var.enable_cloudtrail
  enable_guardduty  = var.enable_guardduty
  enable_config     = var.enable_config
  tags              = local.tags
}

module "messaging" {
  source = "../../modules/messaging"

  name_prefix = var.name_prefix
  tags        = local.tags
}

module "iam" {
  source = "../../modules/iam"

  name_prefix           = var.name_prefix
  checkpoint_bucket_arn = module.storage.checkpoint_bucket_arn
  proof_bucket_arn      = module.storage.proof_bucket_arn
  lakehouse_bucket_arn  = module.storage.lakehouse_bucket_arn
  glue_database_name    = var.glue_database_name
  enable_lakeformation  = var.enable_lake_formation_governance
  sensitive_kms_key_arn = module.storage.sensitive_kms_key_arn
  enable_eks            = var.enable_eks
  tags                  = local.tags
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

  name_prefix              = var.name_prefix
  default_admin_email      = var.default_admin_email
  portal_callback_urls     = var.portal_callback_urls
  portal_logout_urls       = var.portal_logout_urls
  additional_callback_urls = compact([var.portal_cloudfront_callback_url])
  additional_logout_urls   = compact([var.portal_cloudfront_logout_url])
  mfa_configuration        = var.cognito_mfa_configuration
  tags                     = local.tags
}

module "integrity_gate_lambda" {
  count  = var.enable_integrity_gate_lambda ? 1 : 0
  source = "../../modules/lambda"

  name_prefix      = var.name_prefix
  function_suffix  = "integrity-gate"
  role_arn         = module.iam.domain_writer_role_arn
  package_path     = abspath("${path.module}/${data.external.integrity_gate_package.result.path}")
  source_code_hash = data.external.integrity_gate_package.result.hash
  handler          = "handler.handler"
  tags             = local.tags
}

module "domain_writer_lambda" {
  count  = var.enable_integrity_gate_lambda ? 1 : 0
  source = "../../modules/lambda"

  name_prefix      = var.name_prefix
  function_suffix  = "domain-writer"
  role_arn         = module.iam.domain_writer_role_arn
  package_path     = abspath("${path.module}/${data.external.domain_writer_package.result.path}")
  source_code_hash = data.external.domain_writer_package.result.hash
  handler          = "handler.handler"
  timeout          = 120
  memory_size      = 512
  tags             = merge(local.tags, { Component = "domain-writer" })
}

module "eks" {
  count  = var.enable_eks ? 1 : 0
  source = "../../modules/eks"

  name_prefix        = var.name_prefix
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  tags               = local.tags
}

module "platform_ops" {
  count  = var.enable_platform_ops ? 1 : 0
  source = "../../modules/platform-ops"

  name_prefix           = var.name_prefix
  lakehouse_bucket_arn  = module.storage.lakehouse_bucket_arn
  lakehouse_bucket_name = var.lakehouse_bucket_name
  glue_database_name    = var.glue_database_name
  tags                  = local.tags
}

module "api_service" {
  count  = var.enable_api_service && var.enable_platform_ops ? 1 : 0
  source = "../../modules/api-service"

  name_prefix        = var.name_prefix
  vpc_id             = module.networking.vpc_id
  public_subnet_ids  = module.networking.public_subnet_ids
  private_subnet_ids = module.networking.private_subnet_ids
  container_image    = var.api_container_image
  task_role_arn      = module.platform_ops[0].api_platform_role_arn
  environment        = local.api_environment
  cors_origins       = local.api_cors_origins
  desired_count      = var.api_desired_count
  enable_waf         = var.enable_waf
  waf_rate_limit     = var.waf_rate_limit
  tags               = local.tags

  depends_on = [module.platform_ops]
}

module "portal_cdn" {
  count  = var.enable_portal_cdn ? 1 : 0
  source = "../../modules/portal-cdn"

  providers = {
    aws.us_east_1 = aws.us_east_1
  }

  name_prefix         = var.name_prefix
  portal_bucket_name  = var.portal_bucket_name
  enable_waf          = var.enable_waf
  waf_rate_limit      = var.waf_rate_limit
  api_origin_domain   = try(module.api_service[0].api_alb_dns, "")
  tags                = local.tags

  depends_on = [module.api_service]
}

module "observability" {
  count  = var.enable_observability ? 1 : 0
  source = "../../modules/observability"

  name_prefix               = var.name_prefix
  aws_region                = var.aws_region
  alb_arn_suffix            = try(module.api_service[0].alb_arn_suffix, "")
  target_group_arn_suffix   = try(module.api_service[0].target_group_arn_suffix, "")
  ecs_cluster_name          = try(module.api_service[0].ecs_cluster_name, "")
  ecs_service_name          = try(module.api_service[0].ecs_service_name, "")
  api_desired_count         = var.api_desired_count
  enable_waf_alarms         = var.enable_waf
  waf_web_acl_name          = coalesce(try(module.api_service[0].waf_web_acl_name, null), try(module.portal_cdn[0].waf_web_acl_name, null), "")
  alert_email               = var.ops_alert_email
  tags                      = local.tags

  depends_on = [module.api_service, module.portal_cdn]
}
