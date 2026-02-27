import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  /**
   * Tracks whether this bot is subscribed to a thread.
   * Required for:
   * - subscribe(threadId)
   * - unsubscribe(threadId)
   * - isSubscribed(threadId)
   */
  subscriptions: defineTable({
    threadId: v.string(),
    subscribedAt: v.number(),
  }).index("by_threadId", ["threadId"]),

  /**
   * Distributed lock per thread.
   * Required for:
   * - acquireLock(threadId, ttlMs)
   * - releaseLock(lock)
   * - extendLock(lock, ttlMs)
   *
   * Semantics:
   * - One active lock per threadId
   * - token used for ownership
   * - expiresAt enforces TTL
   */
  locks: defineTable({
    threadId: v.string(),
    token: v.string(),
    expiresAt: v.number(),
  })
    .index("by_threadId", ["threadId"])
    .index("by_expiresAt", ["expiresAt"]),

  /**
   * Generic KV store with optional TTL.
   * Required for:
   * - get(key)
   * - set(key, value, ttlMs?)
   * - delete(key)
   *
   * valueJson is a serialized payload so the
   * component boundary remains fully validated.
   */
  kv: defineTable({
    key: v.string(),
    valueJson: v.string(),
    expiresAt: v.union(v.number(), v.null()),
  })
    .index("by_key", ["key"])
    .index("by_expiresAt", ["expiresAt"]),
});
