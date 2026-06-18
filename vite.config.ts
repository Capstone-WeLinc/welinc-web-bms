import { defineConfig } from "vite";
import type { PluginOption } from "vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => {
  const plugins: PluginOption[] = [];
  return {
    server: {
    host: true, // Bind to 0.0.0.0 — required for Docker
      port: 8003,
    },
    plugins: plugins.filter(Boolean) as PluginOption[],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    base: '/',
    build: {
      outDir: 'dist',
    }
  };
});