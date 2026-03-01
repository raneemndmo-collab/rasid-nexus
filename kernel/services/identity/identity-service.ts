/**
 * RASID Nexus — Identity Service Implementation (K1)
 * Phase 0 Block B — EU-0B-002
 *
 * Implements the IIdentityService interface defined in EU-0B-001.
 * This service handles authentication, token management, session
 * lifecycle, and role-based access control (RBAC).
 *
 * All infrastructure dependencies are injected via port interfaces,
 * ensuring the service remains technology-agnostic.
 *
 * Constraints:
 * - No direct database access (uses IUserRepositoryPort)
 * - No direct JWT library usage (uses IJwtPort)
 * - No direct password hashing (uses IPasswordPort)
 * - No direct session storage (uses ISessionStorePort)
 * - Events emitted only from defined KernelEventTypes
 */

import {
  UserId,
  TenantId,
  SessionId,
  Role,
  Permission,
  TenantContext,
  Result,
  PaginationRequest,
  PaginatedResponse,
} from '../../types/base';

import {
  IIdentityService,
  AuthCredentials,
  AuthToken,
  TokenPayload,
  SessionInfo,
} from '../../interfaces/identity';

import { ErrorCode, authError, internalError } from '../../errors/kernel-errors';
import { ok, err, createSessionId, generateUUID } from '../../utils';
import { resolvePermissions, hasPermissionForRoles } from './rbac';

import {
  IJwtPort,
  IPasswordPort,
  ISessionStorePort,
  IUserRepositoryPort,
} from './ports';

// ─── Configuration ─────────────────────────────────────────

export interface IdentityServiceConfig {
  readonly accessTokenExpirySeconds: number;
  readonly refreshTokenExpirySeconds: number;
  readonly issuer: string;
  readonly maxFailedAttempts: number;
}

// ─── Event Emitter Port ────────────────────────────────────

/**
 * Minimal event emission interface for K1.
 * The identity service emits events through this port; the actual
 * event bus implementation is injected at runtime.
 */
export interface IIdentityEventEmitter {
  emit(eventType: string, payload: Readonly<Record<string, unknown>>): Promise<void>;
}

// ─── Implementation ────────────────────────────────────────

export class IdentityService implements IIdentityService {
  constructor(
    private readonly jwt: IJwtPort,
    private readonly passwords: IPasswordPort,
    private readonly sessions: ISessionStorePort,
    private readonly users: IUserRepositoryPort,
    private readonly events: IIdentityEventEmitter,
    private readonly config: IdentityServiceConfig,
  ) {}

  // ── Authentication ─────────────────────────────────────

