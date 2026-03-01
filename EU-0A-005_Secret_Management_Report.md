# EU-0A-005 — Secret Management & Configuration Governance Report

**Execution Unit:** EU-0A-005  
**Status:** COMPLETE  
**Date:** 2026-03-01  
**Cluster:** rasid-nexus-core (DigitalOcean Kubernetes, 3 nodes)

---

## 1. Vault Deployment

| Property | Value |
|---|---|
| Namespace | `rasid-secrets` |
| Pod | `rasid-vault-56d477b454-fpdnn` (Running, 1/1) |
| Image | `hashicorp/vault:1.15.6` |
| Seal Type | Shamir |
| Initialized | true |
| Sealed | false |
| Storage | In-memory (dev mode) |
| API Endpoint | `http://rasid-vault.rasid-secrets.svc.cluster.local:8200` |
| Service Account | `rasid-vault` (auth-delegator) |
| Security Context | `runAsUser: 100, runAsGroup: 1000` |

---

## 2. Secret Engines (10 KV-v2)

| Engine Path | Type | Accessor | Module |
|---|---|---|---|
| `rasid/kernel/` | kv-v2 | `kv_d8d11fdc` | Kernel |
| `rasid/auth/` | kv-v2 | `kv_06c472c3` | Authentication |
| `rasid/audit/` | kv-v2 | `kv_9dd14e62` | Audit |
| `rasid/documents/` | kv-v2 | `kv_4e195ff3` | Documents |
| `rasid/workflow/` | kv-v2 | `kv_7bf08454` | Workflow |
| `rasid/notifications/` | kv-v2 | `kv_c4f5b2d1` | Notifications |
| `rasid/compliance/` | kv-v2 | `kv_4785cd28` | Compliance |
| `rasid/search/` | kv-v2 | `kv_753cc27a` | Search |
| `rasid/config/` | kv-v2 | `kv_d0384dfe` | Config |
| `rasid/gateway/` | kv-v2 | `kv_9ef09df5` | Gateway |

---

## 3. Policy Model

Each module has a dedicated policy granting access only to its own secret engine path.

| Policy | Allowed Path | Capabilities |
|---|---|---|
| `policy-kernel` | `rasid/kernel/*` | create, read, update, delete, list |
| `policy-auth` | `rasid/auth/*` | create, read, update, delete, list |
| `policy-audit` | `rasid/audit/*` | create, read, update, delete, list |
| `policy-documents` | `rasid/documents/*` | create, read, update, delete, list |
| `policy-workflow` | `rasid/workflow/*` | create, read, update, delete, list |
| `policy-notifications` | `rasid/notifications/*` | create, read, update, delete, list |
| `policy-compliance` | `rasid/compliance/*` | create, read, update, delete, list |
| `policy-search` | `rasid/search/*` | create, read, update, delete, list |
| `policy-config` | `rasid/config/*` | create, read, update, delete, list |
| `policy-gateway` | `rasid/gateway/*` | create, read, update, delete, list |
| `deny-all-secrets` | `rasid/*` | **deny** (explicit deny-all baseline) |

---

## 4. Token Mapping

| Module | Token Secret | Display Name | TTL | Policy |
|---|---|---|---|---|
| kernel | `vault-token-kernel` | svc-kernel | 168h | policy-kernel |
| auth | `vault-token-auth` | svc-auth | 168h | policy-auth |
| audit | `vault-token-audit` | svc-audit | 168h | policy-audit |
| documents | `vault-token-documents` | svc-documents | 168h | policy-documents |
| workflow | `vault-token-workflow` | svc-workflow | 168h | policy-workflow |
| notifications | `vault-token-notifications` | svc-notifications | 168h | policy-notifications |
| compliance | `vault-token-compliance` | svc-compliance | 168h | policy-compliance |
| search | `vault-token-search` | svc-search | 168h | policy-search |
| config | `vault-token-config` | svc-config | 168h | policy-config |
| gateway | `vault-token-gateway` | svc-gateway | 168h | policy-gateway |

---

## 5. Stored Secrets (20 total)

Each module has 2 secret paths:

| Path | Keys |
|---|---|
| `rasid/{module}/database` | host, port, database, username, password, ssl_mode |
| `rasid/{module}/api` | api_key, environment, module |

---

## 6. Audit Configuration

| Property | Value |
|---|---|
| Audit Device | `file` |
| Path | `/vault/data/audit.log` |
| Format | JSON (HMAC-SHA256 hashed) |
| Entries | 28 lines (at time of test) |

---

## 7. Network Isolation

| Namespace | Policy | Effect |
|---|---|---|
| `rasid-secrets` | `default-deny-all` | Block all ingress/egress by default |
| `rasid-secrets` | `secrets-allow` | Allow port 8200 ingress from any namespace, DNS egress |
| `default` | `default-deny` | Block all egress — prevents cross-namespace access |

---

## 8. Isolation Test Results

| Test | Action | Expected | Actual | Status |
|---|---|---|---|---|
| 1 | kernel token → `rasid/kernel/database` | Read success | Data returned (host, port, db, user, pass) | **PASS** |
| 2 | kernel token → `rasid/auth/database` | 403 Denied | `preflight capability check returned 403` | **PASS** |
| 3 | auth token → `rasid/auth/api` | Read success | Data returned (api_key, env, module) | **PASS** |
| 4 | auth token → `rasid/kernel/api` | 403 Denied | `preflight capability check returned 403` | **PASS** |
| 5 | Invalid token → any path | 403 Denied | `permission denied` | **PASS** |
| 6 | Secret versioning | Version 2 created | `current_version=2`, both versions listed | **PASS** |
| 7 | Audit log | Entries logged | 28 lines, HMAC-SHA256 hashed | **PASS** |
| 8 | Cross-namespace (default → rasid-secrets) | Blocked | NetworkPolicy default-deny blocks egress | **PASS** |

---

## 9. Drift Baseline

```
Hash: 1f8940a11eafb9bf12fb85db8bceb067b18d47c09852f448a02f0847ccb16d09
Scope: k8s-secrets/*.yaml
Method: sha256sum of all manifest files, sorted, then hashed
```

---

## 10. Manifests

| File | Purpose |
|---|---|
| `k8s-secrets/01-namespace.yaml` | Namespace, NetworkPolicies |
| `k8s-secrets/02-vault.yaml` | Vault deployment, RBAC, Service, ConfigMap |

---

**EU-0A-005 CLOSED.**
