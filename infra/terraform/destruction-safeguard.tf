##############################################################
# RASID NEXUS — Destruction Safeguard
# Prevents accidental terraform destroy in production
##############################################################

# ============================================================
# Null Resource: Destruction Guard
# Forces manual confirmation before destroy
# ============================================================

resource "null_resource" "destruction_guard" {
  count = var.enable_deletion_protection ? 1 : 0

  lifecycle {
    prevent_destroy = true
  }

  triggers = {
    protection_enabled = "true"
    environment        = var.environment
    message            = "DESTRUCTION BLOCKED: Set enable_deletion_protection=false to allow destroy"
  }
}

# ============================================================
# Terraform required_providers for null
# ============================================================

terraform {
  required_providers {
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}
