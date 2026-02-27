/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

describe("component lib", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("tracks subscriptions idempotently", async () => {
    const t = initConvexTest();
    const threadId = "thread-1";

    expect(await t.query(api.lib.isSubscribed, { threadId })).toBe(false);

    await t.mutation(api.lib.subscribe, { threadId });
    await t.mutation(api.lib.subscribe, { threadId });

    expect(await t.query(api.lib.isSubscribed, { threadId })).toBe(true);

    const subscriptions = await t.run(async (ctx) => {
      return await ctx.db.query("subscriptions").collect();
    });
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]).toMatchObject({ threadId });

    await t.mutation(api.lib.unsubscribe, { threadId });
    await t.mutation(api.lib.unsubscribe, { threadId });

    expect(await t.query(api.lib.isSubscribed, { threadId })).toBe(false);
  });

  test("acquires a new lock after the previous one expires", async () => {
    const t = initConvexTest();
    const startedAt = Date.now();

    const firstLock = await t.mutation(api.lib.acquireLock, {
      threadId: "thread-1",
      ttlMs: 1_000,
    });

    expect(firstLock).toMatchObject({
      threadId: "thread-1",
      expiresAt: startedAt + 1_000,
    });
    expect(firstLock?.token).toEqual(expect.any(String));

    expect(
      await t.mutation(api.lib.acquireLock, {
        threadId: "thread-1",
        ttlMs: 1_000,
      }),
    ).toBeNull();

    vi.setSystemTime(startedAt + 1_001);

    const secondLock = await t.mutation(api.lib.acquireLock, {
      threadId: "thread-1",
      ttlMs: 2_000,
    });

    expect(secondLock).toMatchObject({
      threadId: "thread-1",
      expiresAt: startedAt + 3_001,
    });
    expect(secondLock?.token).not.toBe(firstLock?.token);

    const locks = await t.run(async (ctx) => {
      return await ctx.db.query("locks").collect();
    });
    expect(locks).toHaveLength(1);
    expect(locks[0]).toMatchObject(secondLock!);
  });

  test("extends and releases locks only for the owning token", async () => {
    const t = initConvexTest();
    const lock = await t.mutation(api.lib.acquireLock, {
      threadId: "thread-1",
      ttlMs: 5_000,
    });

    expect(lock).not.toBeNull();

    expect(
      await t.mutation(api.lib.extendLock, {
        lock: {
          threadId: "thread-1",
          token: "wrong-token",
        },
        ttlMs: 2_000,
      }),
    ).toBe(false);

    vi.setSystemTime(Date.now() + 1_000);

    expect(
      await t.mutation(api.lib.extendLock, {
        lock: {
          threadId: lock!.threadId,
          token: lock!.token,
        },
        ttlMs: 4_000,
      }),
    ).toBe(true);

    const storedAfterExtend = await t.run(async (ctx) => {
      return await ctx.db
        .query("locks")
        .withIndex("by_threadId", (q) => q.eq("threadId", "thread-1"))
        .unique();
    });
    expect(storedAfterExtend).toMatchObject({
      threadId: "thread-1",
      token: lock!.token,
      expiresAt: Date.now() + 4_000,
    });

    await t.mutation(api.lib.releaseLock, {
      lock: {
        threadId: "thread-1",
        token: "wrong-token",
      },
    });

    expect(
      await t.run(async (ctx) => {
        return await ctx.db
          .query("locks")
          .withIndex("by_threadId", (q) => q.eq("threadId", "thread-1"))
          .unique();
      }),
    ).not.toBeNull();

    await t.mutation(api.lib.releaseLock, {
      lock: {
        threadId: lock!.threadId,
        token: lock!.token,
      },
    });

    expect(
      await t.run(async (ctx) => {
        return await ctx.db
          .query("locks")
          .withIndex("by_threadId", (q) => q.eq("threadId", "thread-1"))
          .unique();
      }),
    ).toBeNull();
  });

  test("stores kv values, updates them, and hides expired entries", async () => {
    const t = initConvexTest();

    expect(await t.query(api.lib.get, { key: "session" })).toBeNull();

    await t.mutation(api.lib.set, {
      key: "session",
      valueJson: JSON.stringify({ count: 1 }),
      ttlMs: 500,
    });

    expect(await t.query(api.lib.get, { key: "session" })).toBe(
      JSON.stringify({ count: 1 }),
    );

    await t.mutation(api.lib.set, {
      key: "session",
      valueJson: JSON.stringify({ count: 2 }),
    });

    expect(await t.query(api.lib.get, { key: "session" })).toBe(
      JSON.stringify({ count: 2 }),
    );

    const kvEntries = await t.run(async (ctx) => {
      return await ctx.db.query("kv").collect();
    });
    expect(kvEntries).toHaveLength(1);
    expect(kvEntries[0]).toMatchObject({
      key: "session",
      valueJson: JSON.stringify({ count: 2 }),
      expiresAt: null,
    });

    await t.mutation(api.lib.set, {
      key: "expiring",
      valueJson: JSON.stringify("soon gone"),
      ttlMs: 100,
    });

    vi.setSystemTime(Date.now() + 101);

    expect(await t.query(api.lib.get, { key: "expiring" })).toBeNull();

    await t.mutation(api.lib.del, { key: "session" });
    await t.mutation(api.lib.del, { key: "session" });

    expect(await t.query(api.lib.get, { key: "session" })).toBeNull();
  });

  test("cleanupExpired removes expired locks and ttl-backed kv entries only", async () => {
    const t = initConvexTest();
    const now = Date.now();

    await t.mutation(api.lib.acquireLock, {
      threadId: "expired-lock",
      ttlMs: 100,
    });
    await t.mutation(api.lib.acquireLock, {
      threadId: "active-lock",
      ttlMs: 1_000,
    });
    await t.mutation(api.lib.set, {
      key: "expired-kv",
      valueJson: JSON.stringify({ ok: false }),
      ttlMs: 100,
    });
    await t.mutation(api.lib.set, {
      key: "active-kv",
      valueJson: JSON.stringify({ ok: true }),
      ttlMs: 1_000,
    });
    await t.mutation(api.lib.set, {
      key: "permanent-kv",
      valueJson: JSON.stringify({ ok: "forever" }),
    });

    const result = await t.mutation(internal.lib.cleanupExpired, {
      now: now + 101,
      limit: 100,
    });

    expect(result).toEqual({
      deletedLocks: 1,
      deletedKv: 1,
    });

    const remainingLocks = await t.run(async (ctx) => {
      return await ctx.db.query("locks").collect();
    });
    expect(remainingLocks).toHaveLength(1);
    expect(remainingLocks[0]).toMatchObject({ threadId: "active-lock" });

    const remainingKv = await t.run(async (ctx) => {
      return await ctx.db.query("kv").collect();
    });
    expect(remainingKv).toHaveLength(2);
    expect(remainingKv.map((doc) => doc.key).sort()).toEqual([
      "active-kv",
      "permanent-kv",
    ]);
  });
});
