import { registerWebhooks } from "convex-chat-sdk";
import { httpRouter } from "convex/server";
import { createBot } from "./bot";

const http = httpRouter();

registerWebhooks(http, createBot, { path: "webhooks" });

export default http;
