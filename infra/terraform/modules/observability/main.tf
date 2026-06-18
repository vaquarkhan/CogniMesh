variable "name_prefix" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "alb_arn_suffix" {
  type        = string
  default     = ""
  description = "ALB ARN suffix for CloudWatch metrics (module.api_service output)."
}

variable "target_group_arn_suffix" {
  type    = string
  default = ""
}

variable "ecs_cluster_name" {
  type    = string
  default = ""
}

variable "ecs_service_name" {
  type    = string
  default = ""
}

variable "api_desired_count" {
  type    = number
  default = 2
}

variable "enable_waf_alarms" {
  type    = bool
  default = true
}

variable "enable_alb_alarms" {
  type        = bool
  default     = true
  description = "ALB 5xx alarm — gate count on this static bool, not computed ARN suffixes."
}

variable "enable_ecs_alarms" {
  type    = bool
  default = true
}

variable "waf_web_acl_name" {
  type    = string
  default = ""
}

variable "alert_email" {
  type        = string
  default     = ""
  description = "Optional email for CloudWatch alarm SNS notifications."
}

variable "tags" {
  type    = map(string)
  default = {}
}

resource "aws_sns_topic" "ops_alerts" {
  count = var.alert_email != "" ? 1 : 0
  name  = "${var.name_prefix}-ops-alerts"
  tags  = var.tags
}

resource "aws_sns_topic_subscription" "ops_email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.ops_alerts[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}

locals {
  alarm_actions = var.alert_email != "" ? [aws_sns_topic.ops_alerts[0].arn] : []
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  count = var.enable_alb_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-api-alb-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"
  alarm_description   = "CogniMesh API ALB target 5xx spike"
  alarm_actions       = local.alarm_actions

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "ecs_running_tasks" {
  count = var.enable_ecs_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-api-ecs-running-tasks-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "RunningTaskCount"
  namespace           = "ECS/ContainerInsights"
  period              = 60
  statistic           = "Average"
  threshold           = var.api_desired_count
  treat_missing_data  = "breaching"
  alarm_description   = "CogniMesh API ECS running tasks below desired"
  alarm_actions       = local.alarm_actions

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "cognimesh_deploy_failed" {
  alarm_name          = "${var.name_prefix}-deploy-failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "deploy_failed"
  namespace           = "CogniMesh"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"
  alarm_description   = "CogniMesh deploy_failed EMF metric"
  alarm_actions       = local.alarm_actions
  tags                = var.tags
}

resource "aws_cloudwatch_metric_alarm" "waf_blocked" {
  count = var.enable_waf_alarms ? 1 : 0

  alarm_name          = "${var.name_prefix}-waf-blocked-spike"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = 300
  statistic           = "Sum"
  threshold           = 100
  treat_missing_data  = "notBreaching"
  alarm_description   = "WAF blocked request spike on CogniMesh portal/API"
  alarm_actions       = local.alarm_actions

  dimensions = {
    WebACL = var.waf_web_acl_name
    Region = var.aws_region
    Rule   = "ALL"
  }

  tags = var.tags
}

locals {
  alb_widget = var.alb_arn_suffix != "" && var.target_group_arn_suffix != "" ? [{
    type   = "metric"
    x      = 0
    y      = 0
    width  = 12
    height = 6
    properties = {
      title  = "API ALB"
      region = var.aws_region
      metrics = [
        ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix, "TargetGroup", var.target_group_arn_suffix],
        [".", "HTTPCode_Target_5XX_Count", ".", ".", ".", "."],
        [".", "TargetResponseTime", ".", ".", ".", ".", { stat = "p95" }],
      ]
      period = 300
      view   = "timeSeries"
    }
  }] : []

  ecs_widget = var.ecs_cluster_name != "" && var.ecs_service_name != "" ? [{
    type   = "metric"
    x      = 12
    y      = 0
    width  = 12
    height = 6
    properties = {
      title  = "ECS API service"
      region = var.aws_region
      metrics = [
        ["ECS/ContainerInsights", "RunningTaskCount", "ClusterName", var.ecs_cluster_name, "ServiceName", var.ecs_service_name],
        [".", "CpuUtilized", ".", ".", ".", "."],
        [".", "MemoryUtilized", ".", ".", ".", "."],
      ]
      period = 300
      view   = "timeSeries"
    }
  }] : []

  emf_widget = [{
    type   = "metric"
    x      = 0
    y      = 6
    width  = 24
    height = 6
    properties = {
      title  = "CogniMesh custom metrics (EMF)"
      region = var.aws_region
      metrics = [
        ["CogniMesh", "deploy_success", "service", "cognimesh-api-gateway"],
        [".", "deploy_failed", ".", "."],
        [".", "preview_failed", ".", "."],
        [".", "http_5xx", ".", "."],
      ]
      period = 300
      view   = "timeSeries"
    }
  }]
}

resource "aws_cloudwatch_dashboard" "cognimesh" {
  dashboard_name = "${var.name_prefix}-ops"

  dashboard_body = jsonencode({
    widgets = concat(local.alb_widget, local.ecs_widget, local.emf_widget)
  })
}

output "dashboard_name" {
  value = aws_cloudwatch_dashboard.cognimesh.dashboard_name
}

output "sns_topic_arn" {
  value = try(aws_sns_topic.ops_alerts[0].arn, null)
}
