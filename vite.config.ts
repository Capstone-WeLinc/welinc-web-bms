import { defineConfig, loadEnv } from "vite";
import type { PluginOption } from "vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const plugins: PluginOption[] = [];
  const gatewayApi = env.BMS_DEV_API_TARGET || 'http://127.0.0.1:3005';
  const proxyTo = (target: string) => ({
    target,
    changeOrigin: true,
    rewrite: (url: string) => url.replace(/^\/api(?=\/|$)/, ''),
  });
  return {
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': proxyTo(gatewayApi),
      },
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
