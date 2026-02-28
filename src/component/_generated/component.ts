/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    lib: {
      acquireLock: FunctionReference<
        "mutation",
        "internal",
        { threadId: string; ttlMs: number },
        { expiresAt: number; threadId: string; token: string } | null,
        Name
      >;
      del: FunctionReference<
        "mutation",
        "internal",
        { key: string },
        null,
        Name
      >;
      extendLock: FunctionReference<
        "mutation",
        "internal",
        {
          lock: { expiresAt: number; threadId: string; token: string };
          ttlMs: number;
        },
        boolean,
        Name
      >;
      get: FunctionReference<
        "query",
        "internal",
        { key: string },
        string | null,
        Name
      >;
      isSubscribed: FunctionReference<
        "query",
        "internal",
        { threadId: string },
        boolean,
        Name
      >;
      releaseLock: FunctionReference<
        "mutation",
        "internal",
        { lock: { expiresAt: number; threadId: string; token: string } },
        null,
        Name
      >;
      set: FunctionReference<
        "mutation",
        "internal",
        { key: string; ttlMs?: number; valueJson: string },
        null,
        Name
      >;
      subscribe: FunctionReference<
        "mutation",
        "internal",
        { threadId: string },
        null,
        Name
      >;
      unsubscribe: FunctionReference<
        "mutation",
        "internal",
        { threadId: string },
        null,
        Name
      >;
    };
  };
