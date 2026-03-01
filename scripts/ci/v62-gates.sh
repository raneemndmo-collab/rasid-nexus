#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# RASID Nexus — v6.2 Constitutional CI Gates
# ═══════════════════════════════════════════════════════════════════════════════
#
# This script enforces 15 Forbidden Patterns (FP-050 through FP-064) defined
# in the RASID Platform v6.2 Sovereign-Grade Constitutional Master.
#
# Source: Parts 29-39 of the v6.2 Constitution
# Integration Contract: V62-INT-NEXUS-001
#
# Usage:
#   ./scripts/ci/v62-gates.sh [--scan-dir <path>]
#
# Default scan directory: kernel/ and modules/ (Phase 0 scope)
#
# Exit codes:
#   0 — All gates PASS
#   1 — One or more gates FAIL (build should be BLOCKED)
#
# CONSTRAINTS:
#   - This script is ADDITIVE. It does not modify any existing files.
#   - This script scans .ts files only (TypeScript source).
#   - This script does NOT modify CI pipeline stages — it is invoked by them.
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Configuration ──────────────────────────────────────────────────────────

SCAN_DIR="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Directories to scan (Phase 0 scope: kernel and modules)
if [[ -n "$SCAN_DIR" && "$SCAN_DIR" == "--scan-dir" ]]; then
  SCAN_DIR="${2:-$REPO_ROOT}"
else
  SCAN_DIR="$REPO_ROOT"
fi

KERNEL_DIR="$SCAN_DIR/kernel"
MODULES_DIR="$SCAN_DIR/modules"
INFRA_DIR="$SCAN_DIR/infra"

# Counters
TOTAL_GATES=15
PASSED=0
FAILED=0
FAILURES=""

# ─── Helper Functions ───────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

gate_pass() {
  local fp="$1"
  local desc="$2"
  echo -e "  ${GREEN}PASS${NC}  $fp: $desc"
  PASSED=$((PASSED + 1))
}

gate_fail() {
  local fp="$1"
  local desc="$2"
  local detail="$3"
  echo -e "  ${RED}FAIL${NC}  $fp: $desc"
  echo -e "        ${YELLOW}Detail:${NC} $detail"
  FAILED=$((FAILED + 1))
  FAILURES="${FAILURES}\n  - $fp: $desc ($detail)"
}

# Scan .ts files only, excluding node_modules and dist
find_ts_files() {
  local dir="$1"
  if [[ -d "$dir" ]]; then
    find "$dir" -type f -name "*.ts" \
      ! -path "*/node_modules/*" \
      ! -path "*/dist/*" \
      ! -path "*/.git/*" \
      ! -path "*/scripts/*" 2>/dev/null
  fi
}

# ─── Gate Execution ─────────────────────────────────────────────────────────

echo "═══════════════════════════════════════════════════════════════"
echo "  RASID v6.2 Constitutional CI Gates"
echo "  Scan scope: $SCAN_DIR"
echo "  Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ─── FP-050: PII in Log Statements ─────────────────────────────────────────
# Part 29 (Data Governance) + SRE-010: PII SHALL NEVER appear in logs.
# Detect console.log/error/warn/info containing PII field references.

FP050_MATCHES=$(grep -rnE "console\.(log|error|warn|info|debug|trace)\s*\(.*(@|email|password|ssn|phone|national.?id|creditCard|credit_card)" \
  $(find_ts_files "$KERNEL_DIR") $(find_ts_files "$MODULES_DIR") 2>/dev/null || true)

if [[ -z "$FP050_MATCHES" ]]; then
  gate_pass "FP-050" "PII in log statements"
else
  gate_fail "FP-050" "PII in log statements" "$(echo "$FP050_MATCHES" | wc -l) violation(s) found"
fi

# ─── FP-051: Unclassified Data Field in Schema Migration ───────────────────
# Part 29 (DGP-002): Every new migration file must have classification comment
# per field. Missing classification = migration REJECTED.
# For Phase 0: check that any .sql migration files have classification tags.

