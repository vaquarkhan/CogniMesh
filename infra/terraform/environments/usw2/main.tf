# CogniMesh us-west-2 environment
# Usage: terraform init && terraform apply

module "cognimesh" {
  source = "../../environments/prod"

  # Override for us-west-2
  aws_region   = var.aws_region
  name_prefix  = var.name_prefix
  environment  = var.environment
  vpc_cidr     = var.vpc_cidr

  checkpoint_bucket_name = var.checkpoint_bucket_name
  proof_bucket_name      = var.proof_bucket_name
  lakehouse_bucket_name  = var.lakehouse_bucket_name
  bronze_bucket_name     = var.bronze_bucket_name
  silver_bucket_name     = var.silver_bucket_name
  gold_bucket_name       = var.gold_bucket_name
  portal_bucket_name     = var.portal_bucket_name

  api_container_image    = var.api_container_image
  api_desired_count      = var.api_desired_count
  default_admin_email    = var.default_admin_email
  glue_database_name     = var.glue_database_name

  enable_step_functions             = true
  enable_integrity_gate_lambda      = true
  enable_cognito                    = true
  enable_api_service                = true
  enable_portal_cdn                 = true
  enable_platform_ops               = true
  enable_waf                        = true
  enable_lake_formation_governance  = false
  enable_eks                        = false
  enable_observability              = true
  enable_security_logging           = false
}
