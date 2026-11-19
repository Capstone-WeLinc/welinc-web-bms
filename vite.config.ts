import { defineConfig, loadEnv } from "vite";
import type { PluginOption } from "vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = {...loadEnv(mode, process.cwd(), ''),...process.env};
  const plugins: PluginOption[] = [];
  const missing=['VITE_API_BASE_URL','VITE_PORTAL_URL'].filter(name=>!env[name]);
  if(missing.length)throw new Error('Missing environment names: '+missing.join(', '));
  if(mode==='production'){for(const name of ['VITE_API_BASE_URL','VITE_PORTAL_URL']){try{const url=new URL(env[name]!);if(url.protocol!=='https:'||['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.hostname.endsWith('.localhost'))throw new Error();}catch{throw new Error('Invalid production environment name: '+name);}}}
  const gatewayApi=env.VITE_API_BASE_URL!;
  const proxyTo = (target: string) => ({
    target,
    changeOrigin: true,
    rewrite: (url: string) => url.replace(/^\/api(?=\/|$)/, ''),
  });
  return {
    server: {
      host: '127.0.0.1',
      port: 8003,
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
