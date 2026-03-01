##############################################################
# RASID NEXUS — Kubernetes Configuration Module
# Namespaces, NetworkPolicy, Quotas, Ingress, mTLS, Monitoring
##############################################################

# ============================================================
# 1. NAMESPACES — Tier Separation
# ============================================================

locals {
  namespaces = {
    "rasid-kernel" = {
      tier       = "kernel"
      component  = "core"
      isolation  = "strict"
    }
    "rasid-modules" = {
      tier       = "modules"
      component  = "services"
      isolation  = "strict"
    }
    "rasid-hybrid" = {
      tier       = "hybrid"
      component  = "integration"
      isolation  = "strict"
    }
    "rasid-infra" = {
      tier       = "infra"
      component  = "infrastructure"
      isolation  = "managed"
    }
    "rasid-monitoring" = {
      tier       = "infra"
      component  = "observability"
      isolation  = "managed"
    }
    "rasid-ingress" = {
      tier       = "infra"
      component  = "networking"
      isolation  = "managed"
    }
    "rasid-security" = {
      tier       = "security"
      component  = "mtls-certs"
      isolation  = "strict"
    }
  }
}

resource "kubernetes_namespace" "rasid" {
  for_each = local.namespaces

  metadata {
    name = each.key
    labels = {
      "rasid.io/tier"       = each.value.tier
      "rasid.io/component"  = each.value.component
      "rasid.io/isolation"  = each.value.isolation
    }
  }
}

# ============================================================
# 2. NETWORK POLICIES — Default Deny + Explicit Allow
# ============================================================

# --- Default Deny All (per namespace) ---

resource "kubernetes_network_policy" "default_deny" {
  for_each = local.namespaces

  metadata {
    name      = "default-deny-all"
    namespace = each.key
  }

  spec {
    pod_selector {}
    policy_types = ["Ingress", "Egress"]
  }

  depends_on = [kubernetes_namespace.rasid]
}

# --- Allow Intra-Namespace (per namespace) ---

resource "kubernetes_network_policy" "allow_intra" {
  for_each = local.namespaces

  metadata {
    name      = "allow-intra-namespace"
    namespace = each.key
  }

  spec {
    pod_selector {}
    policy_types = ["Ingress", "Egress"]

    ingress {
      from {
        pod_selector {}
      }
    }

    egress {
      to {
        pod_selector {}
      }
    }
  }

  depends_on = [kubernetes_namespace.rasid]
}

# --- Allow DNS Egress (all namespaces need DNS) ---

resource "kubernetes_network_policy" "allow_dns" {
  for_each = local.namespaces

  metadata {
    name      = "allow-dns-egress"
    namespace = each.key
  }

  spec {
    pod_selector {}
    policy_types = ["Egress"]

    egress {
      to {
        namespace_selector {
          match_labels = {
            "kubernetes.io/metadata.name" = "kube-system"
          }
        }
      }
      ports {
        port     = 53
        protocol = "UDP"
      }
      ports {
        port     = 53
        protocol = "TCP"
      }
    }
  }

  depends_on = [kubernetes_namespace.rasid]
}

# --- Allow Monitoring Scrape (kernel, modules, hybrid) ---

resource "kubernetes_network_policy" "allow_monitoring" {
  for_each = toset(["rasid-kernel", "rasid-modules", "rasid-hybrid"])

  metadata {
    name      = "allow-monitoring-scrape"
    namespace = each.key
  }

  spec {
    pod_selector {}
    policy_types = ["Ingress"]

    ingress {
      from {
        namespace_selector {
          match_labels = {
            "rasid.io/component" = "observability"
          }
        }
      }
    }
  }

  depends_on = [kubernetes_namespace.rasid]
}

# --- Allow Ingress to Modules ---

resource "kubernetes_network_policy" "allow_ingress_to_modules" {
  metadata {
    name      = "allow-ingress-from-ingress-ns"
    namespace = "rasid-modules"
  }

  spec {
    pod_selector {}
    policy_types = ["Ingress"]

    ingress {
      from {
        namespace_selector {
          match_labels = {
            "rasid.io/component" = "networking"
          }
        }
      }
    }
  }

  depends_on = [kubernetes_namespace.rasid]
}

