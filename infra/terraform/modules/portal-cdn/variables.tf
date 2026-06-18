variable "name_prefix" {
  type = string
}

variable "portal_bucket_name" {
  type = string
}

variable "domain_name" {
  type    = string
  default = ""
}

variable "enable_waf" {
  type        = bool
  default     = true
  description = "Attach AWS WAFv2 (CloudFront scope) with managed OWASP rules + rate limit. Adds cost."
}

variable "waf_rate_limit" {
  type        = number
  default     = 2000
  description = "Requests per 5 minutes per IP before WAF block (when enable_waf)."
}

variable "api_origin_domain" {
  type        = string
  default     = ""
  description = "ALB DNS name; when set, CloudFront proxies /api/* to the API tier."
}

variable "tags" {
  type    = map(string)
  default = {}
}
