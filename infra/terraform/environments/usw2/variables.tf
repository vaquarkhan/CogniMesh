variable "aws_region" { type = string default = "us-west-2" }
variable "name_prefix" { type = string default = "cognimesh-usw2" }
variable "environment" { type = string default = "prod" }
variable "vpc_cidr" { type = string default = "10.1.0.0/16" }
variable "checkpoint_bucket_name" { type = string }
variable "proof_bucket_name" { type = string }
variable "lakehouse_bucket_name" { type = string }
variable "bronze_bucket_name" { type = string }
variable "silver_bucket_name" { type = string }
variable "gold_bucket_name" { type = string }
variable "portal_bucket_name" { type = string }
variable "api_container_image" { type = string }
variable "api_desired_count" { type = number default = 1 }
variable "default_admin_email" { type = string }
variable "glue_database_name" { type = string default = "cognimesh_usw2" }
