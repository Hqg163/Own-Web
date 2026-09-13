// vite.config.js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/uploads': {
        target: `http://localhost:${process.env.VITE_API_PORT || '3000'}`,  // 后端地址
        changeOrigin: true,
      },
      '/api': {
        target: `http://localhost:${process.env.VITE_API_PORT || '3000'}`, // 您的后端服务器地址
        changeOrigin: true, // 为 true 时，服务器收到的请求头中的 Host 为 target 值，而不是 proxy 地址
        rewrite: (path) => path,
        // Chat uses fetch + SSE rather than EventSource. Preserve the upstream
        // body as a live stream in development instead of applying a proxy
        // timeout or content transform while a response is still generating.
        proxyTimeout: 0,
        timeout: 0,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            if (req.url?.startsWith('/api/ai/chat')) proxyReq.setHeader('accept', 'text/event-stream')
          })
        },
      },
    },
  },
  preview: {
    proxy: {
      '/uploads': {
        target: `http://localhost:${process.env.VITE_API_PORT || '3000'}`,
        changeOrigin: true,
      },
      '/api': {
        target: `http://localhost:${process.env.VITE_API_PORT || '3000'}`,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
});
