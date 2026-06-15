variable "name_prefix" {
  type = string
}

variable "consumer_principal_arn" {
  type = string
}

variable "database_name" {
  type = string
}

variable "table_name" {
  type = string
}

variable "steward_role_name" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

resource "aws_lakeformation_resource" "consumer_table" {
  arn = "arn:aws:glue:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.database_name}/${var.table_name}"
}

resource "aws_lakeformation_permissions" "consumer_read" {
  principal   = var.consumer_principal_arn
  permissions = ["SELECT"]

  table {
    database_name = var.database_name
    name          = var.table_name
  }

  lifecycle {
    precondition {
      condition     = length(var.consumer_principal_arn) > 0
      error_message = "consumer_principal_arn is required for Lake Formation governance."
    }
  }
}

resource "aws_iam_role_policy" "steward_lf_grant" {
  name = "${var.name_prefix}-steward-lf-consumer-sla"
  role = var.steward_role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "GrantConsumerOnIntegrityPass"
        Effect = "Allow"
        Action = [
          "lakeformation:GrantPermissions",
          "lakeformation:RevokePermissions",
          "lakeformation:GetDataAccess",
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "lakeformation:GrantTagKey"   = "integrity_gate"
            "lakeformation:GrantTagValue" = "passed"
          }
        }
      },
    ]
  })
}

output "lf_table_arn" {
  value = aws_lakeformation_resource.consumer_table.arn
}
