import { webhookCallback } from "https://deno.land/x/grammy@v1.36.1/mod.ts";
import { bot } from "./bot.ts";

// For local development using polling
if (Deno.env.get("NODE_ENV") === "development") {
  bot.start();
} 
// For production using webhook
else {
  const handleUpdate = webhookCallback(bot, "std/http");
  
  Deno.serve(async (req) => {
    if (req.method === "POST") {
      const url = new URL(req.url);
      if (url.pathname.slice(1) === Deno.env.get("BOT_TOKEN")) {
        try {
          return await handleUpdate(req);
        } catch (err) {
          console.error(err);
        }
      }
    }
    return new Response("Not found", { status: 404 });
  });
}