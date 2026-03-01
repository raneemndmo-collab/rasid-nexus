variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "cluster_version" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "node_instance_types" {
  type = list(string)
}

variable "node_desired_size" {
  type = number
}

variable "node_min_size" {
  type = number
}

variable "node_max_size" {
  type = number
}

variable "node_disk_size" {
  type = number
}

variable "enable_public_endpoint" {
  description = "Enable public API endpoint (set false for private-only access)"
  type        = bool
  default     = false
}

variable "allowed_public_cidrs" {
  description = "CIDR blocks allowed to access public endpoint (if enabled)"
  type        = list(string)
  default     = []
}
