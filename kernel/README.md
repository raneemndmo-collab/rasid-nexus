# RASID Nexus — Kernel

The kernel is the foundational layer of the RASID Nexus platform. It provides core services that all modules depend on but cannot modify.

## Architecture

```
kernel/
├── index.ts            # Kernel public API (single entry point)
├── tsconfig.json       # TypeScript compilation configuration
├── package.json        # Package metadata and scripts
├── contracts/          # Module and event communication contracts
│   ├── module-contract.ts   # IModuleContract — module lifecycle
│   └── event-contract.ts    # IEventBus — event bus communication
├── interfaces/         # Kernel service interfaces (K1-K4, M30)
│   ├── identity.ts     # K1 — Identity & Authentication
│   ├── config.ts       # K2 — Configuration Management
│   ├── audit.ts        # K3 — Audit Logging
│   ├── security.ts     # K4 — Security Enforcement
│   └── action-registry.ts  # M30 — Action Registry
├── types/              # Base types and domain primitives
│   └── base.ts         # Branded IDs, enums, core interfaces
├── errors/             # Standardized error types
│   └── kernel-errors.ts    # Error codes and factory functions
├── events/             # Kernel event definitions
│   └── kernel-events.ts    # Event types and payloads
├── middleware/         # Kernel-level middleware pipeline
│   └── index.ts        # Middleware interfaces and ordering
├── utils/              # Kernel utilities
│   └── index.ts        # ID generators, result helpers, validators
├── identity/           # K1 implementation (EU-0B-002)
├── config/             # K2 implementation (EU-0B-002)
├── audit/              # K3 implementation (EU-0B-005)
└── security/           # K4 implementation (EU-0B-005)
```

## Kernel Services

| Service | Code | Interface | Description |
|---------|------|-----------|-------------|
| Identity & Auth | K1 | `IIdentityService` | JWT authentication, RBAC, session management |
| Configuration | K2 | `IConfigService` | Tenant-scoped config with versioning and schemas |
| Audit Logging | K3 | `IAuditService` | Append-only audit trail with correlation tracking |
| Security | K4 | `ISecurityService` | Permission enforcement, tenant isolation, rate limiting |
| Action Registry | M30 | `IActionRegistry` | Action lifecycle tracking with rollback support |

## Module Communication

Modules communicate exclusively through the kernel event bus (NATS JetStream):

1. **Module → Kernel:** Via service interfaces (dependency injection)
2. **Kernel → Module:** Via event subscriptions (pub/sub)
3. **Module → Module:** Prohibited (must go through kernel events)

## Governance

- No module may import from another module directly.
- All inter-module communication goes through the kernel event bus.
- Kernel interfaces are frozen after Phase 0.
- Any kernel modification requires constitutional approval.
- All data access is tenant-isolated via RLS.
- All operations are audit-logged.

## Execution Lock

This kernel is governed by the RASID Nexus Execution Lock. No unauthorized modifications are permitted.
