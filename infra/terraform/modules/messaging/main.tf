variable "name_prefix" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}

resource "aws_sqs_queue" "dlq" {
  name                      = "${var.name_prefix}-pipeline-dlq"
  message_retention_seconds = 1209600
  kms_master_key_id         = "alias/aws/sqs"

  tags = merge(var.tags, { Component = "messaging" })
}

output "dlq_arn" {
  value = aws_sqs_queue.dlq.arn
}

output "dlq_url" {
  value = aws_sqs_queue.dlq.url
}
