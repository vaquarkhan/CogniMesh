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

resource "aws_s3_bucket_server_side_encryption_configuration" "portal" {
  bucket = aws_s3_bucket.portal.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_cloudfront_origin_access_control" "portal" {
  name                              = "${var.name_prefix}-portal-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_iam_policy_document" "portal_oac" {
  statement {
    sid    = "AllowCloudFrontRead"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.portal.arn}/*"]
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.portal.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "portal" {
  bucket = aws_s3_bucket.portal.id
  policy = data.aws_iam_policy_document.portal_oac.json
}

resource "aws_cloudfront_distribution" "portal" {
  enabled             = true
  default_root_object = "index.html"
  comment             = "${var.name_prefix} CogniMesh portal"
  web_acl_id          = var.enable_waf ? aws_wafv2_web_acl.portal[0].arn : null

  origin {
    domain_name              = aws_s3_bucket.portal.bucket_regional_domain_name
    origin_id                = "portal-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.portal.id
  }

  dynamic "origin" {
    for_each = var.api_origin_domain != "" ? [1] : []
    content {
      domain_name = var.api_origin_domain
      origin_id   = "api-alb"

      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "http-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "portal-s3"
    viewer_protocol_policy     = "redirect-to-https"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.portal_security.id

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  dynamic "ordered_cache_behavior" {
    for_each = var.api_origin_domain != "" ? [1] : []
    content {
      path_pattern           = "/api/*"
      allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
      cached_methods         = ["GET", "HEAD"]
      target_origin_id       = "api-alb"
      viewer_protocol_policy = "redirect-to-https"
      response_headers_policy_id = aws_cloudfront_response_headers_policy.portal_security.id

      forwarded_values {
        query_string = true
        headers      = ["Authorization", "Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]
        cookies { forward = "all" }
      }

      min_ttl     = 0
      default_ttl = 0
      max_ttl     = 0
    }
  }

  dynamic "ordered_cache_behavior" {
    for_each = var.api_origin_domain != "" ? toset(["/health", "/metrics", "/api/health", "/api/metrics"]) : toset([])
    content {
      path_pattern           = ordered_cache_behavior.value
      allowed_methods        = ["GET", "HEAD", "OPTIONS"]
      cached_methods         = ["GET", "HEAD"]
      target_origin_id       = "api-alb"
      viewer_protocol_policy = "redirect-to-https"
      response_headers_policy_id = aws_cloudfront_response_headers_policy.portal_security.id

      forwarded_values {
        query_string = false
        headers      = ["Authorization", "Origin"]
        cookies { forward = "none" }
      }

      min_ttl     = 0
      default_ttl = 0
      max_ttl     = 0
    }
  }

  # SPA fallback for S3 only — do NOT map 403→index.html (breaks API error passthrough on /api/*).
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
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

output "cloudfront_url" {
  value = "https://${aws_cloudfront_distribution.portal.domain_name}"
}

output "waf_enabled" {
  value = var.enable_waf
}

output "waf_web_acl_name" {
  value = try(aws_wafv2_web_acl.portal[0].name, null)
}
