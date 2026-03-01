# EU-0A-001 Pre-Apply Hardening Report

**Date:** 2026-03-01
**Status:** **AWAITING APPROVAL**

This report details the 8 critical pre-apply corrections implemented for the EU-0A-001 Terraform EKS cluster provisioning. All items have been addressed to meet constitutional and security requirements before any infrastructure is provisioned.

---

### 1. Terraform Remote State

**Requirement:** State must NOT be local. Configure S3 backend with DynamoDB locking, encryption, and versioning.

**Implementation:**

- **Remote Backend:** A separate Terraform configuration has been created in `backend-bootstrap/` to provision the necessary AWS resources for remote state management. This must be run once before the main `terraform apply`.
- **S3 Bucket:** An S3 bucket (`rasid-nexus-production-tfstate`) is created with:
  - **Versioning:** Enabled to retain state history.
  - **Server-Side Encryption:** Enforced with a dedicated KMS key (`alias/rasid-nexus-production-tfstate`).
  - **Public Access:** Blocked at the bucket level.
  - **Bucket Policy:** Denies unencrypted uploads and insecure transport (non-HTTPS).
- **DynamoDB Table:** A DynamoDB table (`rasid-nexus-production-tflock`) is created for state locking to prevent concurrent modifications.
- **Configuration:** The main Terraform configuration now includes a `backend.tf` file specifying the S3 backend, DynamoDB table, and encryption settings.

| Resource | Purpose | Encryption | Versioning/Recovery |
|---|---|---|---|
| S3 Bucket | Terraform State Storage | AES-256 (KMS) | Enabled |
| DynamoDB Table | State Locking | AES-256 (Default) | Point-in-Time Recovery Enabled |
| KMS Key | S3 Bucket Encryption | Customer-Managed | Rotation Enabled |

---

### 2. Least-Privilege IAM Policy

**Requirement:** Replace broad IAM policies with scoped, least-privilege policies and separate provisioning from runtime roles.

**Implementation:**

- **Role Separation:** The single, overly-permissive policy has been replaced with a multi-role model:
  1. **`provisioning-role-policy.json`:** Scoped-down policy for the user/role running `terraform apply`. It grants permissions to create/manage only the specific resources defined in the Terraform configuration (e.g., `arn:aws:eks:me-south-1:*:cluster/rasid-nexus-*`). Wildcard actions have been minimized.
  2. **`runtime-eks-cluster-policy.json`:** Attached to the EKS Cluster IAM Role. Grants minimal permissions needed by the EKS control plane to manage AWS resources on its behalf.
  3. **`runtime-eks-node-policy.json`:** Attached to the EKS Node Group IAM Role. Grants minimal permissions needed by worker nodes (e.g., ECR pull, CloudWatch logs).
  4. **`state-bootstrap-role-policy.json`:** A minimal policy for the one-time creation of the S3/DynamoDB state management resources.
- **Scoped Resources:** Policies now target specific resource ARNs where possible, limiting their scope to resources tagged for this project.

---

### 3. Cost Guardrails

**Requirement:** Define node limits, cost estimates, and budget alerts.

**Implementation:**

- **Node Limits:** Defined as variables with validation:
  - `node_min_size`: 3
  - `node_desired_size`: 3
  - `node_max_size`: 5
- **Instance Type:** `t3.medium` (default, can be overridden).
- **Cost Projection:**
  | Scenario | Nodes | Instance Type | Monthly Cost (USD) |
  |---|---|---|---|
  | **Minimum** | 3 | `t3.medium` | ~$150 |
  | **Expected** | 3 | `t3.medium` | ~$150 |
  | **Maximum** | 5 | `t3.medium` | ~$250 |
  *Note: Costs are estimates for EC2 instances and EKS control plane fee, excluding data transfer and other services.*
- **Budget Alert:** A new `cost-guardrails.tf` configuration creates an AWS Budget (`rasid-nexus-production-monthly-budget`) with a default limit of **$500/month**. Alerts will be sent to a configurable list of emails (`budget_alert_emails`) at 50%, 80%, 100%, and 100% (forecasted) of the budget.

---

### 4. Region Justification

**Requirement:** Justify region selection, consider latency, and define a DR pairing.

**Implementation:**

