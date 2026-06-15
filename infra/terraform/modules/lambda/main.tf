variable "name_prefix" {
  type = string
}

variable "role_arn" {
  type = string
}

variable "package_path" {
  type = string
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

resource "aws_lambda_function" "integrity_gate" {
  function_name = "${var.name_prefix}-integrity-gate"
  role          = var.role_arn
  handler       = var.handler
  runtime       = "nodejs20.x"
  timeout       = var.timeout
  memory_size   = var.memory_size
  filename      = var.package_path
  source_code_hash = filebase64sha256(var.package_path)

  environment {
    variables = {
      NODE_ENV = "production"
    }
  }

  tags = merge(var.tags, { Component = "integrity-gate" })
}

output "function_name" {
  value = aws_lambda_function.integrity_gate.function_name
}

output "function_arn" {
  value = aws_lambda_function.integrity_gate.arn
}

output "invoke_arn" {
  value = aws_lambda_function.integrity_gate.invoke_arn
}
