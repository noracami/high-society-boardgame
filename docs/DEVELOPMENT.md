# 🛠 開發環境指南 (Development Guide)

歡迎來到 **High Society** 的開發實驗室！本文件將引導你建立本地環境、操作資料庫，以及最重要的--如何在 Discord 客戶端中測試你的 Activity。

---

## 1. 前置準備

在開始之前，請確保你的電腦已安裝以下工具：

- **Node.js**: v20.0.0 或以上版本。
- **pnpm**: 我們的套件管理工具（建議 v9+）。
- **Docker & Docker Compose**: 用於執行本地 PostgreSQL。
- **Cloudflare Tunnel (cloudflared)**: (選配) 用於將本地網址暴露給公網進行測試。

---

## 2. 快速啟動步驟

### 第一步：安裝依賴

```bash
pnpm install

```

### 第二步：設定環境變數

將範本複製為正式設定檔，並填入你的 Discord Client ID（可至 Discord Developer Portal 取得）。

```bash
cp .env.example .env

```

### 第三步：啟動基礎設施 (DB)

我們使用 Docker 在本地跑一個專屬的 PostgreSQL 容器。

```bash
# 啟動資料庫
docker compose up -d

# 執行資料庫遷移與同步 (Prisma)
pnpm --filter @high-society/backend migrate:dev

```

### 第四步：啟動開發伺服器

我們使用 Turbo 啟動並行開發模式，這會同時跑起前端 Vue 3 與後端 Node.js。

```bash
pnpm dev

```

- **前端**: `http://localhost:5173`
- **後端**: `http://localhost:3000`

---

## 3. 資料庫開發規範 (Prisma)

為了避免 Schema 衝突，請遵循以下流程：

1. **修改 Schema**: 編輯 `packages/backend/prisma/schema.prisma`。
2. **產生遷移檔**: 執行 `pnpm --filter @high-society/backend prisma migrate dev --name <描述變動>`。
3. **提交代碼**: 將產生的 `prisma/migrations` 資料夾連同代碼一起提交。
4. **同步他人變更**: 當你 Pull 到別人的 Schema 變更後，執行 `pnpm dev` 時系統會自動提醒你同步，或手動執行 `pnpm --filter @high-society/backend prisma migrate dev`。

---

## 4. 在 Discord 中測試 Activity

Discord Activity 必須在 Discord 的 iframe 環境中運行。以下是兩種測試方式：

### 方案 A：使用 Discord URL Mapping (推薦)

1. 前往 [Discord Developer Portal](https://www.google.com/search?q=https://discord.com/developers/applications)。
2. 進入 **"App Launcher"** -> **"URL Mappings"**。
3. 新增對映：

- **Prefix**: `/` (或自訂路徑)
- **Target**: `http://localhost:5173`

4. 在 Discord 裡開啟你的 App，它就會直接載入你本地的前端代碼。

### 方案 B：使用 Cloudflare Tunnel (跨裝置/手機測試)

如果你想在手機版 Discord 測試，或 URL Mapping 不管用時：

1. 執行 `npx cloudflared tunnel --url http://localhost:5173`。
2. 複製產生的 `https://xxx.trycloudflare.com` 網址。
3. 將此網址填入 Discord 後台的 **"External Auth Redirect"** 或作為暫時的入口網址。

---

## 5. 常見問題 (Troubleshooting)

- **Discord 載入空白？**
- 檢查後端是否正確設定了 CSP Header (已整合在 Middleware 中)。
- 確保你使用的是 HTTPS (透過 Discord 的 Proxy 或是 Cloudflare Tunnel)。

- **資料庫連不上？**
- 確認 `docker ps` 看到 `high-society-db` 正在運行。
- 檢查 `.env` 中的 `DATABASE_URL` 是否正確指向 `localhost:5432`。

---

## 6. 常用指令速查

| 指令             | 說明                                     |
| ---------------- | ---------------------------------------- |
| `pnpm dev`       | 同時啟動前後端開發伺服器                 |
| `pnpm db:seed`   | 填充測試用的對局與玩家資料               |
| `pnpm db:studio` | 開啟視覺化資料庫管理介面 (Prisma Studio) |
| `pnpm build`     | 模擬生產環境打包                         |

---

> 本地開發時，所有的 API 請求請使用**相對路徑**。如果你發現你在前端寫了 `http://localhost:3000`，請立刻修正它，否則部署到生產環境後會失效。
