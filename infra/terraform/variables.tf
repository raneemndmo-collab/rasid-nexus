##############################################################
# RASID NEXUS — EU-0A-001 Variables
##############################################################

# ============================================================
# General
# ============================================================

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "rasid-nexus"
}

variable "environment" {
  description = "Environment name (e.g., production, staging)"
  type        = string
  default     = "production"
}

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "me-south-1"
}

# ============================================================
# VPC
# ============================================================

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "vpc_cidr must be a valid CIDR block."
  }
}

variable "availability_zones" {
  description = "List of availability zones (minimum 3 for multi-AZ)"
  type        = list(string)
  default     = ["me-south-1a", "me-south-1b", "me-south-1c"]

  validation {
    condition     = length(var.availability_zones) >= 3
    error_message = "EU-0A-001 requires minimum 3 availability zones."
  }
}

variable "public_subnets" {
  description = "CIDR blocks for public subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "private_subnets" {
  description = "CIDR blocks for private subnets (one per AZ)"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
}

# ============================================================
# EKS
# ============================================================

variable "cluster_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
  default     = "1.31"
}

variable "node_instance_types" {
  description = "EC2 instance types for worker nodes"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "node_desired_size" {
  description = "Desired number of worker nodes (minimum 3)"
  type        = number
  default     = 3

  validation {
    condition     = var.node_desired_size >= 3
    error_message = "EU-0A-001 requires minimum 3 worker nodes."
  }
}

variable "node_min_size" {
  description = "Minimum number of worker nodes"
  type        = number
  default     = 3

  validation {
    condition     = var.node_min_size >= 3
    error_message = "EU-0A-001 requires minimum 3 worker nodes."
  }
}

variable "node_max_size" {
  description = "Maximum number of worker nodes"
  type        = number
  default     = 5

  validation {
    condition     = var.node_max_size >= var.node_min_size
    error_message = "node_max_size must be >= node_min_size."
  }
}

variable "node_disk_size" {
  description = "Disk size in GB for worker nodes"
  type        = number
  default     = 50
}

# ============================================================
# Security Hardening
# ============================================================

variable "enable_public_endpoint" {
  description = "Enable public API endpoint (default: false for private-only)"
  type        = bool
  default     = false
}

variable "allowed_public_cidrs" {
  description = "CIDR blocks allowed to access public endpoint (if enabled). Empty = no access."
  type        = list(string)
  default     = []
}

# ============================================================
# Cost Guardrails
# ============================================================

variable "budget_monthly_limit_usd" {
  description = "Monthly budget ceiling in USD"
  type        = number
  default     = 500
}

variable "budget_alert_emails" {
  description = "Email addresses for budget alerts"
  type        = list(string)
  default     = []
}

# ============================================================
# Destruction Safeguard
# ============================================================

variable "enable_deletion_protection" {
  description = "Enable deletion protection (prevents terraform destroy without explicit override)"
  type        = bool
  default     = true
}
