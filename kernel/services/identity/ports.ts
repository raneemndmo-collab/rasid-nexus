/**
 * RASID Nexus — Identity Service Ports (K1)
 * Phase 0 Block B — EU-0B-002
 *
 * Port interfaces define the boundaries between the K1 identity service
 * and its infrastructure dependencies. These ports follow the hexagonal
 * architecture pattern: the identity service depends only on these
 * abstractions, never on concrete implementations.
 *
 * Adapters for each port are provided at deployment time via dependency
 * injection, ensuring the kernel remains technology-agnostic.
 */

import {
  UserId,
  TenantId,
  SessionId,
  Role,
  Permission,
  Result,
} from '../../types/base';

import {
  TokenPayload,
  SessionInfo,
} from '../../interfaces/identity';

// ─── JWT Port ──────────────────────────────────────────────

/**
 * Abstraction for JSON Web Token operations.
 * Implementations are provided via dependency injection at deployment time.
 */
export interface IJwtPort {
  /**
   * Sign a payload and return a signed JWT string.
   */
  sign(payload: JwtSignRequest): Promise<Result<string>>;

  /**
   * Verify and decode a JWT string.
   * Returns the decoded payload if the token is valid and not expired.
   */
  verify(token: string): Promise<Result<TokenPayload>>;

  /**
   * Decode a JWT without verifying the signature.
   * Used only for inspection/logging — never for authorization.
   */
  decode(token: string): Result<TokenPayload>;
}

export interface JwtSignRequest {
  readonly sub: UserId;
  readonly tid: TenantId;
  readonly sid: SessionId;
  readonly roles: ReadonlyArray<Role>;
  readonly permissions: ReadonlyArray<Permission>;
  readonly expiresInSeconds: number;
  readonly issuer: string;
}

// ─── Password Port ─────────────────────────────────────────

/**
 * Abstraction for password hashing and verification.
 * Implementations are provided via dependency injection at deployment time.
 */
export interface IPasswordPort {
  /**
   * Hash a plaintext password.
   * Returns the hashed password string.
   */
  hash(plaintext: string): Promise<string>;

  /**
   * Verify a plaintext password against a stored hash.
   * Returns true if the password matches.
   */
  verify(plaintext: string, hash: string): Promise<boolean>;
}

// ─── Session Store Port ────────────────────────────────────

/**
 * Abstraction for session persistence.
 * Implementations are provided via dependency injection at deployment time.
 */
export interface ISessionStorePort {
  /**
   * Create a new session.
   */
  create(session: SessionCreateRequest): Promise<Result<SessionInfo>>;

  /**
   * Retrieve a session by its ID.
   */
  get(sessionId: SessionId): Promise<Result<SessionInfo | null>>;

  /**
   * Update the last active timestamp for a session.
   */
  touch(sessionId: SessionId): Promise<Result<void>>;

  /**
   * Revoke (deactivate) a session.
   */
  revoke(sessionId: SessionId): Promise<Result<void>>;

  /**
   * List all active sessions for a user within a tenant.
   */
  listByUser(
    userId: UserId,
    tenantId: TenantId,
    page: number,
    pageSize: number,
  ): Promise<Result<SessionListResult>>;

  /**
   * Revoke all sessions for a user within a tenant.
   */
  revokeAllByUser(userId: UserId, tenantId: TenantId): Promise<Result<number>>;
}

export interface SessionCreateRequest {
  readonly userId: UserId;
  readonly tenantId: TenantId;
  readonly ip: string;
  readonly userAgent: string;
}

export interface SessionListResult {
  readonly sessions: ReadonlyArray<SessionInfo>;
  readonly total: number;
}

// ─── User Repository Port ──────────────────────────────────

/**
 * Abstraction for user data access.
 * Implementations are provided via dependency injection at deployment time.
 */
export interface IUserRepositoryPort {
  /**
   * Find a user by username within a tenant.
   */
  findByUsername(
    username: string,
    tenantId: TenantId,
  ): Promise<Result<StoredUser | null>>;

  /**
   * Find a user by their ID.
   */
  findById(userId: UserId): Promise<Result<StoredUser | null>>;

  /**
   * Get the roles assigned to a user within a tenant.
   */
  getUserRoles(userId: UserId, tenantId: TenantId): Promise<Result<ReadonlyArray<Role>>>;

  /**
   * Assign a role to a user within a tenant.
   */
  assignRole(userId: UserId, tenantId: TenantId, role: Role): Promise<Result<void>>;

  /**
   * Revoke a role from a user within a tenant.
   */
  revokeRole(userId: UserId, tenantId: TenantId, role: Role): Promise<Result<void>>;

  /**
   * Increment the failed login attempt counter.
   * Returns the new attempt count.
   */
  incrementFailedAttempts(userId: UserId, tenantId: TenantId): Promise<Result<number>>;

  /**
   * Reset the failed login attempt counter.
   */
  resetFailedAttempts(userId: UserId, tenantId: TenantId): Promise<Result<void>>;

  /**
   * Lock a user account.
   */
  lockAccount(userId: UserId, tenantId: TenantId): Promise<Result<void>>;
}

/**
 * Stored user record — represents the persisted user data.
 * This is NOT exposed outside K1; it is an internal representation.
 */
export interface StoredUser {
  readonly userId: UserId;
  readonly tenantId: TenantId;
  readonly username: string;
  readonly passwordHash: string;
  readonly roles: ReadonlyArray<Role>;
  readonly permissions: ReadonlyArray<Permission>;
  readonly active: boolean;
  readonly locked: boolean;
  readonly mfaEnabled: boolean;
  readonly failedAttempts: number;
  readonly lastLoginAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
