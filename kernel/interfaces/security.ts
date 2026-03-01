/**
 * RASID Nexus — Security Enforcement Interface (K4)
 * Phase 0 Block B — EU-0B-001
 *
 * Contract for the Security Enforcement kernel hooks.
 */

import {
  TenantId,
  UserId,
  Permission,
  Role,
  TenantContext,
  Result,
} from '../types/base';

// ─── Service Interface ──────────────────────────────────────

export interface ISecurityService {
  /**
   * Enforce permission check. Throws if denied.
   */
  enforce(
    context: TenantContext,
    permission: Permission,
    resource: string,
    resourceId?: string,
  ): Promise<Result<void>>;

  /**
   * Check tenant isolation — verify the requesting user
   * belongs to the target tenant.
   */
  enforceTenantIsolation(
    context: TenantContext,
    targetTenantId: TenantId,
  ): Result<void>;

  /**
   * Validate that a request is not attempting
   * cross-tenant data access.
   */
  validateTenantBoundary(
    context: TenantContext,
    resourceTenantId: TenantId,
  ): Result<void>;

  /**
   * Rate limit check for a specific action.
   */
  checkRateLimit(
    userId: UserId,
    tenantId: TenantId,
    action: string,
  ): Promise<Result<RateLimitStatus>>;

  /**
   * Sanitize input to prevent injection attacks.
   */
  sanitizeInput(input: string): string;

  /**
   * Validate request integrity (HMAC, signature, etc.).
   */
  validateRequestIntegrity(
    payload: string,
    signature: string,
    secret: string,
  ): Result<boolean>;
}

// ─── Supporting Types ───────────────────────────────────────

export interface RateLimitStatus {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: Date;
  readonly limit: number;
}

export interface SecurityPolicy {
  readonly resource: string;
  readonly requiredPermissions: ReadonlyArray<Permission>;
  readonly requiredRoles: ReadonlyArray<Role>;
  readonly tenantIsolated: boolean;
  readonly rateLimited: boolean;
  readonly rateLimit?: {
    readonly maxRequests: number;
    readonly windowSeconds: number;
  };
}
