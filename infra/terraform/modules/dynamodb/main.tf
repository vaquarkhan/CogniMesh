variable "name_prefix" {
  type = string
}

variable "table_name" {
  type    = string
  default = "cognimesh-data-products"
}

variable "tags" {
  type    = map(string)
  default = {}
}

resource "aws_dynamodb_table" "catalog" {
  name         = "${var.name_prefix}-${var.table_name}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "domain"
    type = "S"
  }

  global_secondary_index {
    name            = "domain-index"
    hash_key        = "domain"
    range_key       = "sk"
    projection_type = "ALL"
  }

  point_in_time_recovery { enabled = true }

  server_side_encryption { enabled = true }

  tags = merge(var.tags, { Component = "catalog" })
}

output "table_name" {
  value = aws_dynamodb_table.catalog.name
}

output "table_arn" {
  value = aws_dynamodb_table.catalog.arn
}
