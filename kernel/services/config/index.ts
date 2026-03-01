/**
 * RASID Nexus — Config Service Barrel Export (K4)
 * Phase 0 Block B — EU-0B-003
 */

// Config Service
export { ConfigService } from './config-service';
export type { ConfigServiceDependencies } from './config-service';

// Config Ports
export type {
  IConfigStorePort,
  ISchemaRegistryPort,
  IConfigEncryptionPort,
  ConfigValidationResult,
  ConfigValidationError,
} from './ports';

// Feature Flags
export { FeatureFlagRegistry } from './feature-flags';
export type {
  FeatureFlag,
  FeatureFlagType,
  FeatureFlagOverride,
  FeatureFlagEvaluation,
  IFeatureFlagStorePort,
} from './feature-flags';

// ABAC
export { AbacPolicyEvaluator } from './abac';
export type {
  SubjectAttributes,
  ResourceAttributes,
  ActionAttributes,
  EnvironmentAttributes,
  DataClassification,
  AbacEvaluationRequest,
  AbacDecision,
  AbacPolicy,
  AbacConditions,
  IAbacPolicyStorePort,
} from './abac';
