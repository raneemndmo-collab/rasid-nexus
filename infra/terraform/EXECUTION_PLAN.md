# RASID NEXUS — EU-0A-001 Terraform Execution Plan

This document outlines the steps and requirements for provisioning the RASID Nexus EKS cluster using the provided Terraform configuration.

---

## 1. Required AWS IAM Policy

The user or role executing `terraform apply` requires the following permissions. This is a broad set for initial provisioning; a more restrictive policy can be created for ongoing management.

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ec2:Describe*",
                "ec2:Create*",
                "ec2:Delete*",
                "ec2:RunInstances",
                "ec2:AllocateAddress",
                "ec2:AssociateRouteTable",
                "ec2:AttachInternetGateway",
                "ec2:AuthorizeSecurityGroupEgress",
                "ec2:AuthorizeSecurityGroupIngress",
                "ec2:CreateInternetGateway",
                "ec2:CreateNatGateway",
                "ec2:CreateRoute",
                "ec2:CreateRouteTable",
                "ec2:CreateSecurityGroup",
                "ec2:CreateSubnet",
                "ec2:CreateTags",
                "ec2:CreateVpc",
                "ec2:DeleteInternetGateway",
                "ec2:DeleteNatGateway",
                "ec2:DeleteRouteTable",
                "ec2:DeleteSecurityGroup",
                "ec2:DeleteSubnet",
                "ec2:DeleteVpc",
                "ec2:DetachInternetGateway",
                "ec2:DisassociateRouteTable",
                "ec2:ModifyVpcAttribute",
                "ec2:RevokeSecurityGroupEgress",
                "ec2:RevokeSecurityGroupIngress",
                "eks:*",
                "iam:Create*",
                "iam:Delete*",
                "iam:Get*",
                "iam:List*",
                "iam:PassRole",
                "iam:PutRolePolicy",
                "iam:AttachRolePolicy",
                "iam:DetachRolePolicy",
                "iam:TagRole",
                "iam:UntagRole",
                "iam:CreateOpenIDConnectProvider",
                "iam:DeleteOpenIDConnectProvider",
                "iam:UpdateOpenIDConnectProviderThumbprint",
                "kms:Create*",
                "kms:Describe*",
                "kms:Enable*",
                "kms:List*",
                "kms:ScheduleKeyDeletion",
                "kms:TagResource",
                "kms:UntagResource",
                "ssm:GetParameter",
                "cloudformation:CreateStack",
                "cloudformation:DeleteStack",
                "cloudformation:DescribeStacks"
            ],
            "Resource": "*"
        }
    ]
}
```

---

## 2. Execution Order

**Prerequisites:**
1. Install Terraform v1.5.0 or later.
2. Install AWS CLI and configure credentials (`aws configure`).
3. Install `kubectl`.
4. Install `helm`.

**Execution Steps:**

1. **Clone Repository:**
   ```bash
   git clone https://github.com/raneemndmo-collab/rasid-nexus.git
   cd rasid-nexus/infra/terraform
   ```

2. **Configure Variables:**
   - Copy `terraform.tfvars.example` to `terraform.tfvars`.
   - Review and update the variables in `terraform.tfvars` for your target environment. The defaults are configured for `me-south-1`.

3. **Initialize Terraform:**
   ```bash
   terraform init
   ```

4. **Plan and Review:**
   ```bash
   terraform plan
   ```
   - Carefully review the execution plan to ensure all resources will be created as expected.

5. **Apply Configuration:**
   - **WAIT FOR CREDENTIAL INJECTION INSTRUCTIONS BEFORE PROCEEDING.**
   - Once credentials are provided and configured, apply the configuration:
   ```bash
   terraform apply -auto-approve
   ```
   - This process will take approximately 15-25 minutes.

6. **Configure kubectl:**
   - After the apply is complete, Terraform will output a command to configure `kubectl`. Run this command:
   ```bash
   $(terraform output -raw kubeconfig_command)
   ```

7. **Verify Cluster:**
   ```bash
   kubectl get nodes -o wide
   kubectl get pods -A
   ```
   - Verify that all nodes are `Ready` and all pods (including CoreDNS, Calico, and Prometheus) are `Running` or `Completed`.

---

## 3. Destruction (Rollback) Plan

**Production environments are protected by default.** The `enable_deletion_protection` variable must be explicitly set to `false` before destruction is possible.

**Step 1: Disable Protection**
```bash
# Update terraform.tfvars:
enable_deletion_protection = false

# Apply the change:
terraform apply -target=null_resource.destruction_guard
```

**Step 2: Plan Destruction (Review)**
```bash
terraform plan -destroy
```
Review the destruction plan carefully. Confirm every resource listed.

**Step 3: Execute Destruction (Manual Confirmation Required)**
```bash
terraform destroy
```
Terraform will prompt for manual confirmation. Type `yes` only after reviewing the plan.

**WARNING:** `-auto-approve` is PROHIBITED for destruction operations. Manual confirmation is mandatory.

**WARNING:** This will permanently delete the EKS cluster, all associated nodes, all networking resources, and all data stored in the cluster. This action is irreversible.
