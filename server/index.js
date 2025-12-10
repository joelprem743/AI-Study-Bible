import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// 1. Load .env BEFORE ANY OTHER IMPORTS RUN
dotenv.config({ path: ".env" });

console.log("SERVER: GROQ_API_KEY loaded?", process.env.GROQ_API_KEY ? "YES" : "NO");

const app = express();
app.use(cors());
app.use(express.json());

// 2. Lazy-load router AFTER dotenv loaded
const llamaRouter = (await import("./routes/llama-chat.js")).default;

app.use("/api/llama-chat", llamaRouter);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
