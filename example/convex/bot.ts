import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createChat } from "convex-chat-sdk";
import { components } from "./_generated/api";
import { ActionCtx } from "./_generated/server";

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
