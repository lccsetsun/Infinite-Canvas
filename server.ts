import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Lazy initializer for Gemini Client
let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY environment variable is required. Please set it in Settings -> Secrets."
      );
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// Check health and if Gemini API Key is available
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
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
    res
      .status(500)
      .json({ error: error.message || "Failed to generate text content using Gemini" });
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

function extractMiniMaxImages(data: any): string[] {
  const candidates = [
    data?.data?.image_urls,
    data?.data?.images,
    data?.image_urls,
    data?.images,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    const urls = candidate
      .map((item: any) => {
        if (typeof item === "string") return item;
        return item?.url || item?.image_url || item?.imageUrl || item?.base64;
      })
      .filter((url: unknown): url is string => typeof url === "string" && url.length > 0);
    if (urls.length > 0) return urls;
  }

  return [];
}

function resolveMiniMaxImageEndpoint(baseUrl: unknown): string {
  const fallback = "https://api.minimaxi.com/v1";
  const raw = typeof baseUrl === "string" && baseUrl.trim() ? baseUrl.trim() : fallback;
  const url = new URL(raw);
  if (!["api.minimaxi.com", "api.minimax.io"].includes(url.hostname)) {
    throw new Error("MiniMax Base URL 仅支持 api.minimaxi.com 或 api.minimax.io");
  }
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/image_generation`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

app.post("/api/minimax/image-generation", async (req, res) => {
  try {
    const apiKey = String(req.header("X-MiniMax-Api-Key") || process.env.MINIMAX_API_KEY || "").trim();
    if (!apiKey) {
      res.status(401).json({ error: "MiniMax API Key 未配置，请先在 API 设置里新增 MiniMax 配置并保存密钥" });
      return;
    }

    const {
      model = "image-01",
      prompt,
      aspect_ratio = "16:9",
      response_format = "url",
      n = 1,
      prompt_optimizer = false,
      seed,
      base_url,
    } = req.body || {};

    if (typeof prompt !== "string" || !prompt.trim()) {
      res.status(400).json({ error: "Prompt is required" });
      return;
    }

    const payload: Record<string, unknown> = {
      model,
      prompt,
      aspect_ratio,
      response_format,
      n,
      prompt_optimizer,
    };
    if (typeof seed === "number" && Number.isFinite(seed)) {
      payload.seed = seed;
    }

    const response = await fetch(resolveMiniMaxImageEndpoint(base_url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const message = data?.base_resp?.status_msg || data?.message || data?.error || text || response.statusText;
      res.status(response.status).json({ error: `MiniMax 生图失败: ${message}` });
      return;
    }

    const statusCode = data?.base_resp?.status_code;
    if (typeof statusCode === "number" && statusCode !== 0) {
      res.status(502).json({ error: `MiniMax 生图失败: ${data?.base_resp?.status_msg || statusCode}` });
      return;
    }

    const imageUrls = extractMiniMaxImages(data);
    res.json({
      id: data?.id || data?.request_id || data?.data?.id,
      imageUrls,
      metadata: {
        model,
        aspect_ratio,
        response_format,
        n,
        prompt_optimizer,
      },
      raw: process.env.NODE_ENV === "production" ? undefined : data,
    });
  } catch (error: any) {
    console.error("MiniMax Image Generation Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate image using MiniMax" });
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  function listen(port: number) {
    const server = app.listen(port, "::");

    server.on("listening", () => {
      console.log(`Server running on http://localhost:${port}`);
    });

    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        console.log(`Port ${port} is in use, trying ${port + 1}...`);
        server.close();
        listen(port + 1);
      } else {
        console.error("Server error:", err);
      }
    });
  }

  listen(PORT);
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
