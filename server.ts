import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const useEmbeddedViteMiddleware = process.env.EMBED_VITE_MIDDLEWARE !== "false";

app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
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

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && useEmbeddedViteMiddleware) {
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
