variable "name_prefix" {
  type = string
}

variable "role_arn" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}

resource "aws_sfn_state_machine" "pipeline_template" {
  name     = "${var.name_prefix}-pipeline-orchestrator"
  role_arn = var.role_arn
  type     = "STANDARD"

  definition = templatefile("${path.module}/pipeline.asl.json.tpl", {
    name_prefix = var.name_prefix
  })

  tags = merge(var.tags, { Component = "orchestration" })
}

output "state_machine_arn" {
  value = aws_sfn_state_machine.pipeline_template.arn
}

output "state_machine_name" {
  value = aws_sfn_state_machine.pipeline_template.name
}
