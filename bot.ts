

// Import necessary libraries from Deno and OpenAI
import { Bot, Context, session, SessionFlavor } from "https://deno.land/x/grammy@v1.36.1/mod.ts";
import OpenAI from "@openai/openai";

// Initialize OpenAI client with API key from environment variables
const client = new OpenAI({
    apiKey: Deno.env.get('OPENAI_API_KEY'), // This is the default and can be omitted
});

// Define session interface for type safety
// This tracks the state of each user's game
interface WordleSession {
  currentWord: string;      // The word the user is trying to guess
  attempts: string[];       // List of the user's previous guesses
  gameActive: boolean;      // Whether a game is currently in progress
  lastGameDate?: string;    // Date of the last game played (to limit to one game per day)
}

// Create a context type with session flavor for type safety
type WordleContext = Context & SessionFlavor<WordleSession>;

// Check if we're in development mode to bypass daily game restriction
const isDev = Deno.env.get("NODE_ENV") === "development";

// Create an instance of the Bot class with the Telegram token
export const bot = new Bot<WordleContext>(Deno.env.get("BOT_TOKEN") as string);

// Initialize session middleware with default values
bot.use(session({
  initial: (): WordleSession => ({
    currentWord: "",
    attempts: [],
    gameActive: false,
  }),
}));

// Cache for daily words to avoid unnecessary API calls
interface WordCache {
  date: string;      // Date for which this word is valid
  word: string;      // The 5-letter financial term
  definition: string; // Definition of the term
}

let wordCache: WordCache | null = null;

// Function to get a financial term from OpenAI
async function getFinancialTermFromOpenAI(): Promise<WordCache> {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if we already have a cached word for today
    if (wordCache && wordCache.date === today) {
      return wordCache;
    }
    
    // Ensure API key is available
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error("OpenAI API key not found in environment variables");
    }
    
    // Request a 5-letter financial term from OpenAI
    const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        store: true,
        messages: [
          {
            role: "system",
            content: "You are a challenging financial word game host. Generate engaging 5-letter financial terms with their definitions and provide one hint about the word without revealing it directly."
          },
          {
            role: "user",
            content: "Create a financial word puzzle. Return a JSON object with format {\"definition\": \"clear definition here\", \"hint\": \"subtle clue about the term\", \"difficulty\": \"easy|medium|hard\", \"category\": \"investing|banking|trading|accounting|economics\"}"
          }
        ],
        temperature: 0.9,
        response_format: { type: "json_object" }
      });
    
    console.log(response.choices[0]!.message?.content);

    // Parse the response from OpenAI
    const content = response.choices[0]!.message?.content;
    const parsed = JSON.parse(content || '{}');
    
    // Validate the response has a proper 5-letter word
    if (!parsed.word || parsed.word.length !== 5) {
      throw new Error("Invalid word received from OpenAI");
    }
    
    // Cache the result for today
    wordCache = {
      date: today,
      word: parsed.word.toUpperCase(), // Ensure word is uppercase for consistency
      definition: parsed.definition
    };
    
    return wordCache;
  } catch (error) {
    console.error("Error fetching from OpenAI:", error);
    // Fallback to a default word if API fails
    return {
      date: new Date().toISOString().split('T')[0],
      word: "ASSET",
      definition: "Any item of economic value owned by an individual or corporation."
    };
  }
}

// Function to get today's word
const getTodaysWord = async (): Promise<string> => {
  const wordData = await getFinancialTermFromOpenAI();
  return wordData.word;
};

// Function to get today's word definition
const getTodaysWordDefinition = async (): Promise<string> => {
  const wordData = await getFinancialTermFromOpenAI();
  return wordData.definition;
};

// Function to check if a word is valid
// Currently just checks length, but could be expanded to check against a dictionary
const isValidWord = (word: string): boolean => {
  // Since we're using AI-generated words, we'll consider any 5-letter word valid
  // You could implement a more sophisticated check if needed
  return word.length === 5;
};

