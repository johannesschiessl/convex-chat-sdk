import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { createBot } from "./chat";

const http = httpRouter();

http.route({
  path: "/webhooks/telegram",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const bot = createBot(ctx);

    return await bot.webhooks.telegram(request);
  }),
});

export default http;
