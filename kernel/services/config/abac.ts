/**
 * RASID Nexus — ABAC Policy Evaluation Hook (K4)
 * Phase 0 Block B — EU-0B-003
 *
 * Attribute-Based Access Control (ABAC) policy evaluation scaffold.
 * This module provides the policy evaluation engine that the
 * Security Service (K4) hooks into for fine-grained access decisions.
 *
 * ABAC evaluates access based on:
 * - Subject attributes (user roles, tenant, department)
 * - Resource attributes (type, classification, owner)
 * - Action attributes (read, write, delete)
 * - Environment attributes (time, IP, location)
 *
 * This is policy evaluation ONLY — no enforcement logic.
 * Enforcement is delegated to the ISecurityService.
 */

import {
  TenantId,
  UserId,
  Role,
  Permission,
  Result,
} from '../../types/base';

import { ok, err } from '../../utils';
import { ErrorCode, configError } from '../../errors/kernel-errors';

// ─── ABAC Types ────────────────────────────────────────────

/**
 * Subject attributes — who is requesting access.
 */
export interface SubjectAttributes {
  readonly userId: UserId;
  readonly tenantId: TenantId;
  readonly roles: ReadonlyArray<Role>;
  readonly permissions: ReadonlyArray<Permission>;
  readonly department?: string;
  readonly clearanceLevel?: number;
}

/**
 * Resource attributes — what is being accessed.
 */
export interface ResourceAttributes {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly ownerTenantId: TenantId;
  readonly classification: DataClassification;
  readonly ownerUserId?: UserId;
}

/**
 * Action attributes — what operation is being performed.
 */
export interface ActionAttributes {
  readonly action: string;
  readonly permission: Permission;
}

/**
 * Environment attributes — contextual conditions.
 */
export interface EnvironmentAttributes {
  readonly timestamp: Date;
  readonly ipAddress: string;
  readonly requestSource: 'internal' | 'external' | 'system';
}

/**
 * Data classification levels as defined by the v6.2 constitution.
 */
export type DataClassification =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'RESTRICTED'
  | 'TOP_SECRET';

/**
 * Complete ABAC evaluation request.
 */
export interface AbacEvaluationRequest {
  readonly subject: SubjectAttributes;
  readonly resource: ResourceAttributes;
  readonly action: ActionAttributes;
  readonly environment: EnvironmentAttributes;
}

/**
 * ABAC evaluation decision.
 */
export interface AbacDecision {
  readonly allowed: boolean;
  readonly reason: string;
  readonly matchedPolicies: ReadonlyArray<string>;
  readonly evaluatedAt: Date;
}

// ─── ABAC Policy Definition ───────────────────────────────

/**
 * An ABAC policy rule.
 * Policies are evaluated in priority order (lower number = higher priority).
 */
export interface AbacPolicy {
  readonly policyId: string;
  readonly name: string;
  readonly description: string;
  readonly priority: number;
  readonly effect: 'ALLOW' | 'DENY';
  readonly conditions: AbacConditions;
  readonly enabled: boolean;
}

/**
 * Conditions that must be met for a policy to apply.
 * All specified conditions must match (AND logic).
 * Unspecified conditions are treated as wildcards.
 */
export interface AbacConditions {
  readonly subjectRoles?: ReadonlyArray<Role>;
  readonly subjectPermissions?: ReadonlyArray<Permission>;
  readonly resourceTypes?: ReadonlyArray<string>;
  readonly resourceClassifications?: ReadonlyArray<DataClassification>;
  readonly actions?: ReadonlyArray<string>;
  readonly tenantMatch?: boolean;
  readonly requestSources?: ReadonlyArray<'internal' | 'external' | 'system'>;
  readonly minClearanceLevel?: number;
}

// ─── ABAC Policy Store Port ───────────────────────────────

/**
 * Port for ABAC policy persistence.
 * Implementations may use any storage backend.
 */
export interface IAbacPolicyStorePort {
  /**
   * Retrieve all enabled policies, ordered by priority.
   */
  getActivePolicies(): Promise<Result<ReadonlyArray<AbacPolicy>>>;

  /**
   * Retrieve policies applicable to a specific resource type.
   */
  getPoliciesForResource(
    resourceType: string,
  ): Promise<Result<ReadonlyArray<AbacPolicy>>>;

  /**
   * Register a new ABAC policy.
   */
  register(policy: AbacPolicy): Promise<Result<void>>;

  /**
   * Update an existing policy's enabled state.
   */
  setEnabled(policyId: string, enabled: boolean): Promise<Result<void>>;
}

