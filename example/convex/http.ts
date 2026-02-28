import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { createBot } from "./bot";

const http = httpRouter();

http.route({
  path: "/webhooks/telegram",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const bot = createBot(ctx);
    const tasks: Promise<unknown>[] = [];

    const response = await bot.webhooks.telegram(request, {
      waitUntil(task) {
        tasks.push(task);
      },
    });

    await Promise.allSettled(tasks);

    return response;
  }),
});

export default http;
