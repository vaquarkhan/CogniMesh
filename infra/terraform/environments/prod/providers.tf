provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "cognimesh"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
