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

  environment {
    variables = {
      NODE_ENV = "production"
    }
  }

  tags = var.tags
}

output "function_name" {
  value = aws_lambda_function.this.function_name
}

output "function_arn" {
  value = aws_lambda_function.this.arn
}

output "invoke_arn" {
  value = aws_lambda_function.this.invoke_arn
}
