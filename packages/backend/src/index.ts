import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
