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

variable "tags" {
  type    = map(string)
  default = {}
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

resource "aws_s3_bucket_versioning" "all" {
  for_each = {
    checkpoint = aws_s3_bucket.checkpoint.id
    proof      = aws_s3_bucket.proof.id
    lakehouse  = aws_s3_bucket.lakehouse.id
    bronze     = aws_s3_bucket.bronze.id
    silver     = aws_s3_bucket.silver.id
    gold       = aws_s3_bucket.gold.id
  }
  bucket = each.value
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "all" {
  for_each = aws_s3_bucket_versioning.all
  bucket   = each.value.bucket

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "all" {
  for_each = aws_s3_bucket_versioning.all
  bucket   = each.value.bucket

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
    expiration { days = var.checkpoint_retention_days }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "proof" {
  bucket = aws_s3_bucket.proof.id
  rule {
    id     = "expire-proofs"
    status = "Enabled"
    expiration { days = var.proof_retention_days }
  }
}

output "checkpoint_bucket_arn" { value = aws_s3_bucket.checkpoint.arn }
output "proof_bucket_arn" { value = aws_s3_bucket.proof.arn }
output "lakehouse_bucket_arn" { value = aws_s3_bucket.lakehouse.arn }
output "bronze_bucket" { value = aws_s3_bucket.bronze.id }
output "silver_bucket" { value = aws_s3_bucket.silver.id }
output "gold_bucket" { value = aws_s3_bucket.gold.id }