// ─── ABAC Policy Evaluator ────────────────────────────────

/**
 * ABAC Policy Evaluator — pure policy evaluation engine.
 *
 * Evaluates access requests against registered ABAC policies.
 * This is a stateless evaluator — it does not enforce decisions.
 * Enforcement is the responsibility of the ISecurityService.
 *
 * Evaluation strategy:
 * 1. Collect all applicable policies (matching conditions)
 * 2. Sort by priority (lower number = higher priority)
 * 3. First matching DENY policy blocks access
 * 4. If no DENY, check for at least one ALLOW
 * 5. Default: DENY (deny-by-default principle)
 */
export class AbacPolicyEvaluator {
  private readonly policyStore: IAbacPolicyStorePort;

  constructor(policyStore: IAbacPolicyStorePort) {
    this.policyStore = policyStore;
  }

  /**
   * Evaluate an access request against all active ABAC policies.
   * Returns a decision with the matched policies and reason.
   */
  async evaluate(request: AbacEvaluationRequest): Promise<Result<AbacDecision>> {
    const policiesResult = await this.policyStore.getActivePolicies();

    if (!policiesResult.ok) {
      return err<AbacDecision>(
        configError(
          ErrorCode.CONFIG_VALIDATION_FAILED,
          'Failed to retrieve ABAC policies for evaluation',
        ),
      );
    }

    const policies = policiesResult.value;
    const matchedPolicies: string[] = [];
    let hasAllow = false;

    // Evaluate policies in priority order
    for (const policy of policies) {
      if (this.matchesConditions(request, policy.conditions)) {
        matchedPolicies.push(policy.policyId);

        if (policy.effect === 'DENY') {
          // First matching DENY blocks access immediately
          return ok({
            allowed: false,
            reason: `Denied by policy '${policy.name}' (${policy.policyId})`,
            matchedPolicies,
            evaluatedAt: new Date(),
          });
        }

        if (policy.effect === 'ALLOW') {
          hasAllow = true;
        }
      }
    }

    // If at least one ALLOW matched and no DENY, permit access
    if (hasAllow) {
      return ok({
        allowed: true,
        reason: `Allowed by ${matchedPolicies.length} matching policy(ies)`,
        matchedPolicies,
        evaluatedAt: new Date(),
      });
    }

    // Default: deny (no matching policies)
    return ok({
      allowed: false,
      reason: 'No matching ALLOW policy found (default deny)',
      matchedPolicies: [],
      evaluatedAt: new Date(),
    });
  }

  /**
   * Check if an evaluation request matches a policy's conditions.
   * All specified conditions must match (AND logic).
   */
  private matchesConditions(
    request: AbacEvaluationRequest,
    conditions: AbacConditions,
  ): boolean {
    // Check subject roles
    if (conditions.subjectRoles && conditions.subjectRoles.length > 0) {
      const hasMatchingRole = request.subject.roles.some((role) =>
        conditions.subjectRoles!.includes(role),
      );
      if (!hasMatchingRole) return false;
    }

    // Check subject permissions
    if (conditions.subjectPermissions && conditions.subjectPermissions.length > 0) {
      const hasMatchingPermission = request.subject.permissions.some((perm) =>
        conditions.subjectPermissions!.includes(perm),
      );
      if (!hasMatchingPermission) return false;
    }

    // Check resource types
    if (conditions.resourceTypes && conditions.resourceTypes.length > 0) {
      if (!conditions.resourceTypes.includes(request.resource.resourceType)) {
        return false;
      }
    }

    // Check resource classifications
    if (conditions.resourceClassifications && conditions.resourceClassifications.length > 0) {
      if (!conditions.resourceClassifications.includes(request.resource.classification)) {
        return false;
      }
    }

    // Check actions
    if (conditions.actions && conditions.actions.length > 0) {
      if (!conditions.actions.includes(request.action.action)) {
        return false;
      }
    }

    // Check tenant match (subject tenant must match resource tenant)
    if (conditions.tenantMatch === true) {
      if (request.subject.tenantId !== request.resource.ownerTenantId) {
        return false;
      }
    }

    // Check request source
    if (conditions.requestSources && conditions.requestSources.length > 0) {
      if (!conditions.requestSources.includes(request.environment.requestSource)) {
        return false;
      }
    }

    // Check minimum clearance level
    if (conditions.minClearanceLevel !== undefined) {
      const subjectClearance = request.subject.clearanceLevel ?? 0;
      if (subjectClearance < conditions.minClearanceLevel) {
        return false;
      }
    }

    return true;
  }
}
