import { defineApp } from "convex/server";
import chatSdk from "convex-chat-sdk/convex.config.js";

const app = defineApp();
app.use(chatSdk);

export default app;
