/**
 * RASID Nexus — Kernel Error Types
 * Phase 0 Block B — EU-0B-001
 *
 * Standardized error codes and factory functions
 * for all kernel-level errors.
 */

import { KernelError, AuditSeverity, CorrelationId } from '../types/base';

// ─── Error Codes ────────────────────────────────────────────

export enum ErrorCode {
  // Authentication (K1)
  AUTH_INVALID_CREDENTIALS = 'K1_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED = 'K1_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID = 'K1_TOKEN_INVALID',
  AUTH_SESSION_REVOKED = 'K1_SESSION_REVOKED',
  AUTH_MFA_REQUIRED = 'K1_MFA_REQUIRED',
  AUTH_ACCOUNT_LOCKED = 'K1_ACCOUNT_LOCKED',

  // Authorization (K1/K4)
  AUTHZ_PERMISSION_DENIED = 'K4_PERMISSION_DENIED',
  AUTHZ_ROLE_INSUFFICIENT = 'K4_ROLE_INSUFFICIENT',
  AUTHZ_TENANT_VIOLATION = 'K4_TENANT_VIOLATION',
  AUTHZ_RATE_LIMITED = 'K4_RATE_LIMITED',

  // Configuration (K2)
  CONFIG_NOT_FOUND = 'K2_CONFIG_NOT_FOUND',
  CONFIG_VALIDATION_FAILED = 'K2_VALIDATION_FAILED',
  CONFIG_SCHEMA_MISMATCH = 'K2_SCHEMA_MISMATCH',
  CONFIG_FROZEN = 'K2_CONFIG_FROZEN',

  // Audit (K3)
  AUDIT_WRITE_FAILED = 'K3_WRITE_FAILED',
  AUDIT_QUERY_FAILED = 'K3_QUERY_FAILED',

  // General
  INTERNAL_ERROR = 'KERNEL_INTERNAL_ERROR',
  VALIDATION_ERROR = 'KERNEL_VALIDATION_ERROR',
  NOT_FOUND = 'KERNEL_NOT_FOUND',
  CONFLICT = 'KERNEL_CONFLICT',
  SERVICE_UNAVAILABLE = 'KERNEL_SERVICE_UNAVAILABLE',
}

// ─── Error Factories ────────────────────────────────────────

export function authError(
  code: ErrorCode,
  message: string,
  correlationId?: CorrelationId,
): KernelError {
  return {
    code,
    message,
    severity: AuditSeverity.SECURITY,
    correlationId,
  };
}

export function configError(
  code: ErrorCode,
  message: string,
  correlationId?: CorrelationId,
): KernelError {
  return {
    code,
    message,
    severity: AuditSeverity.WARNING,
    correlationId,
  };
}

export function auditError(
  code: ErrorCode,
  message: string,
  correlationId?: CorrelationId,
): KernelError {
  return {
    code,
    message,
    severity: AuditSeverity.CRITICAL,
    correlationId,
  };
}

export function internalError(
  message: string,
  correlationId?: CorrelationId,
  metadata?: Readonly<Record<string, unknown>>,
): KernelError {
  return {
    code: ErrorCode.INTERNAL_ERROR,
    message,
    severity: AuditSeverity.CRITICAL,
    correlationId,
    metadata,
  };
}

export function validationError(
  message: string,
  correlationId?: CorrelationId,
  metadata?: Readonly<Record<string, unknown>>,
): KernelError {
  return {
    code: ErrorCode.VALIDATION_ERROR,
    message,
    severity: AuditSeverity.INFO,
    correlationId,
    metadata,
  };
}

export function notFoundError(
  resource: string,
  id: string,
  correlationId?: CorrelationId,
): KernelError {
  return {
    code: ErrorCode.NOT_FOUND,
    message: `${resource} with id '${id}' not found`,
    severity: AuditSeverity.INFO,
    correlationId,
  };
}
