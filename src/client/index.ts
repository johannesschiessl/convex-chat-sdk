import type { Lock, StateAdapter } from "chat";
import type { GenericActionCtx, GenericDataModel } from "convex/server";
import type { ComponentApi } from "../component/_generated/component.js";

export function createClient<
  DataModel extends GenericDataModel = GenericDataModel,
>(component: ComponentApi) {
  return {
    adapter(ctx: GenericActionCtx<DataModel>): StateAdapter {
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
    },
  };
}
