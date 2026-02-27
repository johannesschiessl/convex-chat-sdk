import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

const lockValidator = v.object({
  threadId: v.string(),
  token: v.string(),
  expiresAt: v.number(),
});

// SUBSCRIPTIONS

export const subscribe = mutation({
  args: {
    threadId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { threadId }) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_threadId", (q) => q.eq("threadId", threadId))
      .unique();

    if (!existing) {
      await ctx.db.insert("subscriptions", {
        threadId,
        subscribedAt: Date.now(),
      });
    }

    return null;
  },
});

export const unsubscribe = mutation({
  args: {
    threadId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { threadId }) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_threadId", (q) => q.eq("threadId", threadId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return null;
  },
});

export const isSubscribed = query({
  args: {
    threadId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, { threadId }) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_threadId", (q) => q.eq("threadId", threadId))
      .unique();

    return existing !== null;
  },
});

// LOCKS

export const acquireLock = mutation({
  args: {
    threadId: v.string(),
    ttlMs: v.number(),
  },
  returns: v.union(lockValidator, v.null()),
  handler: async (ctx, { threadId, ttlMs }) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("locks")
      .withIndex("by_threadId", (q) => q.eq("threadId", threadId))
      .unique();

    if (existing) {
      if (existing.expiresAt > now) {
        return null;
      }
      await ctx.db.delete(existing._id);
    }

    const token = crypto.randomUUID();
    const lock = {
      threadId,
      token,
      expiresAt: now + ttlMs,
    };

    await ctx.db.insert("locks", lock);

    return lock;
  },
});

export const releaseLock = mutation({
  args: {
    lock: v.object({
      threadId: v.string(),
      token: v.string(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, { lock }) => {
    const existing = await ctx.db
      .query("locks")
      .withIndex("by_threadId", (q) => q.eq("threadId", lock.threadId))
      .unique();

    if (existing && existing.token === lock.token) {
      await ctx.db.delete(existing._id);
    }

    return null;
  },
});

export const extendLock = mutation({
  args: {
    lock: v.object({
      threadId: v.string(),
      token: v.string(),
    }),
    ttlMs: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, { lock, ttlMs }) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("locks")
      .withIndex("by_threadId", (q) => q.eq("threadId", lock.threadId))
      .unique();

    if (!existing) return false;
    if (existing.token !== lock.token) return false;
    if (existing.expiresAt <= now) return false;

    await ctx.db.patch(existing._id, {
      expiresAt: now + ttlMs,
    });

    return true;
  },
});

// KV

export const get = query({
  args: {
    key: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { key }) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("kv")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();

    if (!existing) return null;

    if (existing.expiresAt !== null && existing.expiresAt <= now) {
      return null;
    }

    return existing.valueJson;
  },
});

export const set = mutation({
  args: {
    key: v.string(),
    valueJson: v.string(),
    ttlMs: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { key, valueJson, ttlMs }) => {
    const existing = await ctx.db
      .query("kv")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();

    const expiresAt = ttlMs !== undefined ? Date.now() + ttlMs : null;

    if (existing) {
      await ctx.db.patch(existing._id, {
        valueJson,
        expiresAt,
      });
    } else {
      await ctx.db.insert("kv", {
        key,
        valueJson,
        expiresAt,
      });
    }

    return null;
  },
});

export const del = mutation({
  args: {
    key: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { key }) => {
    const existing = await ctx.db
      .query("kv")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return null;
  },
});

// CLEANUP

export const cleanupExpired = internalMutation({
  args: {
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    deletedLocks: v.number(),
    deletedKv: v.number(),
  }),
  handler: async (ctx, { now, limit }) => {
    const ts = now ?? Date.now();
    const max = limit ?? 1000;

    let deletedLocks = 0;
    let deletedKv = 0;

    const expiredLocks = await ctx.db
      .query("locks")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", ts))
      .take(max);

    for (const lock of expiredLocks) {
      await ctx.db.delete(lock._id);
      deletedLocks++;
    }

    const expiredKv = await ctx.db
      .query("kv")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", ts))
      .take(max);

    for (const kv of expiredKv) {
      if (kv.expiresAt !== null) {
        await ctx.db.delete(kv._id);
        deletedKv++;
      }
    }

    return { deletedLocks, deletedKv };
  },
});
