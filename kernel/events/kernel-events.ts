/**
 * RASID Nexus — Kernel Event Definitions
 * Phase 0 Block B — EU-0B-001
 *
 * All kernel-level event types and their payloads.
 * These events are published to the NATS event bus.
 */

import {
  TenantId,
  UserId,
  SessionId,
  ModuleId,
  ActionId,
  Role,
  AuditSeverity,
} from '../types/base';

// ─── Event Type Constants ───────────────────────────────────

export const KernelEventTypes = {
  // Identity (K1)
  USER_AUTHENTICATED: 'kernel.identity.user.authenticated',
  USER_LOGOUT: 'kernel.identity.user.logout',
  TOKEN_REFRESHED: 'kernel.identity.token.refreshed',
  SESSION_REVOKED: 'kernel.identity.session.revoked',
  ROLE_ASSIGNED: 'kernel.identity.role.assigned',
  ROLE_REVOKED: 'kernel.identity.role.revoked',
  AUTH_FAILED: 'kernel.identity.auth.failed',

  // Config (K2)
  CONFIG_UPDATED: 'kernel.config.updated',
  CONFIG_DELETED: 'kernel.config.deleted',
  CONFIG_SCHEMA_REGISTERED: 'kernel.config.schema.registered',

  // Audit (K3)
  AUDIT_ENTRY_CREATED: 'kernel.audit.entry.created',
  AUDIT_SECURITY_ALERT: 'kernel.audit.security.alert',

  // Security (K4)
  PERMISSION_DENIED: 'kernel.security.permission.denied',
  TENANT_VIOLATION: 'kernel.security.tenant.violation',
  RATE_LIMIT_EXCEEDED: 'kernel.security.rate.exceeded',

  // Action Registry (M30)
  ACTION_REGISTERED: 'kernel.action.registered',
  ACTION_COMPLETED: 'kernel.action.completed',
  ACTION_FAILED: 'kernel.action.failed',
  ACTION_ROLLED_BACK: 'kernel.action.rolledback',
} as const;

export type KernelEventType = typeof KernelEventTypes[keyof typeof KernelEventTypes];

// ─── Event Payloads ─────────────────────────────────────────

export interface UserAuthenticatedPayload {
  readonly userId: UserId;
  readonly tenantId: TenantId;
  readonly sessionId: SessionId;
  readonly ip: string;
  readonly method: 'password' | 'mfa' | 'sso' | 'api_key';
}

export interface AuthFailedPayload {
  readonly username: string;
  readonly tenantId: TenantId;
  readonly ip: string;
  readonly reason: string;
  readonly attemptCount: number;
}

export interface RoleChangedPayload {
  readonly userId: UserId;
  readonly tenantId: TenantId;
  readonly role: Role;
  readonly changedBy: UserId;
}

export interface ConfigUpdatedPayload {
  readonly key: string;
  readonly moduleId: ModuleId;
  readonly tenantId: TenantId;
  readonly previousVersion: number;
  readonly newVersion: number;
  readonly updatedBy: UserId;
}

export interface SecurityAlertPayload {
  readonly severity: AuditSeverity;
  readonly type: 'permission_denied' | 'tenant_violation' | 'rate_exceeded' | 'injection_attempt';
  readonly userId: UserId;
  readonly tenantId: TenantId;
  readonly resource: string;
  readonly ip: string;
  readonly details: string;
}

export interface ActionEventPayload {
  readonly actionId: ActionId;
  readonly moduleId: ModuleId;
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly actionType: string;
  readonly status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
}
