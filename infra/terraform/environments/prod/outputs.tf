output "vpc_id" {
  value = module.networking.vpc_id
}

output "bronze_bucket" {
  value = module.storage.bronze_bucket
}

output "silver_bucket" {
  value = module.storage.silver_bucket
}

output "gold_bucket" {
  value = module.storage.gold_bucket
}

output "checkpoint_bucket_arn" {
  value = module.storage.checkpoint_bucket_arn
}

output "proof_bucket_arn" {
  value = module.storage.proof_bucket_arn
}

output "glue_database" {
  value = module.glue.database_name
}

output "catalog_table" {
  value = module.dynamodb.table_name
}

output "pipeline_state_machine_arn" {
  value = try(module.orchestration[0].state_machine_arn, null)
}

output "dlq_url" {
  value = module.messaging.dlq_url
}

output "cognito_user_pool_id" {
  value = try(module.cognito[0].user_pool_id, null)
}

output "cognito_client_id" {
  value = try(module.cognito[0].client_id, null)
}

output "cognito_default_admin_username" {
  value = try(module.cognito[0].default_admin_username, null)
}

output "cognito_default_admin_initial_password" {
  value     = try(module.cognito[0].default_admin_initial_password, null)
  sensitive = true
}

output "integrity_gate_lambda_arn" {
  value = try(module.integrity_gate_lambda[0].function_arn, null)
}

output "domain_writer_lambda_arn" {
  value = try(module.domain_writer_lambda[0].function_arn, null)
}

output "eks_cluster_name" {
  value = try(module.eks[0].cluster_name, null)
}

output "portal_cloudfront_domain" {
  value = try(module.portal_cdn[0].cloudfront_domain, null)
}

output "portal_bucket" {
  value = try(module.portal_cdn[0].portal_bucket, null)
}

output "platform_state_table" {
  value = try(module.platform_ops[0].platform_state_table_name, null)
}

output "athena_workgroup" {
  value = try(module.platform_ops[0].athena_workgroup_name, null)
}

output "athena_output_location" {
  value = try(module.platform_ops[0].athena_output_location, null)
}

output "api_platform_role_arn" {
  value = try(module.platform_ops[0].api_platform_role_arn, null)
}

output "platform_env" {
  value     = try(module.platform_ops[0].platform_env, {})
  sensitive = false
}