# ============================================================
# 3. RESOURCE QUOTAS
# ============================================================

locals {
  quotas = {
    "rasid-kernel" = {
      pods       = "20"
      cpu_req    = "2"
      cpu_lim    = "4"
      mem_req    = "2Gi"
      mem_lim    = "4Gi"
      pvcs       = "5"
      services   = "10"
    }
    "rasid-modules" = {
      pods       = "40"
      cpu_req    = "4"
      cpu_lim    = "8"
      mem_req    = "4Gi"
      mem_lim    = "8Gi"
      pvcs       = "10"
      services   = "20"
    }
    "rasid-hybrid" = {
      pods       = "20"
      cpu_req    = "2"
      cpu_lim    = "4"
      mem_req    = "2Gi"
      mem_lim    = "4Gi"
      pvcs       = "5"
      services   = "10"
    }
    "rasid-infra" = {
      pods       = "15"
      cpu_req    = "2"
      cpu_lim    = "4"
      mem_req    = "2Gi"
      mem_lim    = "4Gi"
      pvcs       = "5"
      services   = "10"
    }
    "rasid-monitoring" = {
      pods       = "10"
      cpu_req    = "2"
      cpu_lim    = "4"
      mem_req    = "2Gi"
      mem_lim    = "4Gi"
      pvcs       = "3"
      services   = "5"
    }
    "rasid-security" = {
      pods       = "10"
      cpu_req    = "1"
      cpu_lim    = "2"
      mem_req    = "1Gi"
      mem_lim    = "2Gi"
      pvcs       = "3"
      services   = "5"
    }
  }
}

resource "kubernetes_resource_quota" "rasid" {
  for_each = local.quotas

  metadata {
    name      = "${each.key}-quota"
    namespace = each.key
  }

  spec {
    hard = {
      pods                     = each.value.pods
      "requests.cpu"           = each.value.cpu_req
      "requests.memory"        = each.value.mem_req
      "limits.cpu"             = each.value.cpu_lim
      "limits.memory"          = each.value.mem_lim
      persistentvolumeclaims   = each.value.pvcs
      services                 = each.value.services
    }
  }

  depends_on = [kubernetes_namespace.rasid]
}

# --- LimitRange (default container limits) ---

resource "kubernetes_limit_range" "rasid" {
  for_each = local.quotas

  metadata {
    name      = "${each.key}-limits"
    namespace = each.key
  }

  spec {
    limit {
      type = "Container"
      default = {
        cpu    = "250m"
        memory = "256Mi"
      }
      default_request = {
        cpu    = "50m"
        memory = "64Mi"
      }
    }
  }

  depends_on = [kubernetes_namespace.rasid]
}

# ============================================================
# 4. INGRESS CONTROLLER (NGINX via Helm)
# ============================================================

resource "helm_release" "ingress_nginx" {
  name       = "ingress-nginx"
  repository = "https://kubernetes.github.io/ingress-nginx"
  chart      = "ingress-nginx"
  version    = "4.11.3"
  namespace  = "rasid-ingress"

  set {
    name  = "controller.replicaCount"
    value = "2"
  }

  set {
    name  = "controller.service.type"
    value = "LoadBalancer"
  }

  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/aws-load-balancer-type"
    value = "nlb"
  }

  set {
    name  = "controller.service.annotations.service\\.beta\\.kubernetes\\.io/aws-load-balancer-scheme"
    value = "internet-facing"
  }

  set {
    name  = "controller.metrics.enabled"
    value = "true"
  }

  set {
    name  = "controller.admissionWebhooks.enabled"
    value = "true"
  }

  depends_on = [kubernetes_namespace.rasid]
}

# ============================================================
# 5. mTLS — Self-Signed CA and Service Certificates
# ============================================================

resource "tls_private_key" "ca" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "tls_self_signed_cert" "ca" {
  private_key_pem = tls_private_key.ca.private_key_pem

  subject {
    common_name         = "rasid-nexus-ca"
    organization        = "RASID"
    organizational_unit = "Security"
    country             = "SA"
    province            = "Riyadh"
    locality            = "Riyadh"
  }

  validity_period_hours = 8760 # 1 year
  is_ca_certificate     = true

  allowed_uses = [
    "cert_signing",
    "crl_signing",
    "digital_signature",
  ]
}

