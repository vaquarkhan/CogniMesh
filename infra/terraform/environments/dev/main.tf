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
