variable "name_prefix" {
  type    = string
  default = "cognimesh-prod"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "default_admin_email" {
  type        = string
  description = "Admin-created default Cognito user (self-registration disabled)"
}

variable "portal_callback_urls" {
  type    = list(string)
  default = ["http://localhost:3000/"]
}

variable "portal_logout_urls" {
  type    = list(string)
  default = ["http://localhost:3000/"]
}

variable "portal_cloudfront_callback_url" {
  type        = string
  default     = ""
  description = "After first apply: https://YOUR_DIST.cloudfront.net/ (also set portal_cloudfront_logout_url). CORS uses .cloudfront.net suffix automatically."
}

variable "portal_cloudfront_logout_url" {
  type    = string
  default = ""
}

variable "checkpoint_bucket_name" {
  type = string
}

variable "proof_bucket_name" {
  type = string
}

variable "lakehouse_bucket_name" {
  type = string
}

variable "bronze_bucket_name" {
  type = string
}

variable "silver_bucket_name" {
  type = string
}

variable "gold_bucket_name" {
  type = string
}

variable "glue_database_name" {
  type    = string
  default = "cognimesh_mesh"
}

variable "consumer_principal_arn" {
  type        = string
  description = "IAM principal for Lake Formation consumer SELECT"
}

variable "enable_step_functions" {
  type    = bool
  default = true
}

variable "enable_lake_formation_governance" {
  type    = bool
  default = true
}

variable "enable_cognito" {
  type    = bool
  default = true
}

variable "enable_integrity_gate_lambda" {
  type    = bool
  default = true
}

variable "portal_bucket_name" {
  type = string
}

variable "enable_eks" {
  type        = bool
  default     = false
  description = "EKS for cognitive Go runtime only; keep false unless using agentic pipelines."
}

variable "enable_portal_cdn" {
  type    = bool
  default = true
}

variable "enable_waf" {
  type        = bool
  default     = true
  description = "AWS WAF on CloudFront portal (managed OWASP + rate limit). Adds monthly cost."
}

variable "waf_rate_limit" {
  type    = number
  default = 2000
}

variable "enable_api_service" {
  type        = bool
  default     = true
  description = "ECS Fargate + ALB hosting cognimesh-api (requires enable_platform_ops)."
}

variable "api_container_image" {
  type        = string
  default     = "ghcr.io/vaquarkhan/cognimesh-api:1.0.0"
  description = "GHCR cognimesh-api tag. CORS_ORIGIN_SUFFIXES requires image >=1.0.1 (commit 84cbf15+). On 1.0.0, set portal_cloudfront_callback_url so CORS_ORIGINS includes the CloudFront origin."
}

variable "api_desired_count" {
  type    = number
  default = 2
}

variable "cognito_mfa_configuration" {
  type        = string
  default     = "ON"
  description = "Cognito MFA: ON (required), OPTIONAL, or OFF."
}

variable "enable_kms_for_sensitive_buckets" {
  type    = bool
  default = true
}

variable "enable_security_logging" {
  type    = bool
  default = true
}

variable "enable_cloudtrail" {
  type    = bool
  default = true
}

variable "enable_guardduty" {
  type    = bool
  default = true
}

variable "enable_config" {
  type    = bool
  default = true
}

variable "enable_platform_ops" {
  type        = bool
  default     = true
  description = "DynamoDB platform state, Athena workgroup, Bedrock/RDS Data API IAM for API gateway"
}

variable "enable_observability" {
  type        = bool
  default     = true
  description = "CloudWatch dashboard + alarms for API/ECS/WAF/EMF metrics."
}

variable "ops_alert_email" {
  type        = string
  default     = ""
  description = "Optional email for CloudWatch alarm SNS (requires confirmation click)."
}
