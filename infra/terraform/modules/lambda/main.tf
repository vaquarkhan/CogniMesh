variable "name_prefix" {
  type = string
}

variable "function_suffix" {
  type        = string
  description = "Lambda function name suffix (e.g. integrity-gate, domain-writer)"
  default     = "integrity-gate"
}

variable "role_arn" {
  type = string
}

variable "package_path" {
  type = string
}

variable "source_code_hash" {
  type        = string
  description = "Optional precomputed base64 sha256 of package zip"
  default     = null
}

variable "handler" {
  type    = string
  default = "handler.handler"
}

variable "timeout" {
  type    = number
  default = 30
}

variable "memory_size" {
  type    = number
  default = 256
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "extra_environment" {
  type        = map(string)
  description = "Additional Lambda env vars merged with NODE_ENV"
  default     = {}
}

variable "create_live_alias" {
  type        = bool
  description = "Create a 'live' alias pointing at the latest published version"
  default     = true
}

locals {
  zip_hash = coalesce(var.source_code_hash, filebase64sha256(var.package_path))
}

resource "aws_lambda_function" "this" {
  function_name    = "${var.name_prefix}-${var.function_suffix}"
  role             = var.role_arn
  handler          = var.handler
  runtime          = "nodejs20.x"
  timeout          = var.timeout
  memory_size      = var.memory_size
  filename         = var.package_path
  source_code_hash = local.zip_hash
  publish          = var.create_live_alias

  environment {
    variables = merge({ NODE_ENV = "production" }, var.extra_environment)
  }

  tags = var.tags
}

resource "aws_lambda_alias" "live" {
  count            = var.create_live_alias ? 1 : 0
  name             = "live"
  function_name    = aws_lambda_function.this.function_name
  function_version = aws_lambda_function.this.version
}

output "function_name" {
  value = aws_lambda_function.this.function_name
}

output "function_arn" {
  value = aws_lambda_function.this.arn
}

output "live_alias_arn" {
  value = var.create_live_alias ? aws_lambda_alias.live[0].arn : aws_lambda_function.this.arn
}

output "invoke_arn" {
  value = aws_lambda_function.this.invoke_arn
}
