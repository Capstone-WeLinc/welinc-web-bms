import { defineConfig } from "vite";
import type { PluginOption } from "vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => {
  const plugins: PluginOption[] = [];
  return {
    server: {
      host: '127.0.0.1',
      port: 5173,
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