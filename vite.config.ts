import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json";

export default defineConfig({
  // Relative asset paths so the build works at any sub-path (e.g. GitHub Pages /excalidrive/)
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  define: {
    // Excalidraw reads this at runtime
    "process.env.IS_PREACT": JSON.stringify("false"),
    // App version shown in "What's new" (from package.json)
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: { port: 5173 },
});
