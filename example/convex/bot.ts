import { createTelegramAdapter } from "@chat-adapter/telegram";
import { Chat } from "chat";
import { createConvexState } from "convex-chat-sdk";
import { components } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";

export const createBot = (ctx: ActionCtx) => {
  const bot = new Chat({
    userName: "convex-bot",
    adapters: {
      telegram: createTelegramAdapter(),
    },
    state: createConvexState(ctx, components.chatSdk),
  });

  bot.onNewMessage(/.+/s, async (thread, message) => {
    await thread.post(`You said: ${message.text}`);
  });

  return bot;
};
