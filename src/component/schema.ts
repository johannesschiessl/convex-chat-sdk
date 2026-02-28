import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  subscriptions: defineTable({
    threadId: v.string(),
    subscribedAt: v.number(),
  }).index("by_threadId", ["threadId"]),
  locks: defineTable({
    threadId: v.string(),
    token: v.string(),
    expiresAt: v.number(),
  })
    .index("by_threadId", ["threadId"])
    .index("by_expiresAt", ["expiresAt"]),
  kv: defineTable({
    key: v.string(),
    valueJson: v.string(),
    expiresAt: v.union(v.number(), v.null()),
  })
    .index("by_key", ["key"])
    .index("by_expiresAt", ["expiresAt"]),
});
