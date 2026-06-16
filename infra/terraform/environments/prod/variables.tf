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
  type    = bool
  default = true
}

variable "enable_portal_cdn" {
  type    = bool
  default = true
}

variable "enable_platform_ops" {
  type        = bool
  default     = true
  description = "DynamoDB platform state, Athena workgroup, Bedrock/RDS Data API IAM for API gateway"
}
