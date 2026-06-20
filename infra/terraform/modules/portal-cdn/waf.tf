# WAF for CloudFront must be created in us-east-1 (use aws.us_east_1 provider).

resource "aws_wafv2_web_acl" "portal" {
  count    = var.enable_waf ? 1 : 0
  provider = aws.us_east_1

  name  = "${var.name_prefix}-portal-waf"
  scope = "CLOUDFRONT"

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 10
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"

        rule_action_override {
          name = "SizeRestrictions_BODY"
          action_to_use { count {} }
        }
        rule_action_override {
          name = "CrossSiteScripting_BODY"
          action_to_use { count {} }
        }
        rule_action_override {
          name = "GenericRFI_BODY"
          action_to_use { count {} }
        }
        rule_action_override {
          name = "EC2MetaDataSSRF_BODY"
          action_to_use { count {} }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-common"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "RateLimit"
    priority = 20
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-rate"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name_prefix}-portal-waf"
    sampled_requests_enabled   = true
  }

  tags = var.tags
}
