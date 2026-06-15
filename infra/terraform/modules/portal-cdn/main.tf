variable "name_prefix" {
  type = string
}

variable "portal_bucket_name" {
  type = string
}

variable "domain_name" {
  type    = string
  default = ""
}

variable "tags" {
  type    = map(string)
  default = {}
}

resource "aws_s3_bucket" "portal" {
  bucket = var.portal_bucket_name
  tags   = merge(var.tags, { Component = "portal-static" })
}

resource "aws_s3_bucket_public_access_block" "portal" {
  bucket = aws_s3_bucket.portal.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "portal" {
  bucket = aws_s3_bucket.portal.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_cloudfront_origin_access_control" "portal" {
  name                              = "${var.name_prefix}-portal-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "portal" {
  enabled             = true
  default_root_object = "index.html"
  comment             = "${var.name_prefix} CogniMesh portal"

  origin {
    domain_name              = aws_s3_bucket.portal.bucket_regional_domain_name
    origin_id                = "portal-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.portal.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "portal-s3"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.domain_name == ""
  }

  tags = merge(var.tags, { Component = "cloudfront" })
}

output "portal_bucket" {
  value = aws_s3_bucket.portal.id
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.portal.domain_name
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.portal.id
}
