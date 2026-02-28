# Convex Chat SDK

[![npm version](https://badge.fury.io/js/convex-chat-sdk.svg)](https://badge.fury.io/js/convex-chat-sdk)

Use [Chat SDK](https://www.chat-sdk.dev/) bots with [Convex](https://www.convex.dev/).
This package provides a Convex component plus a small client API that wires Chat
SDK state into Convex and exposes adapter webhooks through `http.ts`.

Telegram is the only adapter tested with this component so far. More adapters
should work in principle through Chat SDK, but they have not been validated in
this package yet.

## Installation

Install the component and the adapter you want to use in your Convex app:

```sh
bun add convex-chat-sdk chat @chat-adapter/telegram
```

## Usage Guide

The basic setup has three parts:

1. Install the Convex component in `convex/convex.config.ts`.
2. Create a bot in `convex/bot.ts`.
3. Register webhook routes in `convex/http.ts`.

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

Create your bot from an action or HTTP action context and pass the component
reference plus your Chat SDK configuration.

```ts
// convex/bot.ts
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createChat } from "convex-chat-sdk";
import { components } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";

export const createBot = (ctx: ActionCtx) => {
  const bot = createChat(components.chatSdk, ctx, {
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

`createChat(...)` creates a normal Chat SDK bot, but uses Convex as the state
adapter. Subscription state, locks, and key-value state are stored through the
component.

### 3. Register webhook routes

Register a wildcard webhook route in `convex/http.ts` and point it at your bot
factory:

```ts
// convex/http.ts
import { registerWebhooks } from "convex-chat-sdk";
import { httpRouter } from "convex/server";
import { createBot } from "./bot";

const http = httpRouter();

registerWebhooks(http, createBot, { path: "/chatsdk" });

export default http;
```

With the configuration above, adapter webhooks are available at:

```text
/chatsdk/<adapter-name>
```

For Telegram, that means:

```text
/chatsdk/telegram
```

If you omit the `path` option, the default prefix is `/chatsdk/`, so Telegram
would be exposed at `/chatsdk/telegram`.

## Telegram Setup

The Telegram adapter in Chat SDK expects the standard Telegram bot credentials.
Make these available to your Convex deployment:

```sh
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET_TOKEN=...
```

Then register Telegram's webhook URL to point at your Convex HTTP endpoint. The
exact URL depends on your Convex deployment and the `path` you chose above.

Example:

```text
https://<your-convex-deployment-site-url>/chatsdk/telegram
```

See the Chat SDK Telegram adapter docs for the current setup details:

- https://www.chat-sdk.dev/docs/adapters/telegram

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

### Posting messages

Chat SDK supports plain strings as well as richer message payloads. For example:

```ts
await thread.post("Plain text");

await thread.post({
  markdown: "**Hello** from Convex",
});
```

If you need more advanced formatting, media, or adapter-specific behavior, use
the Chat SDK docs as the source of truth for message payloads and capabilities.

## API

### `createChat(component, ctx, config)`

Creates a Chat SDK bot backed by Convex state.

- `component`: usually `components.chatSdk`
- `ctx`: a Convex action or HTTP action context
- `config`: standard Chat SDK config except `state`, which is provided by this
  package

### `registerWebhooks(http, createBot, options?)`

Registers a POST wildcard route that dispatches requests to
`bot.webhooks[adapterName]`.

- `http`: your `httpRouter()`
- `createBot`: function that builds the bot from the request context
- `options.path`: optional path prefix, default `/chatsdk/`

## Notes

- This package is built on Chat SDK, so adapter behavior and message formats are
  defined by Chat SDK itself.
- Telegram is the only adapter tested in this package today.
- If you use other adapters, follow the relevant Chat SDK adapter docs and
  validate them in your own environment.

Found a bug or want a new adapter example?
[File an issue](https://github.com/johannesschiessl/convex-chat-sdk/issues).
