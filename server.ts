import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy initializer for Gemini Client
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in Settings -> Secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Check health and if Gemini API Key is available
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY
  });
});

// Endpoint: General Node execution text generation
app.post("/api/gemini/generate", async (req, res) => {
  try {
    const { prompt, systemInstruction } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "Prompt is required" });
      return;
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: systemInstruction ? { systemInstruction } : {},
    });

    res.json({ text: response.text || "" });
  } catch (error: any) {
    console.error("Gemini Generate Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate text content using Gemini" });
  }
});

// Endpoint: Enhance Prompt (Image prompt engineering)
app.post("/api/gemini/enhance", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "Prompt is required" });
      return;
    }

    const ai = getGeminiClient();
    const systemInstruction = 
      "You are an expert prompt engineer for generative AI models like Stable Diffusion, Midjourney, and Imagen. " +
      "Your goal is to expand the user's short description into a rich, detailed, visually evocative prompt. " +
      "Include style keywords, lighting (e.g., cinematic lighting, volumetric rays), cameras/lenses details if appropriate, " +
      "environment details, and artistic vibes. Render the prompt in a concise, highly descriptive format. " +
      "Avoid conversational phrases; output only the final enhanced prompt.";

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Expand this prompt: "${prompt}"`,
      config: { systemInstruction },
    });

    res.json({ text: response.text || "" });
  } catch (error: any) {
    console.error("Gemini Enhance Error:", error);
    res.status(500).json({ error: error.message || "Failed to enhance image prompt using Gemini" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
