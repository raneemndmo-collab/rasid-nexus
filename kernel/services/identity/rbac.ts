/**
 * RASID Nexus — RBAC Permission Map (K1)
 * Phase 0 Block B — EU-0B-002
 *
 * Defines the static mapping between roles and their granted permissions.
 * This is a pure data structure with no runtime logic beyond lookup.
 * The permission model follows the principle of least privilege.
 */

import { Role, Permission } from '../../types/base';

// ─── Role-Permission Mapping ───────────────────────────────

/**
 * Static, immutable mapping of roles to their granted permissions.
 * Each role inherits no permissions from other roles — all grants
 * are explicit to maintain auditability.
 */
export const RolePermissionMap: Readonly<Record<Role, ReadonlyArray<Permission>>> = {
  [Role.SUPER_ADMIN]: [
    Permission.READ,
    Permission.WRITE,
    Permission.DELETE,
    Permission.ADMIN,
    Permission.AUDIT_READ,
    Permission.CONFIG_WRITE,
  ],

  [Role.TENANT_ADMIN]: [
    Permission.READ,
    Permission.WRITE,
    Permission.DELETE,
    Permission.ADMIN,
    Permission.AUDIT_READ,
    Permission.CONFIG_WRITE,
  ],

  [Role.OPERATOR]: [
    Permission.READ,
    Permission.WRITE,
  ],

  [Role.AUDITOR]: [
    Permission.READ,
    Permission.AUDIT_READ,
  ],

  [Role.VIEWER]: [
    Permission.READ,
  ],

  [Role.SERVICE]: [
    Permission.READ,
    Permission.WRITE,
  ],
};

// ─── Permission Resolution ─────────────────────────────────

/**
 * Resolve the effective permissions for a set of roles.
 * Returns a deduplicated array of all permissions granted by any
 * of the provided roles.
 */
export function resolvePermissions(roles: ReadonlyArray<Role>): ReadonlyArray<Permission> {
  const permissionSet = new Set<Permission>();
  for (const role of roles) {
    const granted = RolePermissionMap[role];
    if (granted) {
      for (const perm of granted) {
        permissionSet.add(perm);
      }
    }
  }
  return Array.from(permissionSet);
}

/**
 * Check whether a set of roles grants a specific permission.
 */
export function hasPermissionForRoles(
  roles: ReadonlyArray<Role>,
  permission: Permission,
): boolean {
  for (const role of roles) {
    const granted = RolePermissionMap[role];
    if (granted && granted.includes(permission)) {
      return true;
    }
  }
  return false;
}
