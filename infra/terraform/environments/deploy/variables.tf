# ─── Required: set these two ───
variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region. Set to any region you want."
}

variable "name_prefix" {
  type        = string
  default     = "cognimesh"
  description = "Prefix for all resources. Keep short."
}

# ─── Optional: override if you want custom names ───
variable "environment" {
  type    = string
  default = "prod"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

# Bucket names default to "" — main.tf auto-generates from prefix+account_id
variable "checkpoint_bucket_name" { type = string; default = "" }
variable "proof_bucket_name" { type = string; default = "" }
variable "lakehouse_bucket_name" { type = string; default = "" }
variable "bronze_bucket_name" { type = string; default = "" }
variable "silver_bucket_name" { type = string; default = "" }
variable "gold_bucket_name" { type = string; default = "" }
variable "portal_bucket_name" { type = string; default = "" }

variable "api_container_image" {
  type        = string
  default     = ""
  description = "ECR URI. Leave empty on first deploy — set after ECR push."
}

variable "api_desired_count" {
  type    = number
  default = 1
}

variable "default_admin_email" {
  type        = string
  default     = "admin@example.com"
  description = "Cognito admin user email."
}

variable "glue_database_name" {
  type    = string
  default = "cognimesh"
}