// Function to evaluate a guess against the target word
// Returns a string of emoji representing the result
const evaluateGuess = (guess: string, target: string): string => {
  if (guess.length !== target.length) {
    return "Invalid guess length";
  }
  
  let result = "";
  const targetChars = target.split('');
  
  // Evaluate each character in the guess
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === targetChars[i]) {
      result += "🟩"; // Green for correct letter in correct position
    } else if (targetChars.includes(guess[i])) {
      result += "🟨"; // Yellow for correct letter in wrong position
    } else {
      result += "⬜"; // White for incorrect letter
    }
  }
  
  return result;
};

// Handle the /start command - introduces the bot to new users
bot.command("start", (ctx) => {
  ctx.reply(
    "Welcome to WordleBot! 🎮\n\n" +
    "Try to guess the 5-letter word. You have 6 attempts.\n" +
    "- 🟩 means correct letter in correct position\n" +
    "- 🟨 means correct letter in wrong position\n" +
    "- ⬜ means the letter is not in the word\n\n" +
    "Use /play to start a new game!"
  );
});

// Handle the /play command - starts a new game
bot.command("play", async (ctx) => {
  const today = new Date().toISOString().split('T')[0];
  
  // Check if user already played today (unless in dev mode)
  if (ctx.session.lastGameDate === today && !isDev) {
    return ctx.reply("You've already played today's word! Come back tomorrow for a new word.");
  }
  
  // Start a new game
  ctx.session.currentWord = await getTodaysWord();
  ctx.session.attempts = [];
  ctx.session.gameActive = true;
  ctx.session.lastGameDate = today;
  
  ctx.reply(
    "Game started! 🎮\n" +
    "I'm thinking of a 5-letter financial term. You have 6 attempts to guess it.\n" +
    "Send your guess as a message."
  );
});

// Handle text messages as guesses when a game is active
bot.on("message:text", (ctx) => {
  // Check if there's an active game
  if (!ctx.session.gameActive) {
    return ctx.reply("No active game. Use /play to start a new game!");
  }
  
  const guess = ctx.message.text.trim().toUpperCase();
  
  // Validate guess length
  if (guess.length !== 5) {
    return ctx.reply("Please enter a 5-letter word.");
  }
  
  // Validate word is acceptable
  if (!isValidWord(guess)) {
    return ctx.reply("Not a valid word in my dictionary. Try again!");
  }
  
  // Add to attempts
  ctx.session.attempts.push(guess);
  
  // Evaluate guess against the target word
  const evaluation = evaluateGuess(guess, ctx.session.currentWord);
  
  // Build response message
  let response = `Attempt ${ctx.session.attempts.length}/6:\n${guess}\n${evaluation}\n\n`;
  
  // Check if player won
  if (guess === ctx.session.currentWord) {
    ctx.session.gameActive = false;
    response += `🎉 Congratulations! You guessed the word in ${ctx.session.attempts.length} attempts!`;
  } 
  // Check if player lost (used all 6 attempts)
  else if (ctx.session.attempts.length >= 6) {
    ctx.session.gameActive = false;
    response += `Game over! The word was ${ctx.session.currentWord}. Better luck tomorrow!`;
  }
  
  ctx.reply(response);
});

// Handle /definition command - provides a hint with the word's definition
bot.command("definition", async (ctx) => {
  // Check if there's an active game
  if (!ctx.session.gameActive) {
    return ctx.reply("No active game. Use /play to start a new game!");
  }
  
  // Require at least one guess before giving a hint
  if (ctx.session.attempts.length === 0) {
    return ctx.reply("Make at least one guess before asking for the definition!");
  }
  
  // Get and send the definition
  const definition = await getTodaysWordDefinition();
  ctx.reply(`Hint - Definition: ${definition}`);
});

// Handle /help command - shows available commands
bot.command("help", (ctx) => {
  ctx.reply(
    "Financial WordleBot Commands:\n" +
    "/start - Introduction to the bot\n" +
    "/play - Start a new game\n" +
    "/definition - Get a hint with the definition (after at least one guess)\n" +
    "/help - Show this help message"
  );
});