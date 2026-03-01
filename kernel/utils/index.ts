/**
 * RASID Nexus — Kernel Utilities
 * Phase 0 Block B — EU-0B-001
 *
 * Shared utility functions for the kernel layer.
 */

import {
  TenantId,
  UserId,
  SessionId,
  CorrelationId,
  ModuleId,
  ActionId,
  ResourceId,
  Result,
  KernelError,
} from '../types/base';

// ─── UUID Generation ────────────────────────────────────────

/**
 * Generate a v4-format UUID string.
 * Uses a portable random generation approach without requiring
 * Node.js crypto global or external dependencies.
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── ID Generators ──────────────────────────────────────────

export function createTenantId(value: string): TenantId {
  return value as TenantId;
}

export function createUserId(value: string): UserId {
  return value as UserId;
}

export function createSessionId(value: string): SessionId {
  return value as SessionId;
}

export function createCorrelationId(value: string): CorrelationId {
  return value as CorrelationId;
}

export function createModuleId(value: string): ModuleId {
  return value as ModuleId;
}

export function createActionId(value: string): ActionId {
  return value as ActionId;
}

export function createResourceId(value: string): ResourceId {
  return value as ResourceId;
}

// ─── Result Helpers ─────────────────────────────────────────

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T>(error: KernelError): Result<T> {
  return { ok: false, error };
}

export function isOk<T>(result: Result<T>): result is { ok: true; value: T } {
  return result.ok === true;
}

export function isErr<T>(result: Result<T>): result is { ok: false; error: KernelError } {
  return result.ok === false;
}

export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw new Error(`Unwrap failed: ${result.error.code} — ${result.error.message}`);
}

// ─── Validation Helpers ─────────────────────────────────────

export function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

// ─── Date Helpers ───────────────────────────────────────────

export function nowUTC(): Date {
  return new Date(Date.now());
}

export function isExpired(expiresAt: Date): boolean {
  return nowUTC() > expiresAt;
}
