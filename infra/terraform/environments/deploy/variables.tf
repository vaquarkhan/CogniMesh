variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region to deploy into. User sets this to any region."
}

variable "name_prefix" {
  type        = string
  default     = "cognimesh"
  description = "Prefix for all resource names. Keep short (used in S3, ECS, Lambda names)."
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "checkpoint_bucket_name" {
  type        = string
  default     = "cognimesh-checkpoints"
  description = "S3 bucket for PVDM checkpoints. Must be globally unique — add account ID suffix."
}

variable "proof_bucket_name" {
  type    = string
  default = "cognimesh-proofs"
}

variable "lakehouse_bucket_name" {
  type    = string
  default = "cognimesh-lakehouse"
}

variable "bronze_bucket_name" {
  type    = string
  default = "cognimesh-bronze"
}

variable "silver_bucket_name" {
  type    = string
  default = "cognimesh-silver"
}

variable "gold_bucket_name" {
  type    = string
  default = "cognimesh-gold"
}

variable "portal_bucket_name" {
  type    = string
  default = "cognimesh-portal"
}

variable "api_container_image" {
  type        = string
  default     = ""
  description = "ECR image URI for the API. Leave empty on first deploy — the ECR module creates the repo."
}

variable "api_desired_count" {
  type    = number
  default = 1
}

variable "default_admin_email" {
  type        = string
  default     = "admin@example.com"
  description = "Email for the initial Cognito admin user."
}

variable "glue_database_name" {
  type    = string
  default = "cognimesh"
}