FP051_VIOLATIONS=""
MIGRATION_FILES=$(find "$SCAN_DIR" -type f -name "*.sql" \
  ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/scripts/*" 2>/dev/null || true)

if [[ -n "$MIGRATION_FILES" ]]; then
  for mf in $MIGRATION_FILES; do
    # Check if migration has CREATE TABLE without Classification comments
    HAS_CREATE=$(grep -c "CREATE TABLE" "$mf" 2>/dev/null || true)
    HAS_CLASS=$(grep -c "Classification:" "$mf" 2>/dev/null || true)
    if [[ "$HAS_CREATE" -gt 0 && "$HAS_CLASS" -eq 0 ]]; then
      FP051_VIOLATIONS="${FP051_VIOLATIONS}$mf "
    fi
  done
fi

if [[ -z "$FP051_VIOLATIONS" ]]; then
  gate_pass "FP-051" "Unclassified data fields in schema migrations"
else
  gate_fail "FP-051" "Unclassified data fields in schema migrations" "Files missing classification: $FP051_VIOLATIONS"
fi

# ─── FP-052: Direct Database Access from Presentation Layer ────────────────
# Part 3 (Module Law): Presentation Layer has ZERO knowledge of DB schemas.
# Detect DB/ORM imports in any presentation-layer code.

FP052_MATCHES=$(grep -rnE "(import.*from\s+['\"].*prisma|import.*from\s+['\"].*drizzle|import.*from\s+['\"].*typeorm|import.*from\s+['\"].*sequelize|import.*from\s+['\"].*knex|import.*from\s+['\"].*pg['\"])" \
  $(find_ts_files "$KERNEL_DIR") $(find_ts_files "$MODULES_DIR") 2>/dev/null || true)

if [[ -z "$FP052_MATCHES" ]]; then
  gate_pass "FP-052" "Direct database/ORM imports in kernel or module code"
else
  gate_fail "FP-052" "Direct database/ORM imports in kernel or module code" "$(echo "$FP052_MATCHES" | wc -l) violation(s) found"
fi

# ─── FP-053: PII in Event Payloads ─────────────────────────────────────────
# Part 29 (DGP): Only reference IDs allowed in event payloads, no direct PII.
# Scan event files for direct PII field names.

EVENT_FILES=$(find "$SCAN_DIR" -type f -name "*.ts" -path "*/events/*" \
  ! -path "*/node_modules/*" ! -path "*/dist/*" 2>/dev/null || true)

FP053_MATCHES=""
if [[ -n "$EVENT_FILES" ]]; then
  FP053_MATCHES=$(grep -rnE "\b(email|password|phone|ssn|national.?[Ii]d|creditCard|credit_card)\b\s*[:\?]" \
    $EVENT_FILES 2>/dev/null || true)
fi

if [[ -z "$FP053_MATCHES" ]]; then
  gate_pass "FP-053" "PII in event payloads"
else
  gate_fail "FP-053" "PII in event payloads" "$(echo "$FP053_MATCHES" | wc -l) violation(s) found"
fi

# ─── FP-054: Cross-Module Source Code Import ───────────────────────────────
# HC-07: No cross-module source code imports.
# Detect imports that reach into another module's internal path.

FP054_MATCHES=$(grep -rnE "from\s+['\"]\.\.\/(\.\.\/)+(modules|kernel\/services)\/" \
  $(find_ts_files "$MODULES_DIR") 2>/dev/null | grep -v "scripts/ci/" || true)
if [[ -z "$FP054_MATCHES" ]]; then
  gate_pass "FP-054" "Cross-module source code imports"
else
  gate_fail "FP-054" "Cross-module source code imports" "$(echo "$FP054_MATCHES" | wc -l) violation(s) found"
fi

# ─── FP-055: Plaintext Inter-Service Communication ─────────────────────────
# Part 30 (ZTS): All inter-service communication via mTLS.
# Detect hardcoded http://localhost or http://127.0.0.1 references.

FP055_MATCHES=$(grep -rnE "(http://localhost|http://127\.0\.0\.1|http://0\.0\.0\.0)" \
  $(find_ts_files "$KERNEL_DIR") $(find_ts_files "$MODULES_DIR") 2>/dev/null || true)

if [[ -z "$FP055_MATCHES" ]]; then
  gate_pass "FP-055" "Plaintext inter-service communication references"
else
  gate_fail "FP-055" "Plaintext inter-service communication references" "$(echo "$FP055_MATCHES" | wc -l) violation(s) found"
fi

# ─── FP-056: Hardcoded Secrets ──────────────────────────────────────────────
# Part 30 (ZTS-013): ZERO secrets in source code, env vars, container images.
# Detect hardcoded API keys, passwords, tokens, secrets.

FP056_MATCHES=$(grep -rnE "(apiKey|api_key|secret|password|token|private_key|privateKey)\s*[:=]\s*['\"][^'\"]{8,}['\"]" \
  $(find_ts_files "$KERNEL_DIR") $(find_ts_files "$MODULES_DIR") 2>/dev/null || true)

if [[ -z "$FP056_MATCHES" ]]; then
  gate_pass "FP-056" "Hardcoded secrets in source code"
else
  gate_fail "FP-056" "Hardcoded secrets in source code — INCIDENT CRITICAL" "$(echo "$FP056_MATCHES" | wc -l) violation(s) found"
fi

# ─── FP-057: Shared Mutable State ──────────────────────────────────────────
# HC-08 / P-015: No shared mutable state between modules.
# Detect global mutable variables (let/var at module scope, exported).

FP057_MATCHES=$(grep -rnE "^export\s+(let|var)\s+" \
  $(find_ts_files "$KERNEL_DIR") $(find_ts_files "$MODULES_DIR") 2>/dev/null || true)

if [[ -z "$FP057_MATCHES" ]]; then
  gate_pass "FP-057" "Shared mutable state (exported let/var)"
else
  gate_fail "FP-057" "Shared mutable state (exported let/var)" "$(echo "$FP057_MATCHES" | wc -l) violation(s) found"
fi

# ─── FP-058: Undeclared Network Dependencies ───────────────────────────────
# Part 30 (ZTS-019): NetworkPolicy allowing undeclared dependencies = BLOCKED.
# Detect default-allow network policies in infrastructure files.

FP058_MATCHES=""
if [[ -d "$INFRA_DIR" ]]; then
  FP058_YAML_FILES=$(find "$INFRA_DIR" -type f \( -name "*.yaml" -o -name "*.yml" \) ! -path "*/scripts/*" 2>/dev/null || true)
  if [[ -n "$FP058_YAML_FILES" ]]; then
    FP058_MATCHES=$(grep -rnl "policyTypes.*\[\]" $FP058_YAML_FILES 2>/dev/null || true)
  fi
fi

if [[ -z "$FP058_MATCHES" ]]; then
  gate_pass "FP-058" "Undeclared network dependencies (empty policyTypes)"
else
  gate_fail "FP-058" "Undeclared network dependencies (empty policyTypes)" "Files: $FP058_MATCHES"
fi

# ─── FP-059: Default-Allow Network Policy ──────────────────────────────────
# Part 30 (ZTS-019): Default-allow policy = BUILD BLOCKED.
# Detect network policies with allow-all ingress/egress.

FP059_MATCHES=""
if [[ -d "$INFRA_DIR" ]]; then
  FP059_YAML_FILES=$(find "$INFRA_DIR" -type f \( -name "*.yaml" -o -name "*.yml" \) ! -path "*/scripts/*" 2>/dev/null || true)
  if [[ -n "$FP059_YAML_FILES" ]]; then
    FP059_MATCHES=$(grep -rnE "(ingress:\s*\[\]|egress:\s*\[\])" $FP059_YAML_FILES 2>/dev/null || true)
  fi
fi

if [[ -z "$FP059_MATCHES" ]]; then
  gate_pass "FP-059" "Default-allow network policies"
else
  gate_fail "FP-059" "Default-allow network policies" "$(echo "$FP059_MATCHES" | wc -l) violation(s) found"
fi

# ─── FP-060: Business Logic Inside Feature Flag Evaluation ─────────────────
# Part 35 (FFG-004): Flags control availability, NOT behavior.
# Detect complex logic (if/else with business operations) inside flag checks.
# Heuristic: flag-related conditionals containing DB/service calls.

FP060_MATCHES=$(grep -rnE "(featureFlag|feature_flag|isEnabled|isFeatureOn)\s*\(.*\)\s*\{" \
  $(find_ts_files "$KERNEL_DIR") $(find_ts_files "$MODULES_DIR") 2>/dev/null || true)

if [[ -z "$FP060_MATCHES" ]]; then
  gate_pass "FP-060" "Business logic inside feature flag evaluation"
else
  gate_fail "FP-060" "Business logic inside feature flag evaluation" "$(echo "$FP060_MATCHES" | wc -l) suspicious pattern(s) found — manual review required"
fi

# ─── FP-061: Feature Flag Without Planned Removal Date ─────────────────────
# Part 35 (FFG-003): Every flag SHALL have planned_removal_date (MANDATORY).
# Detect flag definitions without removal date.
# Heuristic: flag registration calls missing 'plannedRemoval' or 'removal'.

FP061_MATCHES=""
FLAG_DEFS=$(grep -rlE "(registerFlag|createFlag|addFlag)\s*\(" \
  $(find_ts_files "$KERNEL_DIR") $(find_ts_files "$MODULES_DIR") 2>/dev/null || true)

if [[ -n "$FLAG_DEFS" ]]; then
  # For each file containing flag registration, check if plannedRemoval exists
  for flagfile in $FLAG_DEFS; do
    if ! grep -qiE "(plannedRemoval|planned_removal|removal_date|removalDate)" "$flagfile" 2>/dev/null; then
      FP061_MATCHES="${FP061_MATCHES}${flagfile} "
    fi
  done
fi

if [[ -z "$FP061_MATCHES" ]]; then
  gate_pass "FP-061" "Feature flag without planned removal date"
else
  gate_fail "FP-061" "Feature flag without planned removal date" "Flags missing removal date: $FP061_MATCHES"
fi

# ─── FP-062: Hardcoded User-Facing Strings ─────────────────────────────────
# Part 39 (i18n): ZERO hardcoded user-facing strings.
# Detect string literals in response/error messages not from i18n.
# Heuristic: throw new Error('...') or res.send('...') with inline strings.
# Note: Kernel error factories are exempt (they are the centralized source).

FP062_MATCHES=$(grep -rnE "(res\.(send|json|status)\s*\(\s*['\"]|new\s+HttpException\s*\(\s*['\"])" \
  $(find_ts_files "$KERNEL_DIR") $(find_ts_files "$MODULES_DIR") 2>/dev/null || true)

if [[ -z "$FP062_MATCHES" ]]; then
  gate_pass "FP-062" "Hardcoded user-facing strings (non-i18n)"
else
  gate_fail "FP-062" "Hardcoded user-facing strings (non-i18n)" "$(echo "$FP062_MATCHES" | wc -l) violation(s) found"
fi

# ─── FP-063: Rollback Migration in Production ──────────────────────────────
# FRZ-004: Rollback migrations are FORBIDDEN in production.
# Detect DROP/DELETE/ALTER DROP in migration files.

FP063_MATCHES=""
if [[ -n "$MIGRATION_FILES" ]]; then
  FP063_MATCHES=$(grep -rnE "(DROP\s+TABLE|DROP\s+COLUMN|DROP\s+INDEX|DROP\s+CONSTRAINT|ALTER\s+TABLE.*DROP)" \
    $MIGRATION_FILES 2>/dev/null || true)
fi

if [[ -z "$FP063_MATCHES" ]]; then
  gate_pass "FP-063" "Rollback migration patterns (DROP in migrations)"
else
  gate_fail "FP-063" "Rollback migration patterns (DROP in migrations)" "$(echo "$FP063_MATCHES" | wc -l) violation(s) found"
fi

# ─── FP-064: Cloud-Provider-Specific Code in Business Logic ────────────────
# P-009 / Part 28: Infrastructure neutrality.
# Detect direct AWS/Azure/GCP SDK imports in kernel or module code.

FP064_MATCHES=$(grep -rnE "(import.*from\s+['\"]@aws-sdk|import.*from\s+['\"]aws-sdk|import.*from\s+['\"]@azure|import.*from\s+['\"]@google-cloud)" \
  $(find_ts_files "$KERNEL_DIR") $(find_ts_files "$MODULES_DIR") 2>/dev/null || true)

if [[ -z "$FP064_MATCHES" ]]; then
  gate_pass "FP-064" "Cloud-provider-specific code in business logic"
else
  gate_fail "FP-064" "Cloud-provider-specific code in business logic" "$(echo "$FP064_MATCHES" | wc -l) violation(s) found"
fi

# ─── Summary ────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  RESULTS: $PASSED/$TOTAL_GATES PASSED, $FAILED/$TOTAL_GATES FAILED"
echo "═══════════════════════════════════════════════════════════════"

if [[ $FAILED -gt 0 ]]; then
  echo -e "\n${RED}BUILD BLOCKED${NC} — The following gates failed:${FAILURES}"
  echo ""
  exit 1
else
  echo -e "\n${GREEN}ALL GATES PASSED${NC} — v6.2 constitutional compliance verified."
  echo ""
  exit 0
fi
