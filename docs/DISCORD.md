# 🕹 Discord Activity 開發備忘錄 (Discord Integration)

本文件記錄了 **High Society** 如何與 Discord 深度整合，包含 SDK 使用、身分驗證流程以及必要的安全設定。

---

## 1. 身分驗證流程 (Authentication Flow)

在 Discord Activity 中，我們不能使用傳統的帳密登入，必須利用 Discord 提供的 OAuth2 令牌交換機制。

1. **前端 (Client)**：呼叫 SDK 的 `authenticate()` 取得一個暫時的 `access_token`。
2. **後端 (Server)**：前端將 Token 傳給後端，後端再拿著這個 Token 加上我們的 `CLIENT_SECRET` 去 Discord API 換取玩家的真實資訊（User ID, Avatar 等）。
3. **建立會話**：驗證成功後，後端將該玩家關聯至特定的 `instance_id`。

---

## 2. 核心組件：Discord SDK

前端統一安裝並使用官方 SDK：`@discord/embedded-app-sdk`。

### **初始化範例**

```typescript
import { DiscordSDK } from "@discord/embedded-app-sdk";

const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

export async function setupDiscord() {
  await discordSdk.ready();
  const { code } = await discordSdk.commands.authorize({
    client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "guilds"],
  });

  // 傳送到後端進行驗證 (Token Exchange)
  const response = await fetch("/api/auth/token", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}
```

---

## 3. 安全性設定：打破 iframe 枷鎖

由於 Discord Activity 運行在 `https://*.discordsays.com` 的 iframe 中，你的後端（Node.js）必須明確允許這種嵌入行為。

### **Content Security Policy (CSP)**

我們在 Express 中間件中設定以下標頭。這在我們的 **Option A** 架構中至關重要：

```javascript
// backend/middleware/security.js
app.use((req, res, next) => {
  // 1. 允許 Discord 網域嵌入我們的網頁
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://discord.com https://*.discordsays.com",
  );

  // 2. 移除 X-Frame-Options 限制 (否則會擋掉 iframe)
  res.removeHeader("X-Frame-Options");
  next();
});
```

---

## 4. 關鍵概念：Instance ID vs. Room ID

- **Instance ID**：Discord 分配給這次「活動啟動」的唯一識別碼。同一個語音頻道的玩家開啟同一個 Activity 時，會共用同一個 Instance ID。
- **Room ID (我們的 DB)**：我們在資料庫中將 `instanceId` 映射為 `roomId`。
- **開發提示**：始終使用 `instanceId` 作為過濾器來尋找玩家所屬的房間，這能確保玩家進入正確的遊戲對局。

---

## 5. 進入遊戲流程

```
Discord 用戶
    │
    ▼
加入 Voice Channel
    │
    ▼
點擊開啟 Activity
    │
    ▼
┌─────────────────────────────┐
│  Lobby 畫面                  │
│  - 看到目前房間內的人         │
│  - 可選擇「加入遊戲」          │
└─────────────────────────────┘
    │
    ▼ 按下「加入遊戲」
    │
成為 Player（顯示在玩家列表）
    │
    ▼ 按下「準備」
    │
Ready 狀態
    │
    ▼ 4~5 人都 Ready
    │
觸發遊戲開始（機制待定）
    │
    ▼
進入遊戲階段
```

### 用戶狀態

| 狀態 | 說明 | 可執行動作 |
|------|------|-----------|
| Observer | 開啟 Activity 但尚未加入遊戲 | 觀看 Lobby、按「加入遊戲」 |
| Player | 已加入遊戲，等待準備 | 按「準備」、按「離開」 |
| Ready | 已準備，等待遊戲開始 | 按「取消準備」 |
| Playing | 遊戲進行中 | 遊戲內操作 |

---

## 6. 斷線重連機制

Discord 嵌入式環境中容易因手機螢幕熄滅或切換 App 導致 Socket 斷開。

### 重連流程

1. 偵測 Socket 斷線
2. 嘗試自動重連（Socket.io 內建機制）
3. 重連成功後，使用 `instance_id` + `discord_id` 識別玩家
4. Server 回填當前遊戲狀態（`GameStateSnapshot`）
5. 前端更新畫面

### 注意事項

- 遊戲進行中斷線，玩家回合會被跳過或等待（待定）
- Lobby 階段斷線，Player 狀態應保留一段時間（如 30 秒）再移除

---

## 8. 本地測試環境調校

為了在本地開發時模擬 Discord 環境，請務必在 **Discord Developer Portal** 完成以下設定：

### **URL Mappings**

這是讓 `https://[app-id].discordsays.com` 導向你本地開發機的關鍵。

- **Prefix**: `/`
- **Target**: `http://localhost:5173` (你的 Vite 開發伺服器)

### **External Auth Redirect**

如果你使用 `cloudflared` 進行測試，請將 Tunnel 產生的網址加入重新導向清單。

---

## 9. 生產環境 Checkbox

- [ ] 已將 `https://game.miao-bao.cc` 加入 Discord 後台的 **Allowed Domains**。
- [ ] 已設定正確的 **Client ID** 與 **Client Secret** 環境變數。
- [ ] CSP Header 包含 `https://*.discordsays.com`。
- [ ] 已處理 `onClose` 事件，確保玩家離開時 Socket 正確斷開並保存資料。

---

> 「Discord Activity 的開發環境相當封閉。如果發現網頁載入不出來，90% 的情況都是因為 CSP 標頭沒設對。請優先檢查瀏覽器的 Console 報錯。」
