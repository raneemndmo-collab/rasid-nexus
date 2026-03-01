/**
 * RASID Nexus — Kernel Middleware Definitions
 * Phase 0 Block B — EU-0B-001
 *
 * Middleware interfaces for the request pipeline.
 * All requests pass through these middleware layers.
 */

import { TenantContext } from '../types/base';

// ─── Middleware Pipeline ────────────────────────────────────

export interface MiddlewareContext {
  readonly tenantContext: TenantContext;
  readonly path: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly startTime: Date;
}

export interface IMiddleware {
  readonly name: string;
  readonly order: number;
  execute(ctx: MiddlewareContext, next: () => Promise<void>): Promise<void>;
}

// ─── Middleware Order Constants ──────────────────────────────

export const MiddlewareOrder = {
  CORRELATION_ID: 10,
  RATE_LIMIT: 20,
  AUTHENTICATION: 30,
  TENANT_RESOLUTION: 40,
  AUTHORIZATION: 50,
  INPUT_VALIDATION: 60,
  AUDIT_LOG: 70,
  ERROR_HANDLER: 999,
} as const;

// ─── Middleware Interfaces ──────────────────────────────────

export interface IAuthenticationMiddleware extends IMiddleware {
  readonly name: 'authentication';
}

export interface ITenantResolutionMiddleware extends IMiddleware {
  readonly name: 'tenant-resolution';
}

export interface IAuthorizationMiddleware extends IMiddleware {
  readonly name: 'authorization';
}

export interface IAuditMiddleware extends IMiddleware {
  readonly name: 'audit';
}

export interface IRateLimitMiddleware extends IMiddleware {
  readonly name: 'rate-limit';
}

export interface ICorrelationMiddleware extends IMiddleware {
  readonly name: 'correlation-id';
}