  async authenticate(credentials: AuthCredentials): Promise<Result<AuthToken>> {
    // 1. Look up user by username within tenant
    const userResult = await this.users.findByUsername(
      credentials.username,
      credentials.tenantId,
    );

    if (!userResult.ok) {
      return err(internalError('Failed to look up user'));
    }

    const user = userResult.value;

    if (!user) {
      await this.emitAuthFailed(credentials.username, credentials.tenantId, 'User not found', 0);
      return err(authError(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Invalid username or password',
      ));
    }

    // 2. Check account status
    if (!user.active) {
      await this.emitAuthFailed(credentials.username, credentials.tenantId, 'Account inactive', user.failedAttempts);
      return err(authError(
        ErrorCode.AUTH_ACCOUNT_LOCKED,
        'Account is inactive',
      ));
    }

    if (user.locked) {
      await this.emitAuthFailed(credentials.username, credentials.tenantId, 'Account locked', user.failedAttempts);
      return err(authError(
        ErrorCode.AUTH_ACCOUNT_LOCKED,
        'Account is locked due to too many failed attempts',
      ));
    }

    // 3. Verify password
    const passwordValid = await this.passwords.verify(
      credentials.password,
      user.passwordHash,
    );

    if (!passwordValid) {
      const attemptResult = await this.users.incrementFailedAttempts(
        user.userId,
        credentials.tenantId,
      );
      const attempts = attemptResult.ok ? attemptResult.value : user.failedAttempts + 1;

      if (attempts >= this.config.maxFailedAttempts) {
        await this.users.lockAccount(user.userId, credentials.tenantId);
      }

      await this.emitAuthFailed(credentials.username, credentials.tenantId, 'Invalid password', attempts);
      return err(authError(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'Invalid username or password',
      ));
    }

    // 4. Check MFA requirement
    if (user.mfaEnabled && !credentials.mfaToken) {
      return err(authError(
        ErrorCode.AUTH_MFA_REQUIRED,
        'Multi-factor authentication token required',
      ));
    }

    // 5. Reset failed attempts on successful authentication
    await this.users.resetFailedAttempts(user.userId, credentials.tenantId);

    // 6. Resolve effective permissions from roles
    const permissions = resolvePermissions(user.roles);

    // 7. Create session
    const sessionId = createSessionId(generateUUID());
    const sessionResult = await this.sessions.create({
      userId: user.userId,
      tenantId: credentials.tenantId,
      ip: '',
      userAgent: '',
    });

    if (!sessionResult.ok) {
      return err(internalError('Failed to create session'));
    }

    // 8. Generate tokens
    const accessTokenResult = await this.jwt.sign({
      sub: user.userId,
      tid: credentials.tenantId,
      sid: sessionId,
      roles: user.roles,
      permissions,
      expiresInSeconds: this.config.accessTokenExpirySeconds,
      issuer: this.config.issuer,
    });

    if (!accessTokenResult.ok) {
      return err(internalError('Failed to generate access token'));
    }

    const refreshTokenResult = await this.jwt.sign({
      sub: user.userId,
      tid: credentials.tenantId,
      sid: sessionId,
      roles: user.roles,
      permissions,
      expiresInSeconds: this.config.refreshTokenExpirySeconds,
      issuer: this.config.issuer,
    });

    if (!refreshTokenResult.ok) {
      return err(internalError('Failed to generate refresh token'));
    }

    // 9. Emit authentication event
    await this.events.emit('kernel.identity.user.authenticated', {
      userId: user.userId,
      tenantId: credentials.tenantId,
      sessionId,
      ip: '',
      method: user.mfaEnabled ? 'mfa' : 'password',
    });

    return ok({
      accessToken: accessTokenResult.value,
      refreshToken: refreshTokenResult.value,
      expiresIn: this.config.accessTokenExpirySeconds,
      tokenType: 'Bearer' as const,
      scope: permissions as unknown as ReadonlyArray<string>,
    });
  }

  // ── Token Validation ───────────────────────────────────

  async validateToken(token: string): Promise<Result<TokenPayload>> {
    const verifyResult = await this.jwt.verify(token);

    if (!verifyResult.ok) {
      return err(authError(
        ErrorCode.AUTH_TOKEN_INVALID,
        'Token validation failed',
      ));
    }

    const payload = verifyResult.value;

    // Verify the session is still active
    const sessionResult = await this.sessions.get(payload.sid);

    if (!sessionResult.ok || !sessionResult.value || !sessionResult.value.active) {
      return err(authError(
        ErrorCode.AUTH_SESSION_REVOKED,
        'Session has been revoked',
      ));
    }

    // Touch the session to update last active time
    await this.sessions.touch(payload.sid);

    return ok(payload);
  }

  // ── Token Refresh ──────────────────────────────────────

