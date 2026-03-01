#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# v6.2 CI Gates — Violation Detection Test
# ═══════════════════════════════════════════════════════════════════════════════
# Creates synthetic violations in a temporary directory, runs v62-gates.sh,
# and verifies each gate correctly triggers FAIL.
# This script does NOT modify any real source files.
# ═══════════════════════════════════════════════════════════════════════════════

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATES_SCRIPT="$SCRIPT_DIR/v62-gates.sh"

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

echo "═══════════════════════════════════════════════════════════════"
echo "  v6.2 CI Gates — Violation Detection Test"
echo "  Temp dir: $TMPDIR"
echo "═══════════════════════════════════════════════════════════════"
echo ""

TOTAL=15
DETECTED=0

# Helper: run gates against temp dir and check if specific FP fails
run_gate_test() {
  local fp="$1"
  local desc="$2"
  local output
  output=$($GATES_SCRIPT --scan-dir "$TMPDIR" 2>&1 || true)
  if echo "$output" | grep -q "FAIL.*$fp"; then
    echo "  DETECTED  $fp: $desc"
    DETECTED=$((DETECTED + 1))
  else
    echo "  MISSED    $fp: $desc"
    echo "            Output: $(echo "$output" | grep -E "(PASS|FAIL).*$fp" || echo 'gate not found')"
  fi
}

# ─── FP-050: PII in log statements ─────────────────────────────────────────
mkdir -p "$TMPDIR/kernel/services"
cat > "$TMPDIR/kernel/services/bad-log.ts" << 'EOF'
console.log("User email is: " + email + "@example.com");
EOF
run_gate_test "FP-050" "PII in log statements"
rm -f "$TMPDIR/kernel/services/bad-log.ts"

# ─── FP-051: Unclassified data fields in migrations ────────────────────────
mkdir -p "$TMPDIR/migrations"
cat > "$TMPDIR/migrations/001_create_users.sql" << 'EOF'
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(100)
);
EOF
run_gate_test "FP-051" "Unclassified data fields in schema migrations"
rm -rf "$TMPDIR/migrations"

# ─── FP-052: Direct database/ORM imports ───────────────────────────────────
cat > "$TMPDIR/kernel/services/bad-import.ts" << 'EOF'
import { PrismaClient } from 'prisma';
const db = new PrismaClient();
EOF
run_gate_test "FP-052" "Direct database/ORM imports"
rm -f "$TMPDIR/kernel/services/bad-import.ts"

# ─── FP-053: PII in event payloads ─────────────────────────────────────────
mkdir -p "$TMPDIR/kernel/events"
cat > "$TMPDIR/kernel/events/bad-event.ts" << 'EOF'
export interface UserCreatedPayload {
  email: string;
  password: string;
  phone: string;
}
EOF
run_gate_test "FP-053" "PII in event payloads"
rm -f "$TMPDIR/kernel/events/bad-event.ts"

# ─── FP-054: Cross-module source code imports ──────────────────────────────
mkdir -p "$TMPDIR/modules/m1"
cat > "$TMPDIR/modules/m1/service.ts" << 'EOF'
import { IdentityService } from '../../kernel/services/identity';
EOF
run_gate_test "FP-054" "Cross-module source code imports"
rm -f "$TMPDIR/modules/m1/service.ts"

# ─── FP-055: Plaintext inter-service communication ─────────────────────────
cat > "$TMPDIR/kernel/services/bad-http.ts" << 'EOF'
const url = "http://localhost:3000/api/users";
fetch(url);
EOF
run_gate_test "FP-055" "Plaintext inter-service communication"
rm -f "$TMPDIR/kernel/services/bad-http.ts"

# ─── FP-056: Hardcoded secrets ─────────────────────────────────────────────
cat > "$TMPDIR/kernel/services/bad-secret.ts" << 'EOF'
const apiKey = 'sk-1234567890abcdefghijklmnop';
const secret = "my-super-secret-password-12345";
EOF
run_gate_test "FP-056" "Hardcoded secrets"
rm -f "$TMPDIR/kernel/services/bad-secret.ts"

# ─── FP-057: Shared mutable state ──────────────────────────────────────────
cat > "$TMPDIR/kernel/services/bad-mutable.ts" << 'EOF'
export let globalCounter = 0;
export var sharedState = {};
EOF
run_gate_test "FP-057" "Shared mutable state (exported let/var)"
rm -f "$TMPDIR/kernel/services/bad-mutable.ts"

# ─── FP-058: Undeclared network dependencies ───────────────────────────────
mkdir -p "$TMPDIR/infra"
cat > "$TMPDIR/infra/network-policy.yaml" << 'EOF'
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: bad-policy
spec:
  policyTypes []
EOF
run_gate_test "FP-058" "Undeclared network dependencies"
rm -f "$TMPDIR/infra/network-policy.yaml"

# ─── FP-059: Default-allow network policies ────────────────────────────────
cat > "$TMPDIR/infra/allow-all.yaml" << 'EOF'
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-all
spec:
  ingress: []
  egress: []
EOF
run_gate_test "FP-059" "Default-allow network policies"
rm -f "$TMPDIR/infra/allow-all.yaml"

# ─── FP-060: Business logic inside feature flag evaluation ──────────────────
cat > "$TMPDIR/kernel/services/bad-flag.ts" << 'EOF'
if (featureFlag('new-pricing').isEnabled()) {
  calculateNewPricing();
}
EOF
run_gate_test "FP-060" "Business logic inside feature flag evaluation"
rm -f "$TMPDIR/kernel/services/bad-flag.ts"

# ─── FP-061: Feature flag without planned removal date ─────────────────────
cat > "$TMPDIR/kernel/services/bad-flag-reg.ts" << 'EOF'
registerFlag('dark-mode', {
  description: 'Enable dark mode',
  type: 'release',
  enabled: false,
});
EOF
run_gate_test "FP-061" "Feature flag without planned removal date"
rm -f "$TMPDIR/kernel/services/bad-flag-reg.ts"

# ─── FP-062: Hardcoded user-facing strings ──────────────────────────────────
cat > "$TMPDIR/kernel/services/bad-response.ts" << 'EOF'
res.send('User not found');
res.json('Operation completed successfully');
EOF
run_gate_test "FP-062" "Hardcoded user-facing strings"
rm -f "$TMPDIR/kernel/services/bad-response.ts"

# ─── FP-063: Rollback migration patterns ───────────────────────────────────
mkdir -p "$TMPDIR/migrations"
cat > "$TMPDIR/migrations/002_rollback.sql" << 'EOF'
DROP TABLE users;
ALTER TABLE sessions DROP COLUMN token;
EOF
run_gate_test "FP-063" "Rollback migration patterns"
rm -rf "$TMPDIR/migrations"

# ─── FP-064: Cloud-provider-specific code ───────────────────────────────────
cat > "$TMPDIR/kernel/services/bad-cloud.ts" << 'EOF'
import { S3Client } from '@aws-sdk/client-s3';
import { BlobServiceClient } from '@azure/storage-blob';
EOF
run_gate_test "FP-064" "Cloud-provider-specific code"
rm -f "$TMPDIR/kernel/services/bad-cloud.ts"

# ─── Summary ────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  VIOLATION DETECTION: $DETECTED/$TOTAL gates correctly triggered FAIL"
echo "═══════════════════════════════════════════════════════════════"

if [[ $DETECTED -eq $TOTAL ]]; then
  echo "  ALL GATES VERIFIED — violations correctly detected."
  exit 0
else
  echo "  WARNING: $((TOTAL - DETECTED)) gates did not detect violations."
  exit 1
fi
