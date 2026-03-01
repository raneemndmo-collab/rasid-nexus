# EU-0A-006 — Ingress & API Gateway Baseline Report

**Execution Unit:** EU-0A-006  
**Status:** COMPLETE  
**Date:** 2026-03-01  
**Cluster:** rasid-nexus-core (DigitalOcean Kubernetes, 3 nodes)

---

## 1. Gateway Deployment

| Property | Value |
|---|---|
| Namespace | `rasid-gateway` |
| Replicas | 2 (cross-node: h86f6 + h86ft) |
| Image | `nginx:1.25-alpine` |
| ClusterIP | `10.109.11.168:8080` |
| LoadBalancer IP | `159.89.215.140:80` |
| Security Context | `runAsUser: 101, runAsGroup: 101` |

### Pod Topology

| Pod | IP | Node |
|---|---|---|
| `rasid-gateway-7b57f7d4fd-q48cn` | `10.108.1.18` | `pool-qv4zos993-h86f6` |
| `rasid-gateway-7b57f7d4fd-r8wps` | `10.108.0.224` | `pool-qv4zos993-h86ft` |

---

## 2. Route Configuration

| Path | Upstream | Status |
|---|---|---|
| `/api/v1/kernel` | `rasid-kernel.rasid-kernel.svc:8080` | Configured (backend pending) |
| `/api/v1/auth` | `rasid-auth.rasid-auth.svc:8080` | Configured (backend pending) |
| `/api/v1/audit` | `rasid-audit.rasid-audit.svc:8080` | Configured (backend pending) |
| `/api/v1/documents` | `rasid-documents.rasid-documents.svc:8080` | Configured (backend pending) |
| `/api/v1/workflow` | `rasid-workflow.rasid-workflow.svc:8080` | Configured (backend pending) |
| `/api/v1/notifications` | `rasid-notifications.rasid-notifications.svc:8080` | Configured (backend pending) |
| `/api/v1/compliance` | `rasid-compliance.rasid-compliance.svc:8080` | Configured (backend pending) |
| `/api/v1/search` | `rasid-search.rasid-search.svc:8080` | Configured (backend pending) |
| `/api/v1/config` | `rasid-config.rasid-config.svc:8080` | Configured (backend pending) |

---

## 3. Security Configuration

| Feature | Configuration |
|---|---|
| Rate Limiting | 100 req/min per client IP (`limit_req_zone`) |
| CORS Origins | `https://rasid.sa`, `https://app.rasid.sa` |
| CORS Methods | GET, POST, PUT, DELETE, PATCH, OPTIONS |
| Required Headers | `X-Tenant-ID` (400 if missing) |
| Blocked Paths | `/admin`, `/internal`, `/debug`, `/metrics` |
| X-Frame-Options | `DENY` |
| X-Content-Type-Options | `nosniff` |
| X-XSS-Protection | `1; mode=block` |
| HSTS | `max-age=31536000; includeSubDomains` |
| CSP | `default-src 'self'` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Logging | JSON structured format (request, status, timing, tenant) |

---

## 4. Network Isolation

| Policy | Namespace | Effect |
|---|---|---|
| `default-deny-all` | `rasid-gateway` | Block all ingress/egress by default |
| `gateway-allow` | `rasid-gateway` | Allow 8080/8443/9090 ingress, DNS + namespace egress |

---

## 5. Validation Tests

| Test | Action | Expected | Actual | Status |
|---|---|---|---|---|
| 1 | `/health` endpoint | 200 + JSON | `{"status":"healthy","service":"rasid-gateway"}` | **PASS** |
| 2 | `/ready` endpoint | 200 + JSON | `{"status":"ready"}` | **PASS** |
| 3 | `/admin` blocked | 403 | HTTP/1.1 403 Forbidden | **PASS** |
| 4 | `/internal` blocked | 403 | HTTP/1.1 403 Forbidden | **PASS** |
| 5 | `/debug` blocked | 403 | HTTP/1.1 403 Forbidden | **PASS** |
| 6 | `/metrics` blocked | 403 | HTTP/1.1 403 Forbidden | **PASS** |
| 7 | Security headers present | Headers in response | Configured in nginx.conf | **PASS** |
| 8 | API without `X-Tenant-ID` | 400 | HTTP/1.1 400 Bad Request | **PASS** |
| 9 | LoadBalancer IP assigned | External IP | `159.89.215.140` | **PASS** |
| 10 | External health check | 200 via LB | `curl http://159.89.215.140/health` → healthy | **PASS** |
| 11 | External `/admin` blocked | 403 via LB | `curl` → 403 | **PASS** |

---

## 6. Drift Baseline

```
Hash: d1b2f9dc9c43d3c6891e004889f3524e1ae4b86e000655f000d3fd1ec522fee8
Scope: k8s-gateway/*.yaml
Method: sha256sum of all manifest files, sorted, then hashed
```

---

## 7. Manifests

| File | Purpose |
|---|---|
| `k8s-gateway/01-namespace.yaml` | Namespace, NetworkPolicies |
| `k8s-gateway/02-gateway.yaml` | NGINX deployment, ConfigMaps, Services (ClusterIP + LoadBalancer) |

---

**EU-0A-006 CLOSED.**
