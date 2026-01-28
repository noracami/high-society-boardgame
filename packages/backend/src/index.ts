import dotenv from "dotenv";
import path from "path";
import express from "express";
import cors from "cors";

// 載入 root 的 .env（development 時需要）
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
}

const app = express();
const PORT = process.env.PORT || 3001;

// CSP Middleware - 允許 Discord iframe 嵌入
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://discord.com https://*.discordsays.com"
  );
  res.removeHeader("X-Frame-Options");
  next();
});

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/up", (req, res) => {
  res.send("OK");
});

app.post("/api/token", async (req, res) => {
  const { code } = req.body;

  if (!code) {
    res.status(400).json({ error: "Missing authorization code" });
    return;
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Missing DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET");
    res.status(500).json({ error: "Server configuration error" });
    return;
  }

  try {
    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Discord token exchange failed:", errorData);
      res.status(response.status).json({ error: "Token exchange failed" });
      return;
    }

    const data = await response.json();
    res.json({ access_token: data.access_token });
  } catch (error) {
    console.error("Token exchange error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Production: serve 前端靜態檔
if (process.env.NODE_ENV === "production") {
  const frontendDist = path.join(__dirname, "../../frontend/dist");
  app.use(express.static(frontendDist));

  // SPA fallback - 所有非 API 路由返回 index.html
  // Express 5 使用新版 path-to-regexp，需要使用 {*path} 語法
  app.get("{*path}", (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
