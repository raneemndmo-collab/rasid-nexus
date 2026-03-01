/**
 * RASID Nexus — Kernel Public API
 * Phase 0 Block B — EU-0B-001
 *
 * This is the single entry point for all kernel exports.
 * Modules MUST only import from '@rasid-nexus/kernel'.
 * Direct imports from internal paths are prohibited.
 */

// ─── Types ─────────────────────────────────────────────────
export * from './types/base';

// ─── Service Interfaces ────────────────────────────────────
export * from './interfaces/identity';
export * from './interfaces/config';
export * from './interfaces/audit';
export * from './interfaces/security';
export * from './interfaces/action-registry';

// ─── Events ────────────────────────────────────────────────
export * from './events/kernel-events';

// ─── Errors ────────────────────────────────────────────────
export * from './errors/kernel-errors';

// ─── Middleware ─────────────────────────────────────────────
export * from './middleware/index';

// ─── Utilities ─────────────────────────────────────────────
export * from './utils/index';

// ─── Contracts ─────────────────────────────────────────────
export * from './contracts/module-contract';
export * from './contracts/event-contract';
