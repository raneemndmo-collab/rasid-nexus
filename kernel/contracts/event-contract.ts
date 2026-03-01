/**
 * RASID Nexus — Event Contract
 * Phase 0 Block B — EU-0B-001
 *
 * Defines the contract for kernel-to-module event communication.
 * All events flow through the NATS JetStream event bus.
 * This contract ensures type-safe, tenant-isolated event handling.
 */

import {
  TenantId,
  CorrelationId,
  ModuleId,
  KernelEvent,
  Result,
} from '../types/base';

// ─── Event Bus Interface ───────────────────────────────────

export interface IEventBus {
  /**
   * Publish an event to the event bus.
   * Events are automatically enriched with correlation ID and timestamp.
   */
  publish(event: EventPublishRequest): Promise<Result<string>>;

  /**
   * Subscribe to events of a specific type.
   * Returns an unsubscribe function.
   */
  subscribe(
    eventType: string,
    handler: EventSubscriptionHandler,
    options?: SubscriptionOptions,
  ): Promise<Result<EventSubscription>>;

  /**
   * Subscribe to all events matching a pattern (wildcard).
   * Example: 'kernel.identity.*' matches all identity events.
   */
  subscribePattern(
    pattern: string,
    handler: EventSubscriptionHandler,
    options?: SubscriptionOptions,
  ): Promise<Result<EventSubscription>>;

  /**
   * Request-reply pattern for synchronous inter-service communication.
   * Used only when async is not feasible.
   */
  request(
    subject: string,
    payload: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<Result<Record<string, unknown>>>;

  /**
   * Acknowledge successful processing of an event.
   */
  ack(eventId: string): Promise<void>;

  /**
   * Negative-acknowledge an event (will be redelivered).
   */
  nack(eventId: string, reason: string): Promise<void>;
}

// ─── Event Types ───────────────────────────────────────────

export interface EventPublishRequest {
  readonly eventType: string;
  readonly source: ModuleId;
  readonly tenantId: TenantId;
  readonly correlationId: CorrelationId;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly version?: number;
}

export type EventSubscriptionHandler = (event: KernelEvent) => Promise<void>;

export interface EventSubscription {
  readonly subscriptionId: string;
  readonly eventType: string;
  readonly unsubscribe: () => Promise<void>;
}

export interface SubscriptionOptions {
  /**
   * Consumer group name for load-balanced delivery.
   * Events are delivered to one consumer in the group.
   */
  readonly group?: string;

  /**
   * Durable consumer name for persistent subscriptions.
   * Survives consumer restarts.
   */
  readonly durable?: string;

  /**
   * Maximum number of redelivery attempts before DLQ.
   */
  readonly maxRetries?: number;

  /**
   * Retry delay in milliseconds.
   */
  readonly retryDelayMs?: number;

  /**
   * Filter events by tenant ID.
   * If set, only events for this tenant are delivered.
   */
  readonly tenantFilter?: TenantId;

  /**
   * Maximum number of concurrent event handlers.
   */
  readonly maxConcurrency?: number;
}

// ─── Dead Letter Queue ─────────────────────────────────────

export interface DeadLetterEntry {
  readonly originalEventId: string;
  readonly eventType: string;
  readonly source: ModuleId;
  readonly tenantId: TenantId;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly failureReason: string;
  readonly retryCount: number;
  readonly firstFailedAt: Date;
  readonly lastFailedAt: Date;
}

// ─── Event Envelope ────────────────────────────────────────

export interface EventEnvelope {
  readonly event: KernelEvent;
  readonly metadata: EventMetadata;
}

export interface EventMetadata {
  readonly publishedAt: Date;
  readonly deliveredAt: Date;
  readonly deliveryAttempt: number;
  readonly stream: string;
  readonly sequence: number;
}
