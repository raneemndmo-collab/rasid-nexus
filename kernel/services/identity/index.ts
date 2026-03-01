/**
 * RASID Nexus — Identity Service (K1) Barrel Export
 * Phase 0 Block B — EU-0B-002
 */

export { IdentityService } from './identity-service';
export type { IdentityServiceConfig, IIdentityEventEmitter } from './identity-service';

export {
  RolePermissionMap,
  resolvePermissions,
  hasPermissionForRoles,
} from './rbac';

export type {
  IJwtPort,
  JwtSignRequest,
  IPasswordPort,
  ISessionStorePort,
  SessionCreateRequest,
  SessionListResult,
  IUserRepositoryPort,
  StoredUser,
} from './ports';
