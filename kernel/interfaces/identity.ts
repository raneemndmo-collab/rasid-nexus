/**
 * RASID Nexus — Identity Service Interface (K1)
 * Phase 0 Block B — EU-0B-001
 *
 * Contract for the Identity & Authentication kernel service.
 * All implementations must satisfy this interface.
 */

import {
  TenantId,
  UserId,
  SessionId,
  Role,
  Permission,
  TenantContext,
  Result,
  PaginationRequest,
  PaginatedResponse,
} from '../types/base';

// ─── Authentication ─────────────────────────────────────────

export interface AuthCredentials {
  readonly username: string;
  readonly password: string;
  readonly tenantId: TenantId;
  readonly mfaToken?: string;
}

export interface AuthToken {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly tokenType: 'Bearer';
  readonly scope: ReadonlyArray<string>;
}

export interface TokenPayload {
  readonly sub: UserId;
  readonly tid: TenantId;
  readonly sid: SessionId;
  readonly roles: ReadonlyArray<Role>;
  readonly permissions: ReadonlyArray<Permission>;
  readonly iat: number;
  readonly exp: number;
  readonly iss: string;
}

// ─── Service Interface ──────────────────────────────────────

export interface IIdentityService {
  /**
   * Authenticate user with credentials.
   * Returns JWT token pair on success.
   */
  authenticate(credentials: AuthCredentials): Promise<Result<AuthToken>>;

  /**
   * Validate and decode an access token.
   * Returns the token payload if valid.
   */
  validateToken(token: string): Promise<Result<TokenPayload>>;

  /**
   * Refresh an expired access token using a refresh token.
   */
  refreshToken(refreshToken: string): Promise<Result<AuthToken>>;

  /**
   * Revoke a session (logout).
   */
  revokeSession(sessionId: SessionId, context: TenantContext): Promise<Result<void>>;

  /**
   * Check if a user has a specific permission.
   */
  hasPermission(
    userId: UserId,
    tenantId: TenantId,
    permission: Permission,
    resource?: string,
  ): Promise<boolean>;

  /**
   * Get roles assigned to a user within a tenant.
   */
  getUserRoles(userId: UserId, tenantId: TenantId): Promise<Result<ReadonlyArray<Role>>>;

  /**
   * Assign a role to a user within a tenant.
   */
  assignRole(
    userId: UserId,
    tenantId: TenantId,
    role: Role,
    context: TenantContext,
  ): Promise<Result<void>>;

  /**
   * Revoke a role from a user within a tenant.
   */
  revokeRole(
    userId: UserId,
    tenantId: TenantId,
    role: Role,
    context: TenantContext,
  ): Promise<Result<void>>;

  /**
   * List all active sessions for a user.
   */
  listSessions(
    userId: UserId,
    tenantId: TenantId,
    pagination: PaginationRequest,
  ): Promise<Result<PaginatedResponse<SessionInfo>>>;
}

// ─── Supporting Types ───────────────────────────────────────

export interface SessionInfo {
  readonly sessionId: SessionId;
  readonly userId: UserId;
  readonly tenantId: TenantId;
  readonly createdAt: Date;
  readonly lastActiveAt: Date;
  readonly ip: string;
  readonly userAgent: string;
  readonly active: boolean;
}
