/**
 * RASID Nexus — Feature Flag Scaffold (K4)
 * Phase 0 Block B — EU-0B-003
 *
 * Implements the Feature Flag capability as mandated by:
 * - v6.2 Constitution Part 35 (FFG-001): Feature flag governance
 * - v6.2 Constitution Part 35 (FFG-003): Planned removal date mandatory
 *
 * This is a scaffold — no business logic is embedded in flag evaluation.
 * The registry tracks flags, their states, and planned removal dates.
 * Evaluation is a pure lookup with no conditional business branching.
 */

import {
  TenantId,
  ModuleId,
  UserId,
  Result,
} from '../../types/base';

import { ok, err, nowUTC } from '../../utils';
import { ErrorCode, configError } from '../../errors/kernel-errors';

// ─── Feature Flag Types ────────────────────────────────────

/**
 * Feature flag definition.
 * Every flag MUST have a plannedRemovalDate (FFG-003).
 */
export interface FeatureFlag {
  readonly flagId: string;
  readonly name: string;
  readonly description: string;
  readonly moduleId: ModuleId;
  readonly flagType: FeatureFlagType;
  readonly enabled: boolean;
  readonly plannedRemovalDate: Date;
  readonly createdBy: UserId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Feature flag types as defined by FFG-001.
 * - release: Gradual rollout of new features
 * - experiment: A/B testing and experimentation
 * - operational: Kill switches and circuit breakers
 * - permission: Feature entitlement gating
 */
export type FeatureFlagType = 'release' | 'experiment' | 'operational' | 'permission';

/**
 * Tenant-specific feature flag override.
 * Allows per-tenant flag state without modifying the global flag.
 */
export interface FeatureFlagOverride {
  readonly flagId: string;
  readonly tenantId: TenantId;
  readonly enabled: boolean;
  readonly overriddenBy: UserId;
  readonly overriddenAt: Date;
  readonly reason: string;
}

/**
 * Feature flag evaluation result.
 * Pure data — no business logic branching.
 */
export interface FeatureFlagEvaluation {
  readonly flagId: string;
  readonly enabled: boolean;
  readonly source: 'global' | 'tenant-override';
  readonly evaluatedAt: Date;
}

// ─── Feature Flag Store Port ───────────────────────────────

/**
 * Port for feature flag persistence.
 * Implementations may use any storage backend.
 */
export interface IFeatureFlagStorePort {
  /**
   * Retrieve a feature flag by ID.
   */
  get(flagId: string): Promise<Result<FeatureFlag | null>>;

  /**
   * Retrieve all feature flags for a module.
   */
  getByModule(moduleId: ModuleId): Promise<Result<ReadonlyArray<FeatureFlag>>>;

  /**
   * Persist a new feature flag.
   */
  create(flag: FeatureFlag): Promise<Result<FeatureFlag>>;

  /**
   * Update a feature flag's enabled state.
   */
  updateState(
    flagId: string,
    enabled: boolean,
    updatedBy: UserId,
  ): Promise<Result<FeatureFlag>>;

  /**
   * Retrieve tenant-specific override for a flag.
   */
  getOverride(
    flagId: string,
    tenantId: TenantId,
  ): Promise<Result<FeatureFlagOverride | null>>;

  /**
   * Set a tenant-specific override for a flag.
   */
  setOverride(override: FeatureFlagOverride): Promise<Result<void>>;

  /**
   * Remove a tenant-specific override.
   */
  removeOverride(
    flagId: string,
    tenantId: TenantId,
  ): Promise<Result<void>>;

  /**
   * Retrieve all flags that have passed their planned removal date.
   */
  getExpiredFlags(): Promise<Result<ReadonlyArray<FeatureFlag>>>;
}

// ─── Feature Flag Registry ─────────────────────────────────

/**
 * Feature Flag Registry — the core scaffold for flag management.
 *
 * Responsibilities:
 * - Register new flags with mandatory plannedRemovalDate (FFG-003)
 * - Evaluate flag state (global + tenant override)
 * - Track expired flags for cleanup
 *
 * Constraints:
 * - No business logic in evaluation (FP-060 compliance)
 * - Pure data lookup only
 * - All flags must have plannedRemovalDate
 */
export class FeatureFlagRegistry {
  private readonly store: IFeatureFlagStorePort;

