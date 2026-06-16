data "external" "integrity_gate_package" {
  program = ["node", abspath("${path.module}/../../scripts/package-lambda.js"), "integrity-gate", "--terraform-json"]
}

data "external" "domain_writer_package" {
  program = ["node", abspath("${path.module}/../../scripts/package-lambda.js"), "domain-writer", "--terraform-json"]
}
