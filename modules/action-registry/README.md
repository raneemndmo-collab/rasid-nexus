# Action Registry Module (M30)

**Status:** Scaffold only — implementation in EU-0B-004.

This module implements the `IActionRegistry` interface defined in the kernel.
It tracks all actions performed across the RASID Nexus platform.

## Dependencies

- Kernel Identity Service (K1) — for authentication context
- Kernel Audit Service (K3) — for audit trail
- Kernel Event Bus — for event publishing

## Database

Uses the dedicated `rasid_action_registry` PostgreSQL database with RLS.

## NATS Streams

- `kernel-actions` — action lifecycle events
