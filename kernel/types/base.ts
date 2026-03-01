/**
 * RASID Nexus — Kernel Base Types
 * Phase 0 Block B — EU-0B-001
 *
 * These types form the foundational domain primitives
 * used across all kernel services and modules.
 */

// ─── Identifiers ────────────────────────────────────────────

export type TenantId = string & { readonly __brand: 'TenantId' };
export type UserId = string & { readonly __brand: 'UserId' };
export type SessionId = string & { readonly __brand: 'SessionId' };
export type CorrelationId = string & { readonly __brand: 'CorrelationId' };
export type ModuleId = string & { readonly __brand: 'ModuleId' };
export type ActionId = string & { readonly __brand: 'ActionId' };
export type ResourceId = string & { readonly __brand: 'ResourceId' };

// ─── Enums ──────────────────────────────────────────────────

export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  TENANT_ADMIN = 'TENANT_ADMIN',
  OPERATOR = 'OPERATOR',
  AUDITOR = 'AUDITOR',
  VIEWER = 'VIEWER',
  SERVICE = 'SERVICE',
}

export enum Permission {
  READ = 'READ',
  WRITE = 'WRITE',
  DELETE = 'DELETE',
  ADMIN = 'ADMIN',
  AUDIT_READ = 'AUDIT_READ',
  CONFIG_WRITE = 'CONFIG_WRITE',
}

export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  SECURITY = 'SECURITY',
}

export enum ModuleStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DEGRADED = 'DEGRADED',
  MAINTENANCE = 'MAINTENANCE',
}

// ─── Core Domain Objects ────────────────────────────────────

export interface TenantContext {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly sessionId: SessionId;
  readonly correlationId: CorrelationId;
  readonly roles: ReadonlyArray<Role>;
  readonly permissions: ReadonlyArray<Permission>;
  readonly timestamp: Date;
}

export interface AuditEntry {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly action: string;
  readonly resource: string;
  readonly resourceId: ResourceId;
  readonly severity: AuditSeverity;
  readonly correlationId: CorrelationId;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly timestamp: Date;
  readonly ip: string;
  readonly userAgent: string;
}

export interface KernelEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly source: ModuleId;
  readonly tenantId: TenantId;
  readonly correlationId: CorrelationId;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly timestamp: Date;
  readonly version: number;
}

export interface ActionRecord {
  readonly actionId: ActionId;
  readonly moduleId: ModuleId;
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly actionType: string;
  readonly status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  readonly input: Readonly<Record<string, unknown>>;
  readonly output?: Readonly<Record<string, unknown>>;
  readonly error?: string;
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly correlationId: CorrelationId;
}

export interface ConfigEntry {
  readonly key: string;
  readonly value: unknown;
  readonly tenantId: TenantId;
  readonly moduleId: ModuleId;
  readonly version: number;
  readonly updatedBy: UserId;
  readonly updatedAt: Date;
  readonly encrypted: boolean;
}

// ─── Result Types ───────────────────────────────────────────

export type Result<T, E = KernelError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export interface KernelError {
  readonly code: string;
  readonly message: string;
  readonly severity: AuditSeverity;
  readonly correlationId?: CorrelationId;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

// ─── Pagination ─────────────────────────────────────────────

export interface PaginationRequest {
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy?: string;
  readonly sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResponse<T> {
  readonly data: ReadonlyArray<T>;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

// ─── Health ─────────────────────────────────────────────────

export interface HealthStatus {
  readonly service: string;
  readonly status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  readonly version: string;
  readonly uptime: number;
  readonly dependencies: ReadonlyArray<DependencyHealth>;
  readonly timestamp: Date;
}

export interface DependencyHealth {
  readonly name: string;
  readonly status: 'UP' | 'DOWN' | 'DEGRADED';
  readonly latencyMs: number;
  readonly lastChecked: Date;
}
