import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

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
  },
  server: { port: 5173 },
});
