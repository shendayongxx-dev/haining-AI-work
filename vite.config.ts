import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/haining-AI-work/" : "/",
  server: { proxy: { "/api": "http://127.0.0.1:8787" } },
}));
