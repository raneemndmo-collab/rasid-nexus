/**
 * RASID Nexus — Action Registry Interface (M30)
 * Phase 0 Block B — EU-0B-001
 *
 * Contract for the Action Registry module.
 * Tracks all actions performed across the platform.
 */

import {
  ActionId,
  ModuleId,
  TenantId,
  UserId,
  ActionRecord,
  TenantContext,
  Result,
  PaginationRequest,
  PaginatedResponse,
  CorrelationId,
} from '../types/base';

// ─── Service Interface ──────────────────────────────────────

export interface IActionRegistry {
  /**
   * Register a new action (before execution).
   * Returns an ActionId for tracking.
   */
  register(
    request: ActionRegisterRequest,
    context: TenantContext,
  ): Promise<Result<ActionRecord>>;

  /**
   * Mark an action as completed.
   */
  complete(
    actionId: ActionId,
    output: Readonly<Record<string, unknown>>,
    context: TenantContext,
  ): Promise<Result<ActionRecord>>;

  /**
   * Mark an action as failed.
   */
  fail(
    actionId: ActionId,
    error: string,
    context: TenantContext,
  ): Promise<Result<ActionRecord>>;

  /**
   * Mark an action as rolled back.
   */
  rollback(
    actionId: ActionId,
    reason: string,
    context: TenantContext,
  ): Promise<Result<ActionRecord>>;

  /**
   * Get an action by ID.
   */
  getById(
    actionId: ActionId,
    context: TenantContext,
  ): Promise<Result<ActionRecord>>;

  /**
   * Query actions with filters.
   */
  query(
    filters: ActionQueryFilters,
    pagination: PaginationRequest,
    context: TenantContext,
  ): Promise<Result<PaginatedResponse<ActionRecord>>>;

  /**
   * Get all actions in a correlation chain.
   */
  getByCorrelation(
    correlationId: CorrelationId,
    context: TenantContext,
  ): Promise<Result<ReadonlyArray<ActionRecord>>>;
}

// ─── Request Types ──────────────────────────────────────────

export interface ActionRegisterRequest {
  readonly moduleId: ModuleId;
  readonly actionType: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly description?: string;
}

export interface ActionQueryFilters {
  readonly tenantId?: TenantId;
  readonly userId?: UserId;
  readonly moduleId?: ModuleId;
  readonly actionType?: string;
  readonly status?: ActionRecord['status'];
  readonly timeRange?: {
    readonly from: Date;
    readonly to: Date;
  };
}
