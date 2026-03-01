##############################################################
# RASID NEXUS — EU-0A-001 Terraform Root Configuration
# AWS EKS Multi-Node Cluster Provisioning
##############################################################

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.27"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

# ============================================================
# Provider Configuration
# ============================================================

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "rasid-nexus"
      Environment = var.environment
      ManagedBy   = "terraform"
      ExecutionID = "EU-0A-001"
    }
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_ca_certificate)
  token                  = module.eks.cluster_auth_token
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_ca_certificate)
    token                  = module.eks.cluster_auth_token
  }
}

# ============================================================
# Module: VPC
# ============================================================

module "vpc" {
  source = "./modules/vpc"

  project_name       = var.project_name
  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  public_subnets     = var.public_subnets
  private_subnets    = var.private_subnets
}

# ============================================================
# Module: EKS
# ============================================================

module "eks" {
  source = "./modules/eks"

  project_name         = var.project_name
  environment          = var.environment
  cluster_version      = var.cluster_version
  vpc_id               = module.vpc.vpc_id
  private_subnet_ids   = module.vpc.private_subnet_ids
  public_subnet_ids    = module.vpc.public_subnet_ids
  node_instance_types  = var.node_instance_types
  node_desired_size    = var.node_desired_size
  node_min_size        = var.node_min_size
  node_max_size        = var.node_max_size
  node_disk_size          = var.node_disk_size
  enable_public_endpoint  = var.enable_public_endpoint
  allowed_public_cidrs    = var.allowed_public_cidrs
}

# ============================================================
# Module: Kubernetes Configuration
# ============================================================

module "k8s_config" {
  source = "./modules/k8s-config"

  depends_on = [module.eks]

  cluster_endpoint       = module.eks.cluster_endpoint
  cluster_ca_certificate = module.eks.cluster_ca_certificate
  cluster_auth_token     = module.eks.cluster_auth_token
  cluster_name           = module.eks.cluster_name
  oidc_provider_arn      = module.eks.oidc_provider_arn
  oidc_issuer            = replace(module.eks.oidc_issuer_url, "https://", "")
}
