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

app.get("/api/download-asset", async (req, res) => {
  try {
    const rawUrl = typeof req.query.url === "string" ? req.query.url : "";
    const requestedName = typeof req.query.filename === "string" ? req.query.filename : "";
    if (!rawUrl) {
      res.status(400).json({ error: "url is required" });
      return;
    }

    const assetUrl = new URL(rawUrl);
    if (!["http:", "https:"].includes(assetUrl.protocol)) {
      res.status(400).json({ error: "Only http(s) assets can be downloaded" });
      return;
    }

    const response = await fetch(assetUrl);
    if (!response.ok) {
      res.status(response.status).json({ error: response.statusText || "Failed to fetch asset" });
      return;
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const extension =
      contentType.includes("png") ? "png" :
      contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" :
      contentType.includes("webp") ? "webp" :
      contentType.includes("gif") ? "gif" :
      contentType.includes("mp4") ? "mp4" :
      "bin";
    const safeName = requestedName.replace(/[^\w\u4e00-\u9fa5.-]+/g, "_").replace(/^\.+/, "");
    const filename = safeName || `ai-studio-${Date.now()}.${extension}`;
    const arrayBuffer = await response.arrayBuffer();

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(arrayBuffer.byteLength));
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(Buffer.from(arrayBuffer));
  } catch (error: any) {
    console.error("Asset Download Error:", error);
    res.status(500).json({ error: error.message || "Failed to download asset" });
  }
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

app.post("/api/video/frame-analysis", async (req, res) => {
  try {
    const { video_url, segments = [], prompt } = req.body || {};
    if (typeof video_url !== "string" || !video_url.trim()) {
      res.status(400).json({ error: "video_url is required" });
      return;
    }

    const segmentSummary = Array.isArray(segments)
      ? segments
          .map((segment: any, index: number) => {
            const start = typeof segment?.start === "number" ? segment.start.toFixed(1) : "0.0";
            const end = typeof segment?.end === "number" ? segment.end.toFixed(1) : "0.0";
            const frameCount = typeof segment?.frameCount === "number" ? segment.frameCount : 0;
            return `- 分段 ${index + 1}: ${start}s-${end}s, 提取 ${frameCount} 个关键帧`;
          })
          .join("\n")
      : "";

    const fallbackMarkdown = [
      "## 视频逐帧分析",
      "",
      `视频地址: ${video_url}`,
      "",
      "### 分段概览",
      segmentSummary || "- 已生成关键帧拼图,可结合右侧图片节点查看动作变化。",
      "",
      "### 观察建议",
      "- 按 15 秒为一个片段查看主体、镜头运动和动作连续性。",
      "- 重点检查首尾帧是否自然衔接,是否存在主体变形或场景跳变。",
      "- 如果用于再生成视频,可把异常片段单独重跑或缩短提示词描述。",
    ].join("\n");

    const apiKey = String(req.header("X-DeepSeek-Api-Key") || process.env.DEEPSEEK_API_KEY || "").trim();
    const baseUrl = String(req.header("X-DeepSeek-Base-Url") || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
    const model = String(req.header("X-DeepSeek-Model") || process.env.DEEPSEEK_MODEL || "deepseek-chat").trim();
    if (!apiKey) {
      res.json({ text: fallbackMarkdown, usedFallback: true });
      return;
    }

    const userPrompt =
      typeof prompt === "string" && prompt.trim()
        ? prompt
        : [
            "请分析这个视频的运动和镜头变化。你会收到视频地址和按 15 秒切分的关键帧拼图信息。",
            "请输出 Markdown，结构包括：整体判断、分段分析、运动连续性、可优化点。",
            "语言简洁，适合回显在工作流文本节点中。",
            "",
            `视频地址: ${video_url}`,
            "",
            "分段信息:",
            segmentSummary || "无",
          ].join("\n");

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "你是视频运动分析助手。根据用户提供的视频地址与关键帧分段信息，输出清晰、可执行的中文 Markdown 分析。",
          },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      res.status(response.status).json({ error: data?.error?.message || data?.message || response.statusText });
      return;
    }

    const text = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || fallbackMarkdown;
    res.json({ text, usedFallback: !text });
  } catch (error: any) {
    console.error("Video Frame Analysis Error:", error);
    res.status(500).json({ error: error.message || "Failed to analyze video frames" });
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

function resolveMiniMaxEndpoint(baseUrl: unknown, endpointPath: string): string {
  const fallback = "https://api.minimaxi.com/v1";
  const raw = typeof baseUrl === "string" && baseUrl.trim() ? baseUrl.trim() : fallback;
  const url = new URL(raw);
  if (!["api.minimaxi.com", "api.minimax.io"].includes(url.hostname)) {
    throw new Error("MiniMax Base URL 仅支持 api.minimaxi.com 或 api.minimax.io");
  }
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/${endpointPath.replace(/^\/+/, "")}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readMiniMaxTaskId(data: any): string {
  return data?.task_id || data?.taskId || data?.data?.task_id || data?.data?.taskId || "";
}

function readMiniMaxFileId(data: any): string {
  return data?.file_id || data?.fileId || data?.data?.file_id || data?.data?.fileId || "";
}

function readMiniMaxStatus(data: any): string {
  return String(data?.status || data?.data?.status || data?.task_status || data?.data?.task_status || "").toLowerCase();
}

function readMiniMaxVideoUrl(data: any): string {
  const candidates = [
    data?.download_url,
    data?.downloadUrl,
    data?.url,
    data?.video_url,
    data?.videoUrl,
    data?.file?.download_url,
    data?.file?.downloadUrl,
    data?.data?.download_url,
    data?.data?.downloadUrl,
    data?.data?.url,
    data?.data?.video_url,
    data?.data?.videoUrl,
    data?.data?.file?.download_url,
    data?.data?.file?.downloadUrl,
  ];
  return candidates.find((value) => typeof value === "string" && value.length > 0) || "";
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

app.post("/api/minimax/video-generation", async (req, res) => {
  try {
    const apiKey = String(req.header("X-MiniMax-Api-Key") || process.env.MINIMAX_API_KEY || "").trim();
    if (!apiKey) {
      res.status(401).json({ error: "MiniMax API Key 未配置，请先在 API 设置里新增 MiniMax 配置并保存密钥" });
      return;
    }

    const {
      model = "MiniMax-Hailuo-2.3",
      prompt,
      first_frame_image,
      duration = 6,
      resolution = "768P",
      aspect_ratio = "16:9",
      prompt_optimizer = false,
      base_url,
    } = req.body || {};

    if (typeof prompt !== "string" || !prompt.trim()) {
      res.status(400).json({ error: "Prompt is required" });
      return;
    }

    const payload: Record<string, unknown> = {
      model,
      prompt,
      duration,
      resolution,
      aspect_ratio,
      prompt_optimizer,
    };
    if (typeof first_frame_image === "string" && first_frame_image.trim()) {
      payload.first_frame_image = first_frame_image.trim();
    }

    const createResponse = await fetch(resolveMiniMaxEndpoint(base_url, "video_generation"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const createText = await createResponse.text();
    let createData: any = {};
    try {
      createData = createText ? JSON.parse(createText) : {};
    } catch {
      createData = { raw: createText };
    }

    if (!createResponse.ok) {
      const message = createData?.base_resp?.status_msg || createData?.message || createData?.error || createText || createResponse.statusText;
      res.status(createResponse.status).json({ error: `MiniMax 视频任务创建失败: ${message}` });
      return;
    }

    const statusCode = createData?.base_resp?.status_code;
    if (typeof statusCode === "number" && statusCode !== 0) {
      res.status(502).json({ error: `MiniMax 视频任务创建失败: ${createData?.base_resp?.status_msg || statusCode}` });
      return;
    }

    const taskId = readMiniMaxTaskId(createData);
    if (!taskId) {
      res.status(502).json({ error: "MiniMax 未返回视频任务 ID" });
      return;
    }

    let fileId = readMiniMaxFileId(createData);
    let queryData: any = createData;
    for (let attempt = 0; attempt < 90 && !fileId; attempt += 1) {
      await sleep(attempt === 0 ? 2500 : 10000);
      const queryUrl = new URL(resolveMiniMaxEndpoint(base_url, "query/video_generation"));
      queryUrl.searchParams.set("task_id", taskId);
      const queryResponse = await fetch(queryUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const queryText = await queryResponse.text();
      try {
        queryData = queryText ? JSON.parse(queryText) : {};
      } catch {
        queryData = { raw: queryText };
      }

      if (!queryResponse.ok) {
        const message = queryData?.base_resp?.status_msg || queryData?.message || queryData?.error || queryText || queryResponse.statusText;
        res.status(queryResponse.status).json({ error: `MiniMax 视频任务查询失败: ${message}`, taskId });
        return;
      }

      const queryStatusCode = queryData?.base_resp?.status_code;
      if (typeof queryStatusCode === "number" && queryStatusCode !== 0) {
        res.status(502).json({ error: `MiniMax 视频任务查询失败: ${queryData?.base_resp?.status_msg || queryStatusCode}`, taskId });
        return;
      }

      const taskStatus = readMiniMaxStatus(queryData);
      if (["failed", "fail", "error"].includes(taskStatus)) {
        const message = queryData?.base_resp?.status_msg || queryData?.message || queryData?.error || "视频生成任务失败";
        res.status(502).json({ error: `MiniMax 视频生成失败: ${message}`, taskId });
        return;
      }

      fileId = readMiniMaxFileId(queryData);
    }

    if (!fileId) {
      res.status(504).json({ error: "MiniMax 视频生成超时，请稍后重试", taskId });
      return;
    }

    const retrieveUrl = new URL(resolveMiniMaxEndpoint(base_url, "files/retrieve"));
    retrieveUrl.searchParams.set("file_id", fileId);
    const fileResponse = await fetch(retrieveUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const fileText = await fileResponse.text();
    let fileData: any = {};
    try {
      fileData = fileText ? JSON.parse(fileText) : {};
    } catch {
      fileData = { raw: fileText };
    }

    if (!fileResponse.ok) {
      const message = fileData?.base_resp?.status_msg || fileData?.message || fileData?.error || fileText || fileResponse.statusText;
      res.status(fileResponse.status).json({ error: `MiniMax 视频文件获取失败: ${message}`, taskId, fileId });
      return;
    }

    const videoUrl = readMiniMaxVideoUrl(fileData);
    if (!videoUrl) {
      res.status(502).json({ error: "MiniMax 未返回视频下载链接", taskId, fileId });
      return;
    }

    res.json({
      taskId,
      fileId,
      videoUrl,
      metadata: {
        model,
        duration,
        resolution,
        aspect_ratio,
        prompt_optimizer,
        first_frame_image: payload.first_frame_image,
      },
      raw: process.env.NODE_ENV === "production" ? undefined : { create: createData, query: queryData, file: fileData },
    });
  } catch (error: any) {
    console.error("MiniMax Video Generation Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate video using MiniMax" });
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
