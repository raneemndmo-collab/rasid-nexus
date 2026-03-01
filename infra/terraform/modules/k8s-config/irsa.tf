##############################################################
# RASID NEXUS — OIDC & IRSA Hardening
# Service Account IAM Mapping Model
##############################################################

# ============================================================
# Data Sources
# ============================================================

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}

# ============================================================
# IRSA: VPC-CNI Service Account
# ============================================================

resource "aws_iam_role" "vpc_cni_irsa" {
  name = "${var.cluster_name}-vpc-cni-irsa"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = var.oidc_provider_arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${var.oidc_issuer}:sub" = "system:serviceaccount:kube-system:aws-node"
            "${var.oidc_issuer}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = {
    Name = "${var.cluster_name}-vpc-cni-irsa"
  }
}

resource "aws_iam_role_policy_attachment" "vpc_cni_irsa" {
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.vpc_cni_irsa.name
}

# ============================================================
# IRSA: Monitoring (Prometheus) Service Account
# ============================================================

resource "aws_iam_role" "monitoring_irsa" {
  name = "${var.cluster_name}-monitoring-irsa"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = var.oidc_provider_arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${var.oidc_issuer}:sub" = "system:serviceaccount:rasid-monitoring:prometheus-kube-prometheus-stack-prometheus"
            "${var.oidc_issuer}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = {
    Name = "${var.cluster_name}-monitoring-irsa"
  }
}

resource "aws_iam_policy" "monitoring_cloudwatch" {
  name = "${var.cluster_name}-monitoring-cloudwatch"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData",
          "cloudwatch:GetMetricData",
          "cloudwatch:ListMetrics"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "cloudwatch:namespace" = "RASID/Nexus"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "monitoring_irsa" {
  policy_arn = aws_iam_policy.monitoring_cloudwatch.arn
  role       = aws_iam_role.monitoring_irsa.name
}

# ============================================================
# IRSA: Ingress Controller Service Account
# ============================================================

resource "aws_iam_role" "ingress_irsa" {
  name = "${var.cluster_name}-ingress-irsa"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = var.oidc_provider_arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${var.oidc_issuer}:sub" = "system:serviceaccount:rasid-ingress:ingress-nginx"
            "${var.oidc_issuer}:aud" = "sts.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = {
    Name = "${var.cluster_name}-ingress-irsa"
  }
}

resource "aws_iam_policy" "ingress_nlb" {
  name = "${var.cluster_name}-ingress-nlb"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "elasticloadbalancing:DescribeLoadBalancers",
          "elasticloadbalancing:DescribeTargetGroups",
          "elasticloadbalancing:DescribeTargetHealth",
          "elasticloadbalancing:DescribeListeners",
          "elasticloadbalancing:DescribeRules",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeSubnets",
          "ec2:DescribeVpcs"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ingress_irsa" {
  policy_arn = aws_iam_policy.ingress_nlb.arn
  role       = aws_iam_role.ingress_irsa.name
}

# ============================================================
# Default Service Account Restriction
# No default SA should have IAM privileges
# ============================================================

resource "kubernetes_cluster_role" "deny_default_sa_escalation" {
  metadata {
    name = "rasid-deny-default-sa-escalation"
    labels = {
      "rasid.io/security" = "irsa-hardening"
    }
  }

  rule {
    api_groups = [""]
    resources  = ["serviceaccounts/token"]
    verbs      = ["create"]
  }
}

# Automount token disabled for default SAs in all RASID namespaces
resource "kubernetes_service_account" "restricted_default" {
  for_each = local.namespaces

  metadata {
    name      = "default"
    namespace = each.key
    annotations = {
      "rasid.io/irsa-restricted" = "true"
    }
  }

  automount_service_account_token = false

  depends_on = [kubernetes_namespace.rasid]
}