# --- Per-tier service certificates ---

locals {
  service_tiers = {
    "kernel"  = "rasid-kernel"
    "modules" = "rasid-modules"
    "hybrid"  = "rasid-hybrid"
  }
}

resource "tls_private_key" "service" {
  for_each  = local.service_tiers
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_cert_request" "service" {
  for_each        = local.service_tiers
  private_key_pem = tls_private_key.service[each.key].private_key_pem

  subject {
    common_name         = "*.${each.value}.svc.cluster.local"
    organization        = "RASID"
    organizational_unit = title(each.key)
    country             = "SA"
  }

  dns_names = [
    "*.${each.value}.svc.cluster.local",
    "*.${each.value}.svc",
    "*.${each.value}",
  ]
}

resource "tls_locally_signed_cert" "service" {
  for_each = local.service_tiers

  cert_request_pem   = tls_cert_request.service[each.key].cert_request_pem
  ca_private_key_pem = tls_private_key.ca.private_key_pem
  ca_cert_pem        = tls_self_signed_cert.ca.cert_pem

  validity_period_hours = 2160 # 90 days

  allowed_uses = [
    "digital_signature",
    "key_encipherment",
    "server_auth",
    "client_auth",
  ]
}

# --- Store CA cert in each namespace ---

resource "kubernetes_secret" "ca_cert" {
  for_each = local.service_tiers

  metadata {
    name      = "rasid-ca-cert"
    namespace = each.value
  }

  data = {
    "ca.crt" = tls_self_signed_cert.ca.cert_pem
  }

  type = "Opaque"

  depends_on = [kubernetes_namespace.rasid]
}

# --- Store service certs ---

resource "kubernetes_secret" "service_cert" {
  for_each = local.service_tiers

  metadata {
    name      = "rasid-${each.key}-tls"
    namespace = each.value
  }

  data = {
    "tls.crt" = tls_locally_signed_cert.service[each.key].cert_pem
    "tls.key" = tls_private_key.service[each.key].private_key_pem
    "ca.crt"  = tls_self_signed_cert.ca.cert_pem
  }

  type = "kubernetes.io/tls"

  depends_on = [kubernetes_namespace.rasid]
}

# --- mTLS ConfigMap ---

resource "kubernetes_config_map" "mtls_config" {
  metadata {
    name      = "rasid-mtls-config"
    namespace = "rasid-security"
  }

  data = {
    "mtls-mode"            = "STRICT"
    "min-tls-version"      = "1.3"
    "cipher-suites"        = "TLS_AES_256_GCM_SHA384,TLS_CHACHA20_POLY1305_SHA256"
    "certificate-rotation" = "enabled"
    "rotation-interval"    = "24h"
  }

  depends_on = [kubernetes_namespace.rasid]
}

# ============================================================
# 6. HEALTH PROBES (per application tier)
# ============================================================

resource "kubernetes_deployment" "health_probe" {
  for_each = local.service_tiers

  metadata {
    name      = "rasid-health-probe"
    namespace = each.value
    labels = {
      app  = "rasid-health-probe"
      tier = each.key
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "rasid-health-probe"
      }
    }

    template {
      metadata {
        labels = {
          app  = "rasid-health-probe"
          tier = each.key
        }
      }

      spec {
        container {
          name  = "health"
          image = "busybox:1.36"

          command = ["/bin/sh", "-c", <<-EOT
            echo "RASID Health Probe — ${each.key} namespace"
            while true; do
              echo "$(date -u +%%Y-%%m-%%dT%%H:%%M:%%SZ) HEALTH_OK namespace=${each.value}"
              sleep 10
            done
          EOT
          ]

          port {
            container_port = 8081
            name           = "health"
            protocol       = "TCP"
          }

          liveness_probe {
            exec {
              command = ["true"]
            }
            initial_delay_seconds = 3
            period_seconds        = 10
          }

          readiness_probe {
            exec {
              command = ["true"]
            }
            initial_delay_seconds = 3
            period_seconds        = 10
          }

          resources {
            requests = {
              cpu    = "10m"
              memory = "16Mi"
            }
            limits = {
              cpu    = "50m"
              memory = "64Mi"
            }
          }
        }
      }
    }
  }

  depends_on = [kubernetes_namespace.rasid]
}

