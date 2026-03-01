/**
 * RASID Nexus — Config Service Interface (K2)
 * Phase 0 Block B — EU-0B-001
 *
 * Contract for the Configuration Management kernel service.
 */

import {
  TenantId,
  ModuleId,
  ConfigEntry,
  TenantContext,
  Result,
} from '../types/base';

// ─── Service Interface ──────────────────────────────────────

export interface IConfigService {
  /**
   * Get a configuration value by key for a specific tenant and module.
   */
  get<T = unknown>(
    key: string,
    tenantId: TenantId,
    moduleId: ModuleId,
  ): Promise<Result<T>>;

  /**
   * Set a configuration value.
   * Creates a new version entry (immutable history).
   */
  set(
    key: string,
    value: unknown,
    tenantId: TenantId,
    moduleId: ModuleId,
    context: TenantContext,
  ): Promise<Result<ConfigEntry>>;

  /**
   * Get all configuration entries for a module within a tenant.
   */
  getModuleConfig(
    tenantId: TenantId,
    moduleId: ModuleId,
  ): Promise<Result<ReadonlyArray<ConfigEntry>>>;

  /**
   * Get the version history of a configuration key.
   */
  getHistory(
    key: string,
    tenantId: TenantId,
    moduleId: ModuleId,
  ): Promise<Result<ReadonlyArray<ConfigEntry>>>;

  /**
   * Delete a configuration key (soft delete with audit trail).
   */
  delete(
    key: string,
    tenantId: TenantId,
    moduleId: ModuleId,
    context: TenantContext,
  ): Promise<Result<void>>;

  /**
   * Validate a configuration value against its schema.
   */
  validate(
    key: string,
    value: unknown,
    moduleId: ModuleId,
  ): Promise<Result<boolean>>;

  /**
   * Register a configuration schema for a module.
   */
  registerSchema(
    moduleId: ModuleId,
    schema: ConfigSchema,
    context: TenantContext,
  ): Promise<Result<void>>;
}

// ─── Supporting Types ───────────────────────────────────────

export interface ConfigSchema {
  readonly moduleId: ModuleId;
  readonly entries: ReadonlyArray<ConfigSchemaEntry>;
  readonly version: number;
}

export interface ConfigSchemaEntry {
  readonly key: string;
  readonly type: 'string' | 'number' | 'boolean' | 'json' | 'encrypted';
  readonly required: boolean;
  readonly defaultValue?: unknown;
  readonly description: string;
  readonly validationRule?: string;
}
