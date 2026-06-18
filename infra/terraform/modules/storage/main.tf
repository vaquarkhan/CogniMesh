variable "name_prefix" {
  type = string
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

variable "checkpoint_retention_days" {
  type    = number
  default = 30
}

variable "proof_retention_days" {
  type    = number
  default = 90
}

variable "enable_kms_for_sensitive_buckets" {
  type        = bool
  default     = true
  description = "Use customer-managed KMS for checkpoint + proof buckets (tamper-evidence posture)."
}

variable "tags" {
  type    = map(string)
  default = {}
}

data "aws_caller_identity" "current" {}

resource "aws_kms_key" "sensitive_data" {
  count                   = var.enable_kms_for_sensitive_buckets ? 1 : 0
  description             = "${var.name_prefix} checkpoint/proof encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  tags                    = merge(var.tags, { Component = "kms-sensitive" })
}

resource "aws_kms_alias" "sensitive_data" {
  count         = var.enable_kms_for_sensitive_buckets ? 1 : 0
  name          = "alias/${var.name_prefix}-sensitive-data"
  target_key_id = aws_kms_key.sensitive_data[0].key_id
}

resource "aws_s3_bucket" "checkpoint" {
  bucket = var.checkpoint_bucket_name
  tags   = merge(var.tags, { Layer = "checkpoint", Component = "storage" })
}

resource "aws_s3_bucket" "proof" {
  bucket = var.proof_bucket_name
  tags   = merge(var.tags, { Layer = "proof", Component = "storage" })
}

resource "aws_s3_bucket" "lakehouse" {
  bucket = var.lakehouse_bucket_name
  tags   = merge(var.tags, { Layer = "lakehouse", Component = "storage" })
}

resource "aws_s3_bucket" "bronze" {
  bucket = var.bronze_bucket_name
  tags   = merge(var.tags, { Layer = "bronze" })
}

resource "aws_s3_bucket" "silver" {
  bucket = var.silver_bucket_name
  tags   = merge(var.tags, { Layer = "silver" })
}

resource "aws_s3_bucket" "gold" {
  bucket = var.gold_bucket_name
  tags   = merge(var.tags, { Layer = "gold" })
}

locals {
  bucket_ids = {
    checkpoint = aws_s3_bucket.checkpoint.id
    proof      = aws_s3_bucket.proof.id
    lakehouse  = aws_s3_bucket.lakehouse.id
    bronze     = aws_s3_bucket.bronze.id
    silver     = aws_s3_bucket.silver.id
    gold       = aws_s3_bucket.gold.id
  }
  kms_buckets = var.enable_kms_for_sensitive_buckets ? toset(["checkpoint", "proof", "gold"]) : toset([])
  aes_buckets = toset(["checkpoint", "proof", "lakehouse", "bronze", "silver", "gold"])
}

resource "aws_s3_bucket_versioning" "all" {
  for_each = local.aes_buckets
  bucket   = local.bucket_ids[each.key]
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "kms" {
  for_each = local.kms_buckets
  bucket   = local.bucket_ids[each.key]

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.sensitive_data[0].arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "aes" {
  for_each = var.enable_kms_for_sensitive_buckets ? toset(["lakehouse", "bronze", "silver"]) : local.aes_buckets
  bucket   = local.bucket_ids[each.key]

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "all" {
  for_each = local.aes_buckets
  bucket   = local.bucket_ids[each.key]

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "checkpoint" {
  bucket = aws_s3_bucket.checkpoint.id
  rule {
    id     = "expire-checkpoints"
    status = "Enabled"
    filter {}
    expiration { days = var.checkpoint_retention_days }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "proof" {
  bucket = aws_s3_bucket.proof.id
  rule {
    id     = "expire-proofs"
    status = "Enabled"
    filter {}
    expiration { days = var.proof_retention_days }
  }
}

output "checkpoint_bucket_arn" { value = aws_s3_bucket.checkpoint.arn }
output "proof_bucket_arn" { value = aws_s3_bucket.proof.arn }
output "lakehouse_bucket_arn" { value = aws_s3_bucket.lakehouse.arn }
output "bronze_bucket" { value = aws_s3_bucket.bronze.id }
output "silver_bucket" { value = aws_s3_bucket.silver.id }
output "gold_bucket" { value = aws_s3_bucket.gold.id }
output "sensitive_kms_key_arn" {
  value = try(aws_kms_key.sensitive_data[0].arn, null)
}
