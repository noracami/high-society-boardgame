import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";

// 移除 X-Frame-Options，允許 Discord iframe 嵌入
function discordActivityPlugin(): Plugin {
  return {
    name: "discord-activity",
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        res.setHeader(
          "Content-Security-Policy",
          "frame-ancestors 'self' https://discord.com https://*.discordsays.com"
        );
        res.removeHeader("X-Frame-Options");
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), discordActivityPlugin()],
  envDir: "../../",
  server: {
    cors: true,
    allowedHosts: ["localhost", ".discordsays.com", ".trycloudflare.com"],
    hmr: {
      clientPort: 443,
    },
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