  async refreshToken(refreshToken: string): Promise<Result<AuthToken>> {
    // 1. Verify the refresh token
    const verifyResult = await this.jwt.verify(refreshToken);

    if (!verifyResult.ok) {
      return err(authError(
        ErrorCode.AUTH_TOKEN_EXPIRED,
        'Refresh token is invalid or expired',
      ));
    }

    const payload = verifyResult.value;

    // 2. Verify session is still active
    const sessionResult = await this.sessions.get(payload.sid);

    if (!sessionResult.ok || !sessionResult.value || !sessionResult.value.active) {
      return err(authError(
        ErrorCode.AUTH_SESSION_REVOKED,
        'Session has been revoked',
      ));
    }

    // 3. Look up current user data (roles may have changed)
    const userResult = await this.users.findById(payload.sub);

    if (!userResult.ok || !userResult.value) {
      return err(authError(
        ErrorCode.AUTH_TOKEN_INVALID,
        'User no longer exists',
      ));
    }

    const user = userResult.value;
    const permissions = resolvePermissions(user.roles);

    // 4. Generate new token pair
    const newAccessResult = await this.jwt.sign({
      sub: user.userId,
      tid: payload.tid,
      sid: payload.sid,
      roles: user.roles,
      permissions,
      expiresInSeconds: this.config.accessTokenExpirySeconds,
      issuer: this.config.issuer,
    });

    if (!newAccessResult.ok) {
      return err(internalError('Failed to generate new access token'));
    }

    const newRefreshResult = await this.jwt.sign({
      sub: user.userId,
      tid: payload.tid,
      sid: payload.sid,
      roles: user.roles,
      permissions,
      expiresInSeconds: this.config.refreshTokenExpirySeconds,
      issuer: this.config.issuer,
    });

    if (!newRefreshResult.ok) {
      return err(internalError('Failed to generate new refresh token'));
    }

    // 5. Emit token refreshed event
    await this.events.emit('kernel.identity.token.refreshed', {
      userId: user.userId,
      tenantId: payload.tid,
      sessionId: payload.sid,
    });

    return ok({
      accessToken: newAccessResult.value,
      refreshToken: newRefreshResult.value,
      expiresIn: this.config.accessTokenExpirySeconds,
      tokenType: 'Bearer' as const,
      scope: permissions as unknown as ReadonlyArray<string>,
    });
  }

  // ── Session Management ─────────────────────────────────

  async revokeSession(
    sessionId: SessionId,
    context: TenantContext,
  ): Promise<Result<void>> {
    const revokeResult = await this.sessions.revoke(sessionId);

    if (!revokeResult.ok) {
      return err(internalError('Failed to revoke session'));
    }

    await this.events.emit('kernel.identity.session.revoked', {
      sessionId,
      userId: context.userId,
      tenantId: context.tenantId,
      revokedBy: context.userId,
    });

    return ok(undefined);
  }

  async listSessions(
    userId: UserId,
    tenantId: TenantId,
    pagination: PaginationRequest,
  ): Promise<Result<PaginatedResponse<SessionInfo>>> {
    const listResult = await this.sessions.listByUser(
      userId,
      tenantId,
      pagination.page,
      pagination.pageSize,
    );

    if (!listResult.ok) {
      return err(internalError('Failed to list sessions'));
    }

    const { sessions, total } = listResult.value;

    return ok({
      data: sessions,
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    });
  }

  // ── RBAC ───────────────────────────────────────────────

  async hasPermission(
    userId: UserId,
    tenantId: TenantId,
    permission: Permission,
    _resource?: string,
  ): Promise<boolean> {
    const rolesResult = await this.users.getUserRoles(userId, tenantId);

    if (!rolesResult.ok) {
      return false;
    }

    return hasPermissionForRoles(rolesResult.value, permission);
  }

  async getUserRoles(
    userId: UserId,
    tenantId: TenantId,
  ): Promise<Result<ReadonlyArray<Role>>> {
    return this.users.getUserRoles(userId, tenantId);
  }

  async assignRole(
    userId: UserId,
    tenantId: TenantId,
    role: Role,
    context: TenantContext,
  ): Promise<Result<void>> {
    const assignResult = await this.users.assignRole(userId, tenantId, role);

    if (!assignResult.ok) {
      return assignResult;
    }

    await this.events.emit('kernel.identity.role.assigned', {
      userId,
      tenantId,
      role,
      changedBy: context.userId,
    });

    return ok(undefined);
  }

  async revokeRole(
    userId: UserId,
    tenantId: TenantId,
    role: Role,
    context: TenantContext,
  ): Promise<Result<void>> {
    const revokeResult = await this.users.revokeRole(userId, tenantId, role);

    if (!revokeResult.ok) {
      return revokeResult;
    }

    await this.events.emit('kernel.identity.role.revoked', {
      userId,
      tenantId,
      role,
      changedBy: context.userId,
    });

    return ok(undefined);
  }

  // ── Private Helpers ────────────────────────────────────

  private async emitAuthFailed(
    username: string,
    tenantId: TenantId,
    reason: string,
    attemptCount: number,
  ): Promise<void> {
    await this.events.emit('kernel.identity.auth.failed', {
      username,
      tenantId,
      ip: '',
      reason,
      attemptCount,
    });
  }
}
