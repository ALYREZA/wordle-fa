

import { Bot } from "https://deno.land/x/grammy@v1.36.1/mod.ts";

const isDev = Deno.env.get("NODE_ENV") === "development";
// Create an instance of the `Bot` class and pass your bot token to it.
export const bot = new Bot(Deno.env.get("BOT_TOKEN") as string);

// You can now register listeners on your bot object `bot`.
// grammY will call the listeners when users send messages to your bot.

// Handle the /start command.
bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));
// Handle other messages.
bot.on("message", (ctx) => ctx.reply(`Got another message! ${ctx.message.text}`));

// Now that you specified how to handle messages, you can start your bot.
// This will connect to the Telegram servers and wait for messages.

// Start the bot.
console.log("Bot is running...");


if (isDev) {
    bot.start();
}