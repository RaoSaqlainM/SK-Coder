import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const configuredPort = Number(process.env.PORT || 5173);
const port = Number.isFinite(configuredPort) && configuredPort > 0 ? configuredPort : 5173;
const basePath = process.env.BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules"))
            return undefined;
          if (id.includes("monaco-editor") || id.includes("@monaco-editor"))
            return "monaco-editor";
          if (id.includes("xterm"))
            return "terminal-renderer";
          return undefined;
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:3001",
        changeOrigin: true,
        ws: true,
      },
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
