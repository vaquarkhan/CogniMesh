variable "name_prefix" {
  type = string
}

variable "checkpoint_bucket_arn" {
  type = string
}

variable "proof_bucket_arn" {
  type = string
}

variable "lakehouse_bucket_arn" {
  type = string
}

variable "glue_database_name" {
  type = string
}

variable "enable_lakeformation" {
  type    = bool
  default = true
}

variable "tags" {
  type    = map(string)
  default = {}
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_iam_role" "pipeline_orchestrator" {
  name = "${var.name_prefix}-pipeline-orchestrator"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "states.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "pipeline_orchestrator" {
  name = "${var.name_prefix}-sfn-pipeline"
  role = aws_iam_role.pipeline_orchestrator.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction",
          "glue:StartJobRun",
          "glue:GetJobRun",
          "eks:RunJob",
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogDelivery",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups",
        ]
        Resource = "*"
      },
    ]
  })
}

resource "aws_iam_role" "domain_writer" {
  name = "${var.name_prefix}-domain-writer"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.domain_writer.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "domain_writer_data" {
  name = "${var.name_prefix}-domain-writer-data"
  role = aws_iam_role.domain_writer.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Sid    = "S3MeshBuckets"
          Effect = "Allow"
          Action = [
            "s3:GetObject", "s3:PutObject", "s3:DeleteObject",
            "s3:ListBucket", "s3:GetBucketLocation",
          ]
          Resource = [
            var.checkpoint_bucket_arn, "${var.checkpoint_bucket_arn}/*",
            var.proof_bucket_arn, "${var.proof_bucket_arn}/*",
            var.lakehouse_bucket_arn, "${var.lakehouse_bucket_arn}/*",
          ]
        },
        {
          Sid    = "GlueCatalog"
          Effect = "Allow"
          Action = [
            "glue:GetDatabase", "glue:GetDatabases",
            "glue:GetTable", "glue:GetTables", "glue:UpdateTable",
            "glue:GetPartition", "glue:GetPartitions",
          ]
          Resource = [
            "arn:aws:glue:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:catalog",
            "arn:aws:glue:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:database/${var.glue_database_name}",
            "arn:aws:glue:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:table/${var.glue_database_name}/*",
          ]
        },
        {
          Sid      = "VRPTrustMetrics"
          Effect   = "Allow"
          Action   = ["cloudwatch:PutMetricData"]
          Resource = "*"
          Condition = {
            StringLike = { "cloudwatch:namespace" = "CogniMesh*" }
          }
        },
      ],
      var.enable_lakeformation ? [{
        Sid      = "LakeFormationDataAccess"
        Effect   = "Allow"
        Action   = ["lakeformation:GetDataAccess"]
        Resource = "*"
      }] : []
    )
  })
}

output "pipeline_orchestrator_role_arn" {
  value = aws_iam_role.pipeline_orchestrator.arn
}

output "domain_writer_role_arn" {
  value = aws_iam_role.domain_writer.arn
}

output "domain_writer_role_name" {
  value = aws_iam_role.domain_writer.name
}
