/**
 * RASID Nexus — Config Service Implementation (K4)
 * Phase 0 Block B — EU-0B-003
 *
 * Implements the IConfigService interface with:
 * - Tenant-isolated configuration management
 * - Immutable version history
 * - Schema-based validation
 * - Encrypted value support
 * - Event emission for config changes
 *
 * Follows hexagonal architecture: all infrastructure
 * dependencies are injected via port interfaces.
 */

import {
  TenantId,
  ModuleId,
  ConfigEntry,
  TenantContext,
  Result,
} from '../../types/base';

import {
  IConfigService,
  ConfigSchema,
  ConfigSchemaEntry,
} from '../../interfaces/config';

import { IEventBus, EventPublishRequest } from '../../contracts/event-contract';
import { KernelEventTypes } from '../../events/kernel-events';
import { ErrorCode, configError } from '../../errors/kernel-errors';
import { ok, err, nowUTC, createModuleId } from '../../utils';

import {
  IConfigStorePort,
  ISchemaRegistryPort,
  IConfigEncryptionPort,
  ConfigValidationResult,
} from './ports';

// ─── Config Service Dependencies ───────────────────────────

export interface ConfigServiceDependencies {
  readonly configStore: IConfigStorePort;
  readonly schemaRegistry: ISchemaRegistryPort;
  readonly encryption: IConfigEncryptionPort;
  readonly eventBus: IEventBus;
}

// ─── Config Service Implementation ─────────────────────────

export class ConfigService implements IConfigService {
  private readonly configStore: IConfigStorePort;
  private readonly schemaRegistry: ISchemaRegistryPort;
  private readonly encryption: IConfigEncryptionPort;
  private readonly eventBus: IEventBus;

  constructor(deps: ConfigServiceDependencies) {
    this.configStore = deps.configStore;
    this.schemaRegistry = deps.schemaRegistry;
    this.encryption = deps.encryption;
    this.eventBus = deps.eventBus;
  }

  // ─── Get Configuration Value ─────────────────────────────

  async get<T = unknown>(
    key: string,
    tenantId: TenantId,
    moduleId: ModuleId,
  ): Promise<Result<T>> {
    const result = await this.configStore.get(key, tenantId, moduleId);

    if (!result.ok) {
      return result;
    }

    if (result.value === null) {
      return err<T>(
        configError(
          ErrorCode.CONFIG_NOT_FOUND,
          `Configuration key '${key}' not found for module '${moduleId}' in tenant '${tenantId}'`,
        ),
      );
    }

    const entry = result.value;

    // Decrypt if the value is encrypted
    if (entry.encrypted && typeof entry.value === 'string') {
      const decryptResult = await this.encryption.decrypt(
        entry.value,
        tenantId,
      );
      if (!decryptResult.ok) {
        return err<T>(
          configError(
            ErrorCode.CONFIG_VALIDATION_FAILED,
            `Failed to decrypt configuration key '${key}'`,
          ),
        );
      }
      return ok(this.parseValue<T>(decryptResult.value));
    }

    return ok(entry.value as T);
  }

  // ─── Set Configuration Value ─────────────────────────────

  async set(
    key: string,
    value: unknown,
    tenantId: TenantId,
    moduleId: ModuleId,
    context: TenantContext,
  ): Promise<Result<ConfigEntry>> {
    // Validate against schema if one exists
    const schemaResult = await this.schemaRegistry.get(moduleId);
    if (schemaResult.ok && schemaResult.value !== null) {
      const validation = this.validateAgainstSchema(
        key,
        value,
        schemaResult.value,
      );
      if (!validation.valid) {
        return err<ConfigEntry>(
          configError(
            ErrorCode.CONFIG_VALIDATION_FAILED,
            `Validation failed for key '${key}': ${validation.errors.map((e) => e.message).join(', ')}`,
            context.correlationId,
          ),
        );
      }
    }

    // Determine current version
    const existingResult = await this.configStore.get(key, tenantId, moduleId);
    const previousVersion =
      existingResult.ok && existingResult.value !== null
        ? existingResult.value.version
        : 0;
    const newVersion = previousVersion + 1;

    // Check if value should be encrypted
    const schemaEntry = this.findSchemaEntry(
      key,
      schemaResult.ok ? schemaResult.value : null,
    );
    const shouldEncrypt = schemaEntry?.type === 'encrypted';

    let storedValue: unknown = value;
    if (shouldEncrypt && typeof value === 'string') {
      const encryptResult = await this.encryption.encrypt(value, tenantId);
      if (!encryptResult.ok) {
        return err<ConfigEntry>(
          configError(
            ErrorCode.CONFIG_VALIDATION_FAILED,
            `Failed to encrypt configuration key '${key}'`,
            context.correlationId,
          ),
        );
      }
      storedValue = encryptResult.value;
    }

    // Create new config entry (immutable versioning)
    const entry: ConfigEntry = {
      key,
      value: storedValue,
      tenantId,
      moduleId,
      version: newVersion,
      updatedBy: context.userId,
      updatedAt: nowUTC(),
      encrypted: shouldEncrypt,
    };

    const putResult = await this.configStore.put(entry);
    if (!putResult.ok) {
      return putResult;
    }

    // Emit config updated event
    await this.emitConfigEvent(
      KernelEventTypes.CONFIG_UPDATED,
      {
        key,
        moduleId,
        tenantId,
        previousVersion,
        newVersion,
        updatedBy: context.userId,
      },
      tenantId,
      context.correlationId,
    );

    return ok(entry);
  }

  // ─── Get Module Configuration ────────────────────────────

  async getModuleConfig(
    tenantId: TenantId,
    moduleId: ModuleId,
  ): Promise<Result<ReadonlyArray<ConfigEntry>>> {
    return this.configStore.getByModule(tenantId, moduleId);
  }

