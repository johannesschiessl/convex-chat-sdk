import { createTelegramAdapter } from "@chat-adapter/telegram";
import { Chat } from "chat";
import { createClient } from "convex-chat-sdk";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { ActionCtx } from "./_generated/server";

export const chatSdk = createClient<DataModel>(components.chatSdk);

export const createBot = (ctx: ActionCtx) => {
  const bot = new Chat({
    userName: "convex-bot",
    adapters: {
      telegram: createTelegramAdapter(),
    },
    state: chatSdk.adapter(ctx),
  });

  bot.onNewMessage(/.+/s, async (thread, message) => {
    await thread.post(`You said: ${message.text}`);
  });

  return bot;
};
