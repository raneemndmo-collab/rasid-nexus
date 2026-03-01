# EU-0A-004 — Storage & Observability Baseline Report

**Execution Unit:** EU-0A-004  
**Status:** COMPLETE  
**Date:** 2026-03-01  
**Cluster:** rasid-nexus-core (DigitalOcean Kubernetes, 3 nodes)

---

## 1. Object Storage — MinIO

### 1.1 Deployment

| Property | Value |
|---|---|
| Namespace | `rasid-storage` |
| Pod | `rasid-minio-f9d798f68-kzkcb` (Running, 1/1) |
| Image | `minio/minio:RELEASE.2024-01-01T16-36-33Z` |
| Storage | 10Gi PVC (`rasid-minio-data`) |
| API Endpoint | `https://rasid-minio.rasid-storage.svc.cluster.local:9000` |
| Console | `https://rasid-minio.rasid-storage.svc.cluster.local:9001` |
| NetworkPolicy | `default-deny-all` + `minio-allow` (port 9000/9001 only) |

### 1.2 TLS Configuration

| Property | Value |
|---|---|
| TLS Enabled | **YES** |
| Certificate Path | `/certs/public.crt` |
| Private Key Path | `/certs/private.key` |
| CA Path | `/certs/CAs/ca.crt` |
| Subject | `CN=rasid-minio, O=RASID` |
| Issuer | `CN=RASID Storage CA, O=RASID` |
| Generation | Init container with OpenSSL |

### 1.3 Bucket Configuration

| Bucket | Versioning | Encryption | Lifecycle | Access |
|---|---|---|---|---|
| `rasid-documents` | ENABLED | SSE-S3 | Noncurrent expire 60 days | PRIVATE |
| `rasid-audit-logs` | ENABLED | SSE-S3 | Expire 365 days, noncurrent 90 days | PRIVATE |
| `rasid-backups` | ENABLED | SSE-S3 | Noncurrent expire 30 days | PRIVATE |
| `rasid-temp` | ENABLED | SSE-S3 | Expire 7 days | PRIVATE |
| `rasid-compliance` | ENABLED | SSE-S3 | Permanent (no lifecycle) | PRIVATE |

### 1.4 Encryption Proof

All 5 buckets have auto encryption `sse-s3` enabled. Server-side encryption is applied automatically to all objects on upload.

### 1.5 Versioning Proof

Upload test confirmed 2 versions of same object:

```
Version 2: 7c4c3556-d742-48ef-84b4-0ae1e479e817 (10B) — 2026-03-01T07:20:24Z
Version 1: 4dca10b1-7d27-42e9-97f9-788506634141 (45B) — 2026-03-01T07:20:13Z
```

### 1.6 Lifecycle Configuration

```
rasid-temp:       Expire after 7 days
rasid-audit-logs: Expire after 365 days, noncurrent expire after 90 days
rasid-backups:    Noncurrent expire after 30 days
rasid-documents:  Noncurrent expire after 60 days
rasid-compliance: No lifecycle (permanent retention)
```

---

## 2. Storage Validation Tests

### 2.1 Upload Test

```
$ mc cp /tmp/test.txt rasid/rasid-documents/test-upload.txt
`/tmp/test.txt` -> `rasid/rasid-documents/test-upload.txt`
Total: 45 B, Transferred: 45 B, Speed: 672 B/s
```

**Result: PASS**

### 2.2 Download Test

```
$ mc cp rasid/rasid-documents/test-upload.txt /tmp/test-download.txt
`rasid/rasid-documents/test-upload.txt` -> `/tmp/test-download.txt`
Total: 45 B, Transferred: 45 B, Speed: 1.13 KiB/s

Content: "RASID test file Sun Mar  1 07:20:13 UTC 2026"
```

**Result: PASS**

### 2.3 Unauthorized Access Test

```
$ mc alias set noauth https://rasid-minio...:9000 "" "" --insecure
Added `noauth` successfully.

$ mc ls noauth/rasid-documents/ --insecure
mc: <ERROR> Unable to list folder. Access Denied.
```

**Result: PASS — Access Denied without credentials**

---

## 3. Monitoring Stack — Prometheus

### 3.1 Deployment

| Property | Value |
|---|---|
| Namespace | `rasid-monitoring` |
| Pod | `prometheus-6cfbdf6786-9q94v` (Running, 1/1) |
| Image | `prom/prometheus:v2.48.1` |
| Storage | 10Gi PVC (`prometheus-data`) |
| Retention | 15 days |
| Service Account | `prometheus` (ClusterRole with read-only access) |
| Security Context | `runAsUser: 65534, fsGroup: 65534, runAsNonRoot: true` |

