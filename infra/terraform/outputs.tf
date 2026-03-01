##############################################################
# RASID NEXUS — EU-0A-001 Outputs
##############################################################

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS cluster API endpoint"
  value       = module.eks.cluster_endpoint
}

output "cluster_version" {
  description = "EKS cluster Kubernetes version"
  value       = module.eks.cluster_version
}

output "cluster_oidc_issuer_url" {
  description = "OIDC issuer URL for the EKS cluster"
  value       = module.eks.oidc_issuer_url
}

output "node_group_name" {
  description = "EKS managed node group name"
  value       = module.eks.node_group_name
}

output "kubeconfig_command" {
  description = "Command to update kubeconfig"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}

output "calico_installed" {
  description = "Whether Calico NetworkPolicy engine is installed"
  value       = module.k8s_config.calico_installed
}

output "namespaces_created" {
  description = "List of created namespaces"
  value       = module.k8s_config.namespaces
}