  // ─── Get Configuration History ───────────────────────────

  async getHistory(
    key: string,
    tenantId: TenantId,
    moduleId: ModuleId,
  ): Promise<Result<ReadonlyArray<ConfigEntry>>> {
    return this.configStore.getHistory(key, tenantId, moduleId);
  }

  // ─── Delete Configuration ────────────────────────────────

  async delete(
    key: string,
    tenantId: TenantId,
    moduleId: ModuleId,
    context: TenantContext,
  ): Promise<Result<void>> {
    // Verify the key exists before deleting
    const existingResult = await this.configStore.get(key, tenantId, moduleId);
    if (existingResult.ok && existingResult.value === null) {
      return err<void>(
        configError(
          ErrorCode.CONFIG_NOT_FOUND,
          `Configuration key '${key}' not found for deletion`,
          context.correlationId,
        ),
      );
    }

    const deleteResult = await this.configStore.softDelete(
      key,
      tenantId,
      moduleId,
      context.userId,
    );

    if (!deleteResult.ok) {
      return deleteResult;
    }

    // Emit config deleted event
    await this.emitConfigEvent(
      KernelEventTypes.CONFIG_DELETED,
      {
        key,
        moduleId,
        tenantId,
        deletedBy: context.userId,
      },
      tenantId,
      context.correlationId,
    );

    return ok(undefined);
  }

  // ─── Validate Configuration ──────────────────────────────

  async validate(
    key: string,
    value: unknown,
    moduleId: ModuleId,
  ): Promise<Result<boolean>> {
    const schemaResult = await this.schemaRegistry.get(moduleId);

    if (!schemaResult.ok) {
      return err<boolean>(
        configError(
          ErrorCode.CONFIG_SCHEMA_MISMATCH,
          `Failed to retrieve schema for module '${moduleId}'`,
        ),
      );
    }

    if (schemaResult.value === null) {
      // No schema registered — validation passes by default
      return ok(true);
    }

    const validation = this.validateAgainstSchema(
      key,
      value,
      schemaResult.value,
    );
    return ok(validation.valid);
  }

  // ─── Register Schema ─────────────────────────────────────

  async registerSchema(
    moduleId: ModuleId,
    schema: ConfigSchema,
    context: TenantContext,
  ): Promise<Result<void>> {
    const registerResult = await this.schemaRegistry.register(schema);

    if (!registerResult.ok) {
      return registerResult;
    }

    // Emit schema registered event
    await this.emitConfigEvent(
      KernelEventTypes.CONFIG_SCHEMA_REGISTERED,
      {
        moduleId,
        schemaVersion: schema.version,
        entryCount: schema.entries.length,
        registeredBy: context.userId,
      },
      context.tenantId,
      context.correlationId,
    );

    return ok(undefined);
  }

  // ─── Private Helpers ─────────────────────────────────────

  /**
   * Validate a value against a registered schema.
   */
  private validateAgainstSchema(
    key: string,
    value: unknown,
    schema: ConfigSchema,
  ): ConfigValidationResult {
    const schemaEntry = schema.entries.find((e) => e.key === key);

    if (!schemaEntry) {
      return {
        valid: false,
        errors: [
          {
            field: key,
            message: `Key '${key}' is not defined in the schema for module '${schema.moduleId}'`,
            expected: 'defined key',
            received: 'undefined key',
          },
        ],
      };
    }

    const errors = this.validateType(key, value, schemaEntry);
    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate a value against a schema entry type.
   */
  private validateType(
    key: string,
    value: unknown,
    schemaEntry: ConfigSchemaEntry,
  ): ReadonlyArray<{ field: string; message: string; expected: string; received: string }> {
    const errors: Array<{ field: string; message: string; expected: string; received: string }> = [];

    if (value === null || value === undefined) {
      if (schemaEntry.required) {
        errors.push({
          field: key,
          message: `Required configuration key '${key}' cannot be null or undefined`,
          expected: schemaEntry.type,
          received: 'null',
        });
      }
      return errors;
    }

    switch (schemaEntry.type) {
      case 'string':
      case 'encrypted':
        if (typeof value !== 'string') {
          errors.push({
            field: key,
            message: `Expected string for key '${key}'`,
            expected: 'string',
            received: typeof value,
          });
        }
        break;
      case 'number':
        if (typeof value !== 'number') {
          errors.push({
            field: key,
            message: `Expected number for key '${key}'`,
            expected: 'number',
            received: typeof value,
          });
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push({
            field: key,
            message: `Expected boolean for key '${key}'`,
            expected: 'boolean',
            received: typeof value,
          });
        }
        break;
      case 'json':
        if (typeof value !== 'object') {
          errors.push({
            field: key,
            message: `Expected JSON object for key '${key}'`,
            expected: 'object',
            received: typeof value,
          });
        }
        break;
    }

    return errors;
  }

  /**
   * Find a schema entry by key.
   */
  private findSchemaEntry(
    key: string,
    schema: ConfigSchema | null,
  ): ConfigSchemaEntry | undefined {
    if (!schema) return undefined;
    return schema.entries.find((e) => e.key === key);
  }

  /**
   * Parse a decrypted string value back to its original type.
   */
  private parseValue<T>(value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  /**
   * Emit a configuration-related kernel event.
   */
  private async emitConfigEvent(
    eventType: string,
    payload: Record<string, unknown>,
    tenantId: TenantId,
    correlationId: import('../../types/base').CorrelationId,
  ): Promise<void> {
    const request: EventPublishRequest = {
      eventType,
      source: createModuleId('kernel.config'),
      tenantId,
      correlationId,
      payload,
    };
    await this.eventBus.publish(request);
  }
}
