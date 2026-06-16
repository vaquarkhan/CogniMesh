import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget =
    process.env.VITE_API_URL ||
    process.env.API_PROXY_TARGET ||
    env.VITE_API_URL ||
    env.API_PROXY_TARGET ||
    "http://localhost:4000";

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/health": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/health": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/@xyflow") || id.includes("node_modules/reactflow")) {
              return "reactflow";
            }
            if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) {
              return "react-vendor";
            }
          },
        },
      },
    },
  };
});