  constructor(store: IFeatureFlagStorePort) {
    this.store = store;
  }

  /**
   * Register a new feature flag.
   * Enforces FFG-003: plannedRemovalDate is mandatory.
   */
  async registerFlag(
    flagId: string,
    name: string,
    description: string,
    moduleId: ModuleId,
    flagType: FeatureFlagType,
    plannedRemovalDate: Date,
    createdBy: UserId,
    metadata?: Readonly<Record<string, unknown>>,
  ): Promise<Result<FeatureFlag>> {
    // FFG-003 enforcement: planned removal date is mandatory
    if (!plannedRemovalDate || isNaN(plannedRemovalDate.getTime())) {
      return err<FeatureFlag>(
        configError(
          ErrorCode.CONFIG_VALIDATION_FAILED,
          `Feature flag '${flagId}' must have a valid plannedRemovalDate (FFG-003)`,
        ),
      );
    }

    const now = nowUTC();
    const flag: FeatureFlag = {
      flagId,
      name,
      description,
      moduleId,
      flagType,
      enabled: false, // Flags start disabled by default
      plannedRemovalDate,
      createdBy,
      createdAt: now,
      updatedAt: now,
      metadata: metadata ?? {},
    };

    return this.store.create(flag);
  }

  /**
   * Evaluate a feature flag for a specific tenant.
   * Returns the effective state considering tenant overrides.
   *
   * This is a pure data lookup — no business logic branching (FP-060).
   */
  async evaluate(
    flagId: string,
    tenantId: TenantId,
  ): Promise<Result<FeatureFlagEvaluation>> {
    // Retrieve the global flag definition
    const flagResult = await this.store.get(flagId);
    if (!flagResult.ok) {
      return err<FeatureFlagEvaluation>(flagResult.error);
    }

    if (flagResult.value === null) {
      return err<FeatureFlagEvaluation>(
        configError(
          ErrorCode.CONFIG_NOT_FOUND,
          `Feature flag '${flagId}' not found`,
        ),
      );
    }

    const flag = flagResult.value;

    // Check for tenant-specific override
    const overrideResult = await this.store.getOverride(flagId, tenantId);
    if (overrideResult.ok && overrideResult.value !== null) {
      return ok({
        flagId,
        enabled: overrideResult.value.enabled,
        source: 'tenant-override' as const,
        evaluatedAt: nowUTC(),
      });
    }

    // Return global state
    return ok({
      flagId,
      enabled: flag.enabled,
      source: 'global' as const,
      evaluatedAt: nowUTC(),
    });
  }

  /**
   * Update a feature flag's enabled state.
   */
  async setFlagState(
    flagId: string,
    enabled: boolean,
    updatedBy: UserId,
  ): Promise<Result<FeatureFlag>> {
    return this.store.updateState(flagId, enabled, updatedBy);
  }

  /**
   * Set a tenant-specific override for a feature flag.
   */
  async setTenantOverride(
    flagId: string,
    tenantId: TenantId,
    enabled: boolean,
    overriddenBy: UserId,
    reason: string,
  ): Promise<Result<void>> {
    const override: FeatureFlagOverride = {
      flagId,
      tenantId,
      enabled,
      overriddenBy,
      overriddenAt: nowUTC(),
      reason,
    };
    return this.store.setOverride(override);
  }

  /**
   * Remove a tenant-specific override.
   */
  async removeTenantOverride(
    flagId: string,
    tenantId: TenantId,
  ): Promise<Result<void>> {
    return this.store.removeOverride(flagId, tenantId);
  }

  /**
   * Retrieve all flags for a module.
   */
  async getModuleFlags(
    moduleId: ModuleId,
  ): Promise<Result<ReadonlyArray<FeatureFlag>>> {
    return this.store.getByModule(moduleId);
  }

  /**
   * Retrieve all flags that have passed their planned removal date.
   * Used for governance auditing and cleanup tracking.
   */
  async getExpiredFlags(): Promise<Result<ReadonlyArray<FeatureFlag>>> {
    return this.store.getExpiredFlags();
  }
}
