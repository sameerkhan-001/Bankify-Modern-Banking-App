import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// In development every /api request is proxied to the backend, so the browser sees
// ONE origin and the backend's httpOnly auth cookie "just works" (no CORS needed).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_PROXY_TARGET || 'http://localhost:3000';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { '/api': { target, changeOrigin: true } },
    },
    preview: {
      port: 4173,
      proxy: { '/api': { target, changeOrigin: true } },
    },
  };
});
