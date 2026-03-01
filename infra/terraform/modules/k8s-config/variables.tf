variable "cluster_endpoint" {
  type = string
}

variable "cluster_ca_certificate" {
  type = string
}

variable "cluster_auth_token" {
  type      = string
  sensitive = true
}

variable "cluster_name" {
  type = string
}