- **Region Selection:** `me-south-1` (Bahrain) was selected as the default for the following reasons:
  1. **Proximity:** Lowest latency for target users in the Kingdom of Saudi Arabia and the broader Middle East.
  2. **Compliance:** Meets local data residency requirements.
  3. **Service Availability:** Supports all required services (EKS, KMS, DynamoDB, etc.).
- **Latency:** Intra-region latency is typically single-digit milliseconds. Cross-region latency to the DR pair is higher but acceptable for disaster recovery scenarios.
- **DR Pairing Region:** `eu-central-1` (Frankfurt) is designated as the DR pairing region. It offers a balance of geographic separation for disaster resilience while maintaining a relatively lower latency link compared to US or APAC regions.

---

### 5. Network CIDR Strategy

**Requirement:** Define VPC and subnet CIDRs with an expansion buffer.

**Implementation:**

- **CIDR Allocation Table:**
  | Resource | CIDR Block | # of IPs | Purpose | Expansion Buffer |
  |---|---|---|---|---|
  | **VPC** | `10.0.0.0/16` | 65,536 | Main project network | Ample space for future subnets |
  | Public Subnet 1 (AZ-a) | `10.0.1.0/24` | 256 | ELB, NAT Gateway | |
  | Public Subnet 2 (AZ-b) | `10.0.2.0/24` | 256 | ELB | |
  | Public Subnet 3 (AZ-c) | `10.0.3.0/24` | 256 | ELB | |
  | Private Subnet 1 (AZ-a) | `10.0.11.0/24` | 256 | EKS Worker Nodes | |
  | Private Subnet 2 (AZ-b) | `10.0.12.0/24` | 256 | EKS Worker Nodes | |
  | Private Subnet 3 (AZ-c) | `10.0.13.0/24` | 256 | EKS Worker Nodes | |
- **Overlap Avoidance:** The `/16` VPC block provides a large address space. Subnets are allocated in distinct `/24` blocks, leaving significant room for future expansion (e.g., database subnets, caching subnets) without risk of overlap.

---

### 6. Security Hardening

**Requirement:** Enforce private EKS endpoint, restrict public access, enable KMS rotation, and enable audit logging.

**Implementation:**

- **EKS Endpoint:**
  - `endpoint_private_access`: `true` (Enabled by default).
  - `endpoint_public_access`: `false` (Now the default via `enable_public_endpoint` variable). Public access is disabled unless explicitly required.
  - `public_access_cidrs`: If public access is enabled, it is restricted to a specific list of CIDRs (`allowed_public_cidrs`), preventing open access.
- **KMS Key Rotation:** Enabled (`enable_key_rotation = true`) for both the EKS secrets KMS key and the Terraform state KMS key.
- **Audit Logging:** EKS control plane logs (`api`, `audit`, `authenticator`, `controllerManager`, `scheduler`) are enabled and will be sent to CloudWatch Logs.

---

### 7. OIDC & IRSA Hardening

**Requirement:** Define a service account IAM mapping model (IRSA) and restrict default service account privileges.

**Implementation:**

- **IRSA Model:** A new `irsa.tf` file implements IAM Roles for Service Accounts. Specific, least-privilege IAM roles are created and mapped directly to the service accounts that require AWS API access:
  - `vpc-cni-irsa`: For the AWS VPC CNI plugin.
  - `monitoring-irsa`: For the Prometheus monitoring stack.
  - `ingress-irsa`: For the NGINX Ingress controller to manage NLBs.
- **Default SA Restriction:** The `default` service account in all created namespaces now has `automount_service_account_token = false`, preventing pods from automatically receiving a token and mitigating potential privilege escalation.

---

### 8. Destruction Safeguard

**Requirement:** Remove `-auto-approve` from destruction instructions and add a production protection flag.

**Implementation:**

- **`destruction-safeguard.tf`:** A new file adds a `null_resource` with a `prevent_destroy` lifecycle hook.
- **`enable_deletion_protection`:** This new boolean variable (default: `true`) controls the safeguard. To destroy the environment, this variable must be explicitly set to `false` and applied first.
- **Updated Instructions:** `EXECUTION_PLAN.md` has been updated to remove `-auto-approve` and detail the mandatory multi-step process for destruction, including manual confirmation.

---

**Conclusion:** All 8 pre-apply hardening requirements have been implemented. The Terraform configuration is now significantly more secure, resilient, and production-ready. **Awaiting approval to proceed with credential injection and `terraform apply`.**
