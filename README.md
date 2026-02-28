# Convex Chat SDK

[![npm version](https://badge.fury.io/js/convex-chat-sdk.svg)](https://badge.fury.io/js/convex-chat-sdk)

Use [Chat SDK](https://www.chat-sdk.dev/) bots with
[Convex](https://www.convex.dev/). This package provides a Convex component plus
a state adapter that wires Chat SDK state into Convex.

## Installation

Install the component, Chat SDK itself, and the adapter you want to use in your
Convex app:

```sh
bun add convex-chat-sdk chat @chat-adapter/telegram
```

## Usage Guide

The basic setup has three parts:

1. Install the Convex component in `convex/convex.config.ts`.
2. Create a bot in `convex/bot.ts`.
3. Register adapter-specific webhook routes in `convex/http.ts`.

### 1. Install the component

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import chatSdk from "convex-chat-sdk/convex.config.js";

const app = defineApp();
app.use(chatSdk);

export default app;
```

This exposes the component as `components.chatSdk` in your generated Convex API.

### 2. Create a bot

Build your bot from an action or HTTP action context with `new Chat(...)` and
plug the Convex state adapter directly into the config.

```ts
// convex/bot.ts
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { Chat } from "chat";
import { createConvexState } from "convex-chat-sdk";
import { components } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";

export const createBot = (ctx: ActionCtx) => {
  const bot = new Chat({
    state: createConvexState(ctx, components.chatSdk),
    userName: "convex-bot",
    adapters: {
      telegram: createTelegramAdapter(),
    },
  });

  bot.onNewMessage(/.+/s, async (thread, message) => {
    await thread.post(`You said: ${message.text}`);
  });

  return bot;
};
```

`createConvexState(...)` creates a Convex-backed Chat SDK state adapter.
Subscription state, locks, and key-value state are stored through the component.

### 3. Register webhook routes

Register the webhook route directly in `convex/http.ts`:

```ts
// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { createBot } from "./bot";

const http = httpRouter();

http.route({
  path: "/webhooks/telegram",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const bot = createBot(ctx);
    return bot.webhooks.telegram(request);
  }),
});

export default http;
```

## Writing Handlers

Once you have a bot instance, you can use the usual Chat SDK handler APIs, for
example:

```ts
bot.onNewMessage(/.+/s, async (thread, message) => {
  await thread.post(`You said: ${message.text}`);
});
```

Useful Chat SDK docs:

- https://www.chat-sdk.dev/docs/usage
- https://www.chat-sdk.dev/docs/posting-messages
- https://www.chat-sdk.dev/docs/adapters

## API

### `createConvexState(component, ctx)`

Creates a Convex-backed Chat SDK state adapter.

- `component`: usually `components.chatSdk`
- `ctx`: a Convex action or HTTP action context
- returns: a Chat SDK `state` adapter

## Notes

- This package is built on Chat SDK, so adapter behavior and message formats are
  defined by Chat SDK itself.
- Follow the relevant Chat SDK adapter docs and
  validate them in your own environment.

Found a bug?
[File an issue](https://github.com/johannesschiessl/convex-chat-sdk/issues).
