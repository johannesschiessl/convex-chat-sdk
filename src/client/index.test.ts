import { httpRouter } from "convex/server";
import { describe, expect, test, vi } from "vitest";
import { createClient, registerWebhooks } from "./index.js";

describe("createClient", () => {
  test("forwards subscription and lock operations to the component api", async () => {
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        threadId: "thread-1",
        token: "token-1",
        expiresAt: 1_000,
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(true);
    const runQuery = vi.fn().mockResolvedValueOnce(true);

    const component = {
      lib: {
        subscribe: { name: "subscribe" },
        unsubscribe: { name: "unsubscribe" },
        isSubscribed: { name: "isSubscribed" },
        acquireLock: { name: "acquireLock" },
        releaseLock: { name: "releaseLock" },
        extendLock: { name: "extendLock" },
        get: { name: "get" },
        set: { name: "set" },
        del: { name: "del" },
      },
    } as const;

    const adapter = createClient(component as never).adapter({
      runMutation,
      runQuery,
    } as never);

    await expect(adapter.connect()).resolves.toBeUndefined();
    await expect(adapter.disconnect()).resolves.toBeUndefined();

    await adapter.subscribe("thread-1");
    await adapter.unsubscribe("thread-1");
    await expect(adapter.isSubscribed("thread-1")).resolves.toBe(true);
    await expect(adapter.acquireLock("thread-1", 1_000)).resolves.toEqual({
      threadId: "thread-1",
      token: "token-1",
      expiresAt: 1_000,
    });
    await expect(
      adapter.releaseLock({
        threadId: "thread-1",
        token: "token-1",
        expiresAt: 1_000,
      }),
    ).resolves.toBeUndefined();
    await expect(
      adapter.extendLock(
        {
          threadId: "thread-1",
          token: "token-1",
          expiresAt: 1_000,
        },
        2_000,
      ),
    ).resolves.toBe(true);

    expect(runMutation).toHaveBeenNthCalledWith(1, component.lib.subscribe, {
      threadId: "thread-1",
    });
    expect(runMutation).toHaveBeenNthCalledWith(2, component.lib.unsubscribe, {
      threadId: "thread-1",
    });
    expect(runQuery).toHaveBeenNthCalledWith(1, component.lib.isSubscribed, {
      threadId: "thread-1",
    });
    expect(runMutation).toHaveBeenNthCalledWith(3, component.lib.acquireLock, {
      threadId: "thread-1",
      ttlMs: 1_000,
    });
    expect(runMutation).toHaveBeenNthCalledWith(4, component.lib.releaseLock, {
      lock: {
        threadId: "thread-1",
        token: "token-1",
        expiresAt: 1_000,
      },
    });
    expect(runMutation).toHaveBeenNthCalledWith(5, component.lib.extendLock, {
      lock: {
        threadId: "thread-1",
        token: "token-1",
        expiresAt: 1_000,
      },
      ttlMs: 2_000,
    });
  });

  test("serializes writes and parses reads through the state adapter", async () => {
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    const runQuery = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify({ count: 2 }))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("not-json");

    const component = {
      lib: {
        subscribe: { name: "subscribe" },
        unsubscribe: { name: "unsubscribe" },
        isSubscribed: { name: "isSubscribed" },
        acquireLock: { name: "acquireLock" },
        releaseLock: { name: "releaseLock" },
        extendLock: { name: "extendLock" },
        get: { name: "get" },
        set: { name: "set" },
        del: { name: "del" },
      },
    } as const;

    const adapter = createClient(component as never).adapter({
      runMutation,
      runQuery,
    } as never);

    await expect(adapter.get("state")).resolves.toEqual({ count: 2 });
    await expect(adapter.get("missing")).resolves.toBeNull();
    await expect(adapter.get("raw")).resolves.toBe("not-json");

    await adapter.set("state", { count: 3 }, 30_000);
    await adapter.delete("state");

    expect(runQuery).toHaveBeenNthCalledWith(1, component.lib.get, {
      key: "state",
    });
    expect(runQuery).toHaveBeenNthCalledWith(2, component.lib.get, {
      key: "missing",
    });
    expect(runQuery).toHaveBeenNthCalledWith(3, component.lib.get, {
      key: "raw",
    });
    expect(runMutation).toHaveBeenNthCalledWith(1, component.lib.set, {
      key: "state",
      valueJson: JSON.stringify({ count: 3 }),
      ttlMs: 30_000,
    });
    expect(runMutation).toHaveBeenNthCalledWith(2, component.lib.del, {
      key: "state",
    });
  });
});

describe("registerWebhooks", () => {
  test("registers a wildcard webhook route and dispatches to the matching adapter", async () => {
    const createBot = vi.fn((_ctx: unknown) => ({
      webhooks: {
        telegram: vi.fn(
          async (
            _request: Request,
            options?: { waitUntil?: (task: Promise<unknown>) => void },
          ) => {
            options?.waitUntil?.(
              Promise.resolve().then(() => {
                waitUntilSettled = true;
              }),
            );

            return new Response("telegram", { status: 202 });
          },
        ),
        slack: vi.fn(async () => new Response("slack", { status: 200 })),
      },
    }));
    let waitUntilSettled = false;

    const http = httpRouter();
    expect(registerWebhooks(http, createBot)).toBe(http);
    expect(http.getRoutes()).toHaveLength(1);
    expect(http.getRoutes()[0]?.[0]).toBe("/chatsdk/*");
    expect(http.getRoutes()[0]?.[1]).toBe("POST");

    const handler = http.getRoutes()[0]?.[2] as unknown as {
      _handler: (ctx: unknown, request: Request) => Promise<Response>;
    };
    const ctx = { runMutation: vi.fn(), runQuery: vi.fn(), runAction: vi.fn() };

    const response = await handler._handler(
      ctx,
      new Request("https://example.com/chatsdk/telegram", { method: "POST" }),
    );

    expect(createBot).toHaveBeenCalledWith(ctx);
    const bot = createBot.mock.results[0]?.value;
    expect(bot.webhooks.telegram).toHaveBeenCalledTimes(1);
    expect(bot.webhooks.slack).not.toHaveBeenCalled();
    expect(response.status).toBe(202);
    await expect(response.text()).resolves.toBe("telegram");
    expect(waitUntilSettled).toBe(true);
  });

  test("returns 404 for unknown adapter paths", async () => {
    const createBot = vi.fn(() => ({
      webhooks: {
        telegram: vi.fn(async () => new Response("telegram")),
      },
    }));

    const http = registerWebhooks(httpRouter(), createBot);
    const handler = http.getRoutes()[0]?.[2] as unknown as {
      _handler: (ctx: unknown, request: Request) => Promise<Response>;
    };

    const response = await handler._handler(
      {},
      new Request("https://example.com/chatsdk/unknown", { method: "POST" }),
    );

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("Not found");
    expect(createBot).toHaveBeenCalledTimes(1);
  });

  test("supports overriding the webhook path", async () => {
    const createBot = vi.fn(() => ({
      webhooks: {
        telegram: vi.fn(async () => new Response("telegram", { status: 200 })),
      },
    }));

    const http = registerWebhooks(httpRouter(), createBot, {
      path: "/webhooks",
    });

    expect(http.getRoutes()[0]?.[0]).toBe("/webhooks/*");

    const handler = http.getRoutes()[0]?.[2] as unknown as {
      _handler: (ctx: unknown, request: Request) => Promise<Response>;
    };

    const response = await handler._handler(
      {},
      new Request("https://example.com/webhooks/telegram", { method: "POST" }),
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("telegram");
  });
});
