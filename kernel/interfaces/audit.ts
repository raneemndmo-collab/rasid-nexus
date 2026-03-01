/**
 * RASID Nexus — Audit Service Interface (K3)
 * Phase 0 Block B — EU-0B-001
 *
 * Contract for the Audit Logging kernel service.
 */

import {
  TenantId,
  UserId,
  CorrelationId,
  AuditEntry,
  AuditSeverity,
  TenantContext,
  Result,
  PaginationRequest,
  PaginatedResponse,
} from '../types/base';

// ─── Service Interface ──────────────────────────────────────

export interface IAuditService {
  /**
   * Log an audit entry.
   * This is append-only — entries cannot be modified or deleted.
   */
  log(entry: AuditLogRequest, context: TenantContext): Promise<Result<AuditEntry>>;

  /**
   * Query audit entries with filters.
   */
  query(
    filters: AuditQueryFilters,
    pagination: PaginationRequest,
    context: TenantContext,
  ): Promise<Result<PaginatedResponse<AuditEntry>>>;

  /**
   * Get a specific audit entry by ID.
   */
  getById(
    id: string,
    tenantId: TenantId,
    context: TenantContext,
  ): Promise<Result<AuditEntry>>;

  /**
   * Get all audit entries for a specific correlation ID.
   * Used for tracing a complete operation chain.
   */
  getByCorrelation(
    correlationId: CorrelationId,
    tenantId: TenantId,
    context: TenantContext,
  ): Promise<Result<ReadonlyArray<AuditEntry>>>;

  /**
   * Get audit summary statistics for a tenant.
   */
  getSummary(
    tenantId: TenantId,
    timeRange: TimeRange,
    context: TenantContext,
  ): Promise<Result<AuditSummary>>;
}

// ─── Request Types ──────────────────────────────────────────

export interface AuditLogRequest {
  readonly action: string;
  readonly resource: string;
  readonly resourceId: string;
  readonly severity: AuditSeverity;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly ip?: string;
  readonly userAgent?: string;
}

export interface AuditQueryFilters {
  readonly tenantId: TenantId;
  readonly userId?: UserId;
  readonly action?: string;
  readonly resource?: string;
  readonly severity?: AuditSeverity;
  readonly timeRange?: TimeRange;
  readonly correlationId?: CorrelationId;
}

export interface TimeRange {
  readonly from: Date;
  readonly to: Date;
}

// ─── Response Types ─────────────────────────────────────────

export interface AuditSummary {
  readonly tenantId: TenantId;
  readonly totalEntries: number;
  readonly bySeverity: Readonly<Record<AuditSeverity, number>>;
  readonly byAction: ReadonlyArray<{ action: string; count: number }>;
  readonly timeRange: TimeRange;
}
