import { httpAction } from "./_generated/server";
import { httpRouter } from "convex/server";
import { createBot } from "./bot";

const http = httpRouter();

http.route({
  path: "/telegram",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const bot = createBot(ctx);
    return bot.webhooks.telegram(request);
  }),
});

export default http;
