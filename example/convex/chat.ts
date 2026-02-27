import { createTelegramAdapter } from "@chat-adapter/telegram";
import { Chat } from "chat";
import { createClient } from "convex-chat-sdk";
import { components } from "./_generated/api";
import { ActionCtx } from "./_generated/server";

/**
 * Create contextual Convex-backed chatSdk
 *
 * components.chatSdk is the instance you registered via:
 * defineApp().use(chatSdk)
 */
export const chatSdk = createClient(components.chatSdk);

/**
 * Singleton Chat instance
 *
 * IMPORTANT:
 * - chatSdk.adapter is safe to reuse
 * - actual Convex ctx is injected per-request later
 */
export const createBot = (ctx: ActionCtx) => {
  const bot = new Chat({
    userName: "convex-bot",

    adapters: {
      telegram: createTelegramAdapter(),
    },

    state: chatSdk.adapter(ctx),
  });

  bot.onNewMention(async (thread) => {
    await thread.subscribe();
    await thread.post("Hello from Convex.");
  });

  return bot;
};
