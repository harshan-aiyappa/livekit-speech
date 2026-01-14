import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "frontend", "src"),
      "@shared": path.resolve(__dirname, "frontend", "src", "shared"),
    },
  },
  root: path.resolve(__dirname, "frontend"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:8000",
      "/livekit": "http://localhost:8000",
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
      },
    },
    // Allow serving files from the root directory (e.g. node_modules)
    fs: {
      strict: true,
      allow: [".."]
    },
  },
});
