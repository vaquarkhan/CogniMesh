variable "name_prefix" {
  type = string
}

variable "lakehouse_bucket_arn" {
  type = string
}

variable "lakehouse_bucket_name" {
  type = string
}

variable "glue_database_name" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_dynamodb_table" "platform_state" {
  name         = "${var.name_prefix}-platform-state"
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

  point_in_time_recovery { enabled = true }
  server_side_encryption { enabled = true }

  tags = merge(var.tags, { Component = "platform-ops" })
}

resource "aws_athena_workgroup" "platform" {
  name = "${var.name_prefix}-platform"

  configuration {
    enforce_workgroup_configuration    = true
    publish_cloudwatch_metrics_enabled = true

    result_configuration {
      output_location = "s3://${var.lakehouse_bucket_name}/athena-results/"
    }
  }

  tags = var.tags
}

resource "aws_iam_role" "api_platform" {
  name = "${var.name_prefix}-api-platform"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = ["ecs-tasks.amazonaws.com", "lambda.amazonaws.com", "ec2.amazonaws.com"] }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "api_platform" {
  name = "${var.name_prefix}-api-platform"
  role = aws_iam_role.api_platform.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoPlatformState"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query", "dynamodb:UpdateItem",
        ]
        Resource = [aws_dynamodb_table.platform_state.arn, "${aws_dynamodb_table.platform_state.arn}/index/*"]
      },
      {
        Sid    = "AthenaPreview"
        Effect = "Allow"
        Action = [
          "athena:StartQueryExecution", "athena:GetQueryExecution", "athena:GetQueryResults",
          "athena:StopQueryExecution",
        ]
        Resource = ["arn:aws:athena:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:workgroup/${aws_athena_workgroup.platform.name}"]
      },
      {
        Sid    = "AthenaResultsS3"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:ListBucket", "s3:GetBucketLocation"]
        Resource = [var.lakehouse_bucket_arn, "${var.lakehouse_bucket_arn}/*"]
      },
      {
        Sid    = "GlueForAthena"
        Effect = "Allow"
        Action = ["glue:GetDatabase", "glue:GetTable", "glue:GetTables"]
        Resource = [
          "arn:aws:glue:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:catalog",
          "arn:aws:glue:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:database/${var.glue_database_name}",
          "arn:aws:glue:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.glue_database_name}/*",
        ]
      },
      {
        Sid    = "BedrockAgentDeploy"
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock-agent:CreateAgent", "bedrock-agent:CreateAgentAlias",
          "bedrock-agent:AssociateAgentKnowledgeBase", "bedrock-agent:AssociateAgentGuardrail",
          "bedrock-agent:GetAgent",
        ]
        Resource = "*"
      },
      {
        Sid    = "RdsDataApiPreview"
        Effect = "Allow"
        Action = ["rds-data:ExecuteStatement", "rds-data:BatchExecuteStatement"]
        Resource = "*"
      },
      {
        Sid    = "SfnImport"
        Effect = "Allow"
        Action = ["states:DescribeStateMachine", "states:ListStateMachines"]
        Resource = "*"
      },
      {
        Sid    = "SecretsForRds"
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue"]
        Resource = "*"
      },
    ]
  })
}

resource "aws_iam_role" "bedrock_agent" {
  name = "${var.name_prefix}-bedrock-agent"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "bedrock.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "bedrock_agent" {
  name = "${var.name_prefix}-bedrock-agent"
  role = aws_iam_role.bedrock_agent.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "bedrock:InvokeModel", "bedrock:Retrieve", "bedrock:RetrieveAndGenerate",
      ]
      Resource = "*"
    }]
  })
}

output "platform_state_table_name" {
  value = aws_dynamodb_table.platform_state.name
}

output "platform_state_table_arn" {
  value = aws_dynamodb_table.platform_state.arn
}

output "athena_workgroup_name" {
  value = aws_athena_workgroup.platform.name
}

output "athena_output_location" {
  value = "s3://${var.lakehouse_bucket_name}/athena-results/"
}

output "api_platform_role_arn" {
  value = aws_iam_role.api_platform.arn
}

output "bedrock_agent_role_arn" {
  value = aws_iam_role.bedrock_agent.arn
}

output "platform_env" {
  value = {
    PLATFORM_STORE           = "dynamodb"
    PLATFORM_DYNAMODB_TABLE  = aws_dynamodb_table.platform_state.name
    ATHENA_WORKGROUP         = aws_athena_workgroup.platform.name
    ATHENA_OUTPUT_LOCATION   = "s3://${var.lakehouse_bucket_name}/athena-results/"
    AWS_BEDROCK_AGENT_ROLE_ARN = aws_iam_role.bedrock_agent.arn
  }
}
