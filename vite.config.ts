import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "monaco-editor": ["@monaco-editor/react"],
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "babel": ["@babel/standalone"],
        },
      },
    },
    chunkSizeWarningLimit: 5000,
    target: "es2015",
    minify: "terser" as const,
  },
  server: {
    host: "::",
    port: 8080,
    allowedHosts: ["5174-ibkem2ev9odefwba40q0c-d20f4e30.us2.manus.computer"],
    headers: {
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  test: {
    environment: "jsdom",
    clearMocks: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
