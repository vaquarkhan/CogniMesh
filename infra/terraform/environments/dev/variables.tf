variable "project_name" {
  type    = string
  default = "cognimesh"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "enable_pvdm_lambdas" {
  type        = bool
  default     = true
  description = "Deploy integrity-gate and domain-writer Lambdas for Vaquar PVDM pipelines"
}

variable "enable_platform_ops" {
  type        = bool
  default     = true
  description = "Platform ops DynamoDB, Athena, Bedrock agent IAM role"
}
