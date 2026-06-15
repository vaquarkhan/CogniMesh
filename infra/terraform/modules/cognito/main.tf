variable "name_prefix" {
  type = string
}

variable "default_admin_email" {
  type        = string
  description = "Admin-created default user email (self-registration disabled)"
}

variable "default_admin_username" {
  type    = string
  default = ""
}

variable "portal_callback_urls" {
  type    = list(string)
  default = ["http://localhost:3000/"]
}

variable "portal_logout_urls" {
  type    = list(string)
  default = ["http://localhost:3000/"]
}

variable "mfa_configuration" {
  type    = string
  default = "OPTIONAL"
}

variable "tags" {
  type    = map(string)
  default = {}
}

resource "random_password" "admin_initial" {
  length           = 20
  special          = true
  override_special = "!@#$%&*-_=+"
}

resource "aws_cognito_user_pool" "main" {
  name = "${var.name_prefix}-portal-users"

# Self-registration disabled - admin creates users only
  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  mfa_configuration = var.mfa_configuration

  software_token_mfa_configuration {
    enabled = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }

  tags = merge(var.tags, { Component = "cognito" })
}

resource "aws_cognito_user_pool_client" "portal" {
  name         = "${var.name_prefix}-portal-spa"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
  ]

  supported_identity_providers = ["COGNITO"]

  callback_urls = var.portal_callback_urls
  logout_urls   = var.portal_logout_urls

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
}

resource "aws_cognito_user" "default_admin" {
  user_pool_id = aws_cognito_user_pool.main.id
  username     = coalesce(var.default_admin_username, var.default_admin_email)

  attributes = {
    email          = var.default_admin_email
    email_verified = "true"
  }

  temporary_password = random_password.admin_initial.result
  message_action     = "SUPPRESS"
}

resource "aws_cognito_user_in_group" "admin" {
  user_pool_id = aws_cognito_user_pool.main.id
  group_name   = aws_cognito_user_group.admins.name
  username     = aws_cognito_user.default_admin.username
}

resource "aws_cognito_user_group" "admins" {
  name         = "cognimesh-admins"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "CogniMesh platform administrators"
}

resource "aws_cognito_user_group" "designers" {
  name         = "cognimesh-designers"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Pipeline designers (deploy access)"
}

output "user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  value = aws_cognito_user_pool.main.arn
}

output "client_id" {
  value = aws_cognito_user_pool_client.portal.id
}

output "default_admin_username" {
  value = aws_cognito_user.default_admin.username
}

output "default_admin_initial_password" {
  value     = random_password.admin_initial.result
  sensitive = true
}
