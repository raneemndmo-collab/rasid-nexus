output "calico_installed" {
  description = "NetworkPolicy enforcement is enabled via VPC-CNI addon"
  value       = true
}

output "namespaces" {
  description = "List of created namespaces"
  value       = keys(local.namespaces)
}

output "network_policies_count" {
  description = "Total number of NetworkPolicy objects"
  value       = length(kubernetes_network_policy.default_deny) + length(kubernetes_network_policy.allow_intra) + length(kubernetes_network_policy.allow_dns) + length(kubernetes_network_policy.allow_monitoring) + 1
}

output "mtls_ca_subject" {
  description = "mTLS CA certificate subject"
  value       = tls_self_signed_cert.ca.subject[0].common_name
}
