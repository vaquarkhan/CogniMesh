variable "name_prefix" {
  type = string
}

variable "database_name" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}

resource "aws_glue_catalog_database" "mesh" {
  name = var.database_name
  tags = merge(var.tags, { Component = "glue" })
}

output "database_name" {
  value = aws_glue_catalog_database.mesh.name
}
