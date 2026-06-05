import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
      dedupe: [
        "leafer-ui",
        "@leafer/core",
        "@leafer-ui/core",
        "@leafer-ui/draw",
        "@leafer-ui/web",
        "@leafer-in/animate",
        "@leafer-in/color",
      ],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== "true",
      watch: process.env.DISABLE_HMR === "true" ? null : {},
      proxy: {
        "/dev-api": {
          target: "http://114.100.248.200:18082",
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
