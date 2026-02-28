import {
  Chat,
  type Adapter,
  type ChatConfig,
  type Lock,
  type StateAdapter,
  type WebhookOptions,
} from "chat";
import {
  httpActionGeneric,
  type GenericActionCtx,
  type GenericDataModel,
  type HttpRouter,
} from "convex/server";
import type { ComponentApi } from "../component/_generated/component.js";

const WEBHOOK_PATH_PREFIX = "/chatsdk/";

export type RegisterWebhooksOptions = {
  path?: string;
};

export type CreateChatConfig<
  TAdapters extends Record<string, Adapter> = Record<string, Adapter>,
> = Omit<ChatConfig<TAdapters>, "state">;

type BotWithWebhooks<TAdapters extends Record<string, Adapter>> = {
  webhooks: {
    [K in keyof TAdapters]: (
      request: Request,
      options?: WebhookOptions,
    ) => Promise<Response>;
  };
};

function normalizeWebhookPathPrefix(path: string) {
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
}

function createStateAdapter<
  DataModel extends GenericDataModel = GenericDataModel,
>(component: ComponentApi, ctx: GenericActionCtx<DataModel>): StateAdapter {
  return {
    // These are methods that the state adapter must implement, do not remove them.
    async connect() {},
    async disconnect() {},

    async subscribe(threadId) {
      await ctx.runMutation(component.lib.subscribe, {
        threadId,
      });
    },
    async unsubscribe(threadId) {
      await ctx.runMutation(component.lib.unsubscribe, {
        threadId,
      });
    },
    async isSubscribed(threadId) {
      return await ctx.runQuery(component.lib.isSubscribed, {
        threadId,
      });
    },

    async acquireLock(threadId, ttlMs) {
      return await ctx.runMutation(component.lib.acquireLock, {
        threadId,
        ttlMs,
      });
    },
    async releaseLock(lock: Lock) {
      await ctx.runMutation(component.lib.releaseLock, { lock });
    },
    async extendLock(lock: Lock, ttlMs) {
      return await ctx.runMutation(component.lib.extendLock, {
        lock,
        ttlMs,
      });
    },

    async get(key) {
      const valueJson = await ctx.runQuery(component.lib.get, { key });
      if (valueJson === null) return null;
      try {
        return JSON.parse(valueJson);
      } catch {
        return valueJson;
      }
    },
    async set(key, value, ttlMs) {
      await ctx.runMutation(component.lib.set, {
        key,
        valueJson: JSON.stringify(value),
        ttlMs,
      });
    },
    async delete(key) {
      await ctx.runMutation(component.lib.del, { key });
    },
  };
}

export function createChat<
  DataModel extends GenericDataModel = GenericDataModel,
  TAdapters extends Record<string, Adapter> = Record<string, Adapter>,
>(
  component: ComponentApi,
  ctx: GenericActionCtx<DataModel>,
  config: CreateChatConfig<TAdapters>,
) {
  return new Chat<TAdapters>({
    ...config,
    state: createStateAdapter(component, ctx),
  });
}

export function registerWebhooks<
  DataModel extends GenericDataModel = GenericDataModel,
  TAdapters extends Record<string, Adapter> = Record<string, Adapter>,
>(
  http: HttpRouter,
  createBot: (ctx: GenericActionCtx<DataModel>) => BotWithWebhooks<TAdapters>,
  options: RegisterWebhooksOptions = {},
) {
  const pathPrefix = normalizeWebhookPathPrefix(
    options.path ?? WEBHOOK_PATH_PREFIX,
  );

  http.route({
    pathPrefix,
    method: "POST",
    handler: httpActionGeneric(async (ctx, request) => {
      const path = new URL(request.url).pathname;
      const adapterName = path.slice(pathPrefix.length);

      if (adapterName.length === 0 || adapterName.includes("/")) {
        return new Response("Not found", { status: 404 });
      }

      const bot = createBot(ctx as unknown as GenericActionCtx<DataModel>);
      const handler = bot.webhooks[adapterName as keyof typeof bot.webhooks];

      if (handler === undefined) {
        return new Response("Not found", { status: 404 });
      }

      const tasks: Promise<unknown>[] = [];
      const response = await handler(request, {
        waitUntil(task) {
          tasks.push(task);
        },
      });

      await Promise.allSettled(tasks);

      return response;
    }),
  });

  return http;
}
