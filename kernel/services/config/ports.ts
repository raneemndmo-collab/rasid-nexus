/**
 * RASID Nexus — Config Service Ports (K4)
 * Phase 0 Block B — EU-0B-003
 *
 * Hexagonal architecture port interfaces for the Config Service.
 * All infrastructure dependencies are abstracted behind these ports,
 * ensuring the service remains technology-agnostic.
 */

import {
  TenantId,
  ModuleId,
  UserId,
  ConfigEntry,
  Result,
} from '../../types/base';

import { ConfigSchema } from '../../interfaces/config';

// ─── Config Store Port ─────────────────────────────────────

/**
 * Port for configuration persistence.
 * Implementations may use any storage backend.
 */
export interface IConfigStorePort {
  /**
   * Retrieve a configuration entry by key, tenant, and module.
   */
  get(
    key: string,
    tenantId: TenantId,
    moduleId: ModuleId,
  ): Promise<Result<ConfigEntry | null>>;

  /**
   * Persist a new configuration entry version.
   * Must create a new version entry (immutable history).
   */
  put(entry: ConfigEntry): Promise<Result<ConfigEntry>>;

  /**
   * Retrieve all configuration entries for a module within a tenant.
   */
  getByModule(
    tenantId: TenantId,
    moduleId: ModuleId,
  ): Promise<Result<ReadonlyArray<ConfigEntry>>>;

  /**
   * Retrieve the version history of a configuration key.
   */
  getHistory(
    key: string,
    tenantId: TenantId,
    moduleId: ModuleId,
  ): Promise<Result<ReadonlyArray<ConfigEntry>>>;

  /**
   * Soft-delete a configuration key.
   * Must preserve the entry for audit trail purposes.
   */
  softDelete(
    key: string,
    tenantId: TenantId,
    moduleId: ModuleId,
    deletedBy: UserId,
  ): Promise<Result<void>>;
}

// ─── Schema Registry Port ──────────────────────────────────

/**
 * Port for configuration schema persistence and retrieval.
 */
export interface ISchemaRegistryPort {
  /**
   * Register a configuration schema for a module.
   * Overwrites any existing schema for the same module.
   */
  register(schema: ConfigSchema): Promise<Result<void>>;

  /**
   * Retrieve the configuration schema for a module.
   */
  get(moduleId: ModuleId): Promise<Result<ConfigSchema | null>>;

  /**
   * Check if a schema exists for a module.
   */
  exists(moduleId: ModuleId): Promise<Result<boolean>>;
}

// ─── Config Encryption Port ────────────────────────────────

/**
 * Port for encrypting and decrypting sensitive configuration values.
 * Implementations may use any encryption mechanism.
 */
export interface IConfigEncryptionPort {
  /**
   * Encrypt a configuration value.
   */
  encrypt(value: string, tenantId: TenantId): Promise<Result<string>>;

  /**
   * Decrypt a configuration value.
   */
  decrypt(encrypted: string, tenantId: TenantId): Promise<Result<string>>;
}

// ─── Config Validator ──────────────────────────────────────

/**
 * Validation result for a configuration value against its schema.
 */
export interface ConfigValidationResult {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<ConfigValidationError>;
}

export interface ConfigValidationError {
  readonly field: string;
  readonly message: string;
  readonly expected: string;
  readonly received: string;
}