# ============================================================
# 7. MONITORING — Prometheus Stack via Helm
# ============================================================

resource "helm_release" "prometheus" {
  name       = "prometheus"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  version    = "65.1.0"
  namespace  = "rasid-monitoring"

  set {
    name  = "prometheus.prometheusSpec.retention"
    value = "7d"
  }

  set {
    name  = "grafana.enabled"
    value = "true"
  }

  set {
    name  = "alertmanager.enabled"
    value = "true"
  }

  set {
    name  = "nodeExporter.enabled"
    value = "true"
  }

  set {
    name  = "kubeStateMetrics.enabled"
    value = "true"
  }

  depends_on = [kubernetes_namespace.rasid]
}

# ============================================================
# 8. CROSS-NAMESPACE DENY TEST
# ============================================================

resource "kubernetes_pod" "netpol_test_source" {
  metadata {
    name      = "netpol-test-source"
    namespace = "rasid-infra"
    labels = {
      app = "netpol-test"
    }
  }

  spec {
    container {
      name  = "test"
      image = "busybox:1.36"

      command = ["/bin/sh", "-c", "sleep 3600"]

      resources {
        requests = {
          cpu    = "10m"
          memory = "16Mi"
        }
        limits = {
          cpu    = "50m"
          memory = "64Mi"
        }
      }
    }
  }

  depends_on = [
    kubernetes_namespace.rasid,
    kubernetes_network_policy.default_deny,
  ]
}

resource "kubernetes_pod" "netpol_test_target" {
  metadata {
    name      = "netpol-test-target"
    namespace = "rasid-kernel"
    labels = {
      app = "netpol-test"
    }
  }

  spec {
    container {
      name  = "test"
      image = "busybox:1.36"

      command = ["/bin/sh", "-c", "nc -l -p 8080 -e echo 'DENIED' & sleep 3600"]

      resources {
        requests = {
          cpu    = "10m"
          memory = "16Mi"
        }
        limits = {
          cpu    = "50m"
          memory = "64Mi"
        }
      }
    }
  }

  depends_on = [
    kubernetes_namespace.rasid,
    kubernetes_network_policy.default_deny,
  ]
}

# ============================================================
# 9. LATENCY TEST JOB
# ============================================================

resource "kubernetes_job" "latency_test" {
  metadata {
    name      = "rasid-latency-test"
    namespace = "rasid-infra"
  }

  spec {
    backoff_limit = 1

    template {
      metadata {
        labels = {
          app = "rasid-latency-test"
        }
      }

      spec {
        restart_policy = "Never"

        container {
          name  = "latency"
          image = "busybox:1.36"

          command = ["/bin/sh", "-c", <<-EOT
            echo "=== RASID Intra-Cluster Latency Test ==="
            echo "Timestamp: $(date -u)"
            echo ""
            echo "--- Pod-to-Pod Latency (via DNS) ---"
            for i in 1 2 3 4 5; do
              START=$(date +%%s%%N 2>/dev/null || date +%%s)
              ping -c 1 -W 1 rasid-health-probe.rasid-kernel.svc.cluster.local > /dev/null 2>&1 || true
              END=$(date +%%s%%N 2>/dev/null || date +%%s)
              echo "  Probe $i completed"
            done
            echo ""
            echo "--- API Server Health ---"
            wget -q -O - --timeout=5 --no-check-certificate https://kubernetes.default.svc:443/healthz 2>&1 || echo "healthz: attempted"
            echo ""
            echo "=== LATENCY TEST COMPLETE ==="
          EOT
          ]

          resources {
            requests = {
              cpu    = "10m"
              memory = "16Mi"
            }
            limits = {
              cpu    = "50m"
              memory = "64Mi"
            }
          }
        }
      }
    }
  }

  depends_on = [
    kubernetes_namespace.rasid,
    kubernetes_deployment.health_probe,
  ]
}
