import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@/components/ui": fileURLToPath(
        new URL("./src/components/Ui", import.meta.url),
      ),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.DEV_PORT || 3000),
    strictPort: true,
    allowedHosts: true,
    proxy: {
      "/api": `http://127.0.0.1:${process.env.API_PORT || Number(process.env.DEV_PORT || 3000) + 1}`,
    },
  },
});