### 3.2 Prometheus Active Targets

| Job | Target | Health |
|---|---|---|
| kubernetes-nodes | `https://10.114.0.5:10250/metrics` (pool-qv4zos993-h86fl) | **UP** |
| kubernetes-nodes | `https://10.114.0.6:10250/metrics` (pool-qv4zos993-h86f6) | **UP** |
| kubernetes-nodes | `https://10.114.0.7:10250/metrics` (pool-qv4zos993-h86ft) | **UP** |
| kubernetes-cadvisor | `https://10.114.0.5:10250/metrics/cadvisor` | **UP** |
| kubernetes-cadvisor | `https://10.114.0.6:10250/metrics/cadvisor` | **UP** |
| kubernetes-cadvisor | `https://10.114.0.7:10250/metrics/cadvisor` | **UP** |
| kubernetes-pods | `http://10.114.0.5:9090/metrics` | **UP** |
| kubernetes-pods | `http://10.114.0.6:9090/metrics` | **UP** |
| kubernetes-pods | `http://10.114.0.7:9090/metrics` | **UP** |
| kubernetes-apiservers | `https://100.65.3.88:443/metrics` | DOWN (managed DOKS — expected) |

**9/10 targets UP. API server target is managed by DigitalOcean and does not expose /metrics directly.**

### 3.3 Metrics Proof

```
kubernetes-pods      instance=10.114.0.5:9090  value=1
kubernetes-pods      instance=10.114.0.6:9090  value=1
kubernetes-pods      instance=10.114.0.7:9090  value=1
kubernetes-cadvisor  instance=pool-qv4zos993-h86ft  value=1
kubernetes-nodes     instance=pool-qv4zos993-h86ft  value=1
kubernetes-cadvisor  instance=pool-qv4zos993-h86fl  value=1
kubernetes-nodes     instance=pool-qv4zos993-h86fl  value=1
kubernetes-cadvisor  instance=pool-qv4zos993-h86f6  value=1
kubernetes-nodes     instance=pool-qv4zos993-h86f6  value=1
```

### 3.4 Alert Rules

| Alert | State | Health |
|---|---|---|
| NodeNotReady | inactive | ok |
| HighCPUUsage | inactive | ok |
| HighMemoryUsage | inactive | ok |
| PodCrashLooping | inactive | ok |
| PersistentVolumeUsageHigh | inactive | ok |
| TargetDown | pending | ok |

**6 alert rules configured. All evaluating correctly. TargetDown is pending for managed API server (expected).**

### 3.5 Log Aggregation

| Property | Value |
|---|---|
| Type | DaemonSet (`rasid-log-collector`) |
| Pods | 3 (one per node) |
| Status | All Running |
| Collection Path | `/var/log/containers/*.log` |
| Interval | 60 seconds |

Sample output:
```
2026-03-01T07:20:59Z LOG_COLLECTOR_OK node=... status=collecting
2026-03-01T07:20:59Z log_file=/var/log/containers/rasid-minio-...log lines=14
```

---

## 4. Validation Summary

| Test | Result |
|---|---|
| Bucket creation (5 buckets) | **PASS** |
| Encryption at rest (SSE-S3) | **PASS** |
| Public access blocked | **PASS** |
| Versioning enabled | **PASS** |
| Lifecycle rules defined | **PASS** |
| Upload/download test | **PASS** |
| Unauthorized access FAILS | **PASS** |
| Metrics server active (Prometheus) | **PASS** |
| Prometheus scraping cluster metrics (9/10 targets) | **PASS** |
| Alert rules configured (6 rules) | **PASS** |
| Alert rule evaluation working | **PASS** |
| Log aggregation enabled (3 nodes) | **PASS** |

---

## 5. Drift Baseline

```
Hash: 32816b6bad5a47826e7f21cc414de82ef8ecb49b98a3304dc6f2d65e406a4317
Scope: k8s-storage/*.yaml + k8s-monitoring/*.yaml
Method: sha256sum of all manifest files, sorted, then hashed
```

---

## 6. Manifests

| File | Purpose |
|---|---|
| `k8s-storage/01-namespace.yaml` | Storage namespace + NetworkPolicy |
| `k8s-storage/02-minio.yaml` | MinIO deployment, TLS, PVC, Service |
| `k8s-monitoring/01-namespace.yaml` | Monitoring namespace + NetworkPolicy |
| `k8s-monitoring/02-prometheus.yaml` | Prometheus, RBAC, ConfigMap, Alerts, Log Collector DaemonSet |

---

**EU-0A-004 CLOSED.**
