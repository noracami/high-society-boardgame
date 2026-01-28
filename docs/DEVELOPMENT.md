# 🛠 開發環境指南 (Development Guide)

歡迎來到 **High Society** 的開發實驗室！本文件將引導你建立本地環境，以及如何在 Discord 客戶端中測試你的 Activity。

---

## 1. 前置準備

在開始之前，請確保你的電腦已安裝以下工具：

- **Node.js**: v20.0.0 或以上版本
- **pnpm**: 套件管理工具（建議 v9+）

---

## 2. 建立你的 Discord App

每個開發者需要建立**自己的 Discord App** 來進行開發測試。

### 步驟

1. 前往 [Discord Developer Portal](https://discord.com/developers/applications)
2. 點擊 **New Application**，命名為 `High Society Dev` 或類似名稱
3. 記下 **Application ID**（即 Client ID）

### 設定 OAuth2

1. 進入 **OAuth2** → **General**
2. 記下 **Client Secret**（點擊 Reset Secret）
3. 在 **Redirects** 加入：
   ```
   https://{你的_APPLICATION_ID}.discordsays.com
   ```

### 開啟 Activities

1. 進入 **Activities** → **Getting Started**
2. 確認 **Enable Activities** 已開啟

---

## 3. 設定本地環境

### 安裝依賴

```bash
pnpm install
```

### 設定環境變數

```bash
cp .env.example .env
```

編輯 `.env`，填入你的 Discord App credentials：

```
VITE_DISCORD_CLIENT_ID=你的_APPLICATION_ID
DISCORD_CLIENT_ID=你的_APPLICATION_ID
DISCORD_CLIENT_SECRET=你的_CLIENT_SECRET
```

---

## 4. 啟動開發伺服器

需要開啟**兩個 Terminal**：

### Terminal 1：開發伺服器

```bash
pnpm dev
```

這會同時啟動：
- **前端**: `http://localhost:5173`
- **後端**: `http://localhost:3001`

### Terminal 2：Cloudflare Tunnel

Discord Activity 必須透過 HTTPS 訪問，使用 Cloudflare Tunnel 暴露本地伺服器：

```bash
pnpm tunnel
```

會輸出類似：
```
Your quick Tunnel has been created! Visit it at:
https://xxx-yyy-zzz.trycloudflare.com
```

**記下這個 URL**，下一步會用到。

---

## 5. 設定 Discord URL Mapping

1. 回到 [Discord Developer Portal](https://discord.com/developers/applications)
2. 進入你的 App → **Activities** → **URL Mappings**
3. 設定 **Root Mapping**：

| Prefix | Target |
|--------|--------|
| `/` | `https://xxx-yyy-zzz.trycloudflare.com`（你的 tunnel URL） |

4. 儲存

> **注意**：每次重啟 tunnel 會得到新的 URL，需要更新 URL Mapping。

---

## 6. 在 Discord 中測試

1. 開啟 **Discord 桌面版**
2. 加入任一**語音頻道**
3. 點擊**開始活動**（火箭圖示 🚀）
4. 在「開發中的活動」找到你的 App
5. 開啟後應該會看到「已認證」和你的用戶資訊

---

## 7. 常見問題 (Troubleshooting)

### Discord 載入空白？

- 確認 `pnpm dev` 和 `pnpm tunnel` 都在運行
- 確認 URL Mapping 的 Target 是最新的 tunnel URL
- 檢查瀏覽器 Console 是否有 CSP 錯誤

### 認證失敗？

- 確認 `.env` 中的 Client ID 和 Secret 正確
- 確認 OAuth2 Redirects 已設定 `https://{CLIENT_ID}.discordsays.com`

### Tunnel URL 每次都變？

這是 Quick Tunnel 的限制。如果覺得麻煩，可以：
- 使用 Cloudflare Named Tunnel（需要 Cloudflare 帳號，URL 固定）
- 或每次更新 URL Mapping

---

## 8. 開發流程總結

```
1. pnpm dev          # Terminal 1：啟動開發伺服器
2. pnpm tunnel       # Terminal 2：啟動 tunnel，記下 URL
3. 更新 URL Mapping  # Discord Developer Portal
4. 在 Discord 測試   # 開啟 Activity
5. 修改程式碼        # Hot reload 自動更新
6. 重複步驟 4-5
```

---

## 9. 常用指令速查

| 指令 | 說明 |
|------|------|
| `pnpm install` | 安裝依賴 |
| `pnpm dev` | 啟動前後端開發伺服器 |
| `pnpm tunnel` | 啟動 Cloudflare Tunnel |
| `pnpm build` | 建置生產版本 |

---

> **提醒**：所有 API 請求請使用**相對路徑**（如 `/api/token`），不要寫死 `http://localhost:3001`，否則部署後會失效。
