/**
 * RASID Nexus — Module Contract
 * Phase 0 Block B — EU-0B-001
 *
 * Defines the contract that every module must implement
 * to register with the kernel. This is the boundary
 * between kernel and module layers.
 */

import {
  ModuleId,
  ModuleStatus,
  HealthStatus,
  Permission,
  Result,
} from '../types/base';

// ─── Module Lifecycle ──────────────────────────────────────

export interface IModuleContract {
  /**
   * Unique module identifier.
   * Must be registered in the kernel module registry.
   */
  readonly moduleId: ModuleId;

  /**
   * Human-readable module name.
   */
  readonly name: string;

  /**
   * Semantic version of the module.
   */
  readonly version: string;

  /**
   * Module description.
   */
  readonly description: string;

  /**
   * Initialize the module.
   * Called once during kernel bootstrap.
   * Must register event handlers, config schemas, and routes.
   */
  initialize(context: ModuleBootstrapContext): Promise<Result<void>>;

  /**
   * Start the module after all modules are initialized.
   * Called after all initialize() calls succeed.
   */
  start(): Promise<Result<void>>;

  /**
   * Graceful shutdown.
   * Must release all resources and complete pending operations.
   */
  shutdown(): Promise<Result<void>>;

  /**
   * Health check for the module.
   */
  healthCheck(): Promise<HealthStatus>;

  /**
   * Get current module status.
   */
  getStatus(): ModuleStatus;
}

// ─── Bootstrap Context ─────────────────────────────────────

export interface ModuleBootstrapContext {
  /**
   * Register an event handler for a specific event type.
   */
  readonly onEvent: (eventType: string, handler: EventHandler) => void;

  /**
   * Publish an event to the kernel event bus.
   */
  readonly publishEvent: (eventType: string, payload: Record<string, unknown>) => Promise<void>;

  /**
   * Register a configuration schema for this module.
   */
  readonly registerConfigSchema: (schema: ModuleConfigSchema) => Promise<void>;

  /**
   * Get a configuration value.
   */
  readonly getConfig: <T = unknown>(key: string) => Promise<T | undefined>;

  /**
   * Register required permissions for this module.
   */
  readonly registerPermissions: (permissions: ReadonlyArray<ModulePermission>) => void;

  /**
   * Get the module's assigned database connection string.
   */
  readonly getDatabaseUrl: () => string;

  /**
   * Get the module's assigned NATS subject prefix.
   */
  readonly getEventSubjectPrefix: () => string;
}

// ─── Supporting Types ──────────────────────────────────────

export type EventHandler = (payload: Record<string, unknown>) => Promise<void>;

export interface ModuleConfigSchema {
  readonly entries: ReadonlyArray<{
    readonly key: string;
    readonly type: 'string' | 'number' | 'boolean' | 'json' | 'encrypted';
    readonly required: boolean;
    readonly defaultValue?: unknown;
    readonly description: string;
  }>;
}

export interface ModulePermission {
  readonly permission: Permission;
  readonly resource: string;
  readonly description: string;
}

// ─── Module Registry Entry ─────────────────────────────────

export interface ModuleRegistryEntry {
  readonly moduleId: ModuleId;
  readonly name: string;
  readonly version: string;
  readonly status: ModuleStatus;
  readonly registeredAt: Date;
  readonly dependencies: ReadonlyArray<ModuleId>;
  readonly permissions: ReadonlyArray<ModulePermission>;
}
