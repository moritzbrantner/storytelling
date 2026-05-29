import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@moritzbrantner/storytelling/core": fileURLToPath(
        new URL("../src/core.ts", import.meta.url),
      ),
      "@moritzbrantner/storytelling/schema": fileURLToPath(
        new URL("../src/schema.ts", import.meta.url),
      ),
      "@moritzbrantner/storytelling": fileURLToPath(new URL("../src/index.ts", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
