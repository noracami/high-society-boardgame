# 🥂 上流社會 (High Society) on Discord

一個專為 Discord Activity 打造的《上流社會》桌遊實作專案。本專案採用 **Monorepo** 架構，結合 Vue 3、Node.js 與 PostgreSQL，部署在 Dokploy 上。

---

## 🚀 技術組合 (Tech Stack)

- **前端 (Frontend)**: Vue 3 (Vite), Tailwind CSS, Discord Embedded App SDK.
- **後端 (Backend)**: Node.js, Express, Socket.io (WebSocket), Prisma (ORM).
- **共用模組 (Shared)**: TypeScript Interfaces & Constants (型別防線).
- **資料庫 (Database)**: PostgreSQL (唯一真理來源).
- **基礎設施 (Infra)**:
- **Dokploy**: 單台 VM 上的部署平台（Docker Swarm＋Traefik），release PR 經核准後部署.
- **Cloudflare**: 提供 CDN、DDoS 防護與反向代理 (Proxy).
- **GCP Artifact Registry**: 存放 Docker 映像檔。

---

## 📂 專案結構 (Project Structure)

本專案使用 `pnpm workspaces` 進行管理：

- `packages/frontend`: 基於 Vite 的 Vue 3 前端專案。
- `packages/backend`: Node.js 遊戲權威伺服器。
- `packages/shared`: 前後端共用的型別定義與遊戲邏輯（如：牌面金額、對局狀態枚舉）。
- `docs/`: 存放 ADR (架構決策紀錄) 與詳細說明文件。

---

## 🛠 快速啟動 (Quick Start)

### 1. 前置需求

- Node.js (v20+) & pnpm
- Docker & Docker Compose (本地資料庫)
- Discord Developer Portal 應用程式設定

### 2. 環境設定

```bash
# 安裝所有依賴
pnpm install

# 複製環境變數範本並修改
cp .env.example .env

# 啟動本地資料庫 (PostgreSQL)
docker compose up -d

# 執行資料庫遷移
pnpm --filter @high-society/backend migrate:dev

```

### 3. 啟動開發環境

```bash
# 同時啟動前後端
pnpm dev

```

前端預設運行於 `http://localhost:5173`，後端 API 預設運行於 `http://localhost:3000`。

---

## 🏗 架構概覽 (Architecture)

本專案採用 **「單一入口合體打包 (Option A)」**：

1. **編譯期**：Vite 將前端編譯為靜態檔案。
2. **運行期**：Node.js 伺服器同時負責託管靜態檔案與處理 WebSocket 連線。
3. **流量路徑**：`Discord iframe` → `Cloudflare` → `Cloudflare Tunnel` → `Traefik（Dokploy）` → `Node.js Container`。

詳細架構設計請參考 [ARCHITECTURE.md](https://www.google.com/search?q=./docs/ARCHITECTURE.md)。

---

## 📜 開發規範 (Guidelines)

為了維持團隊協作效率，請務必遵守以下規範：

- **Schema 優先**：資料庫 Schema 的變更需優先進行討論與 PR 合併，詳見 [DATABASE.md](https://www.google.com/search?q=./docs/DATABASE.md)。
- **型別防線**：所有前後端通訊的封包格式必須定義在 `packages/shared`。
- **決策紀錄**：重大架構轉折必須撰寫 ADR，模板請見 [ADR Template](https://www.google.com/search?q=./docs/adr/0000-template.md)。

---

## 🚢 部署 (Deployment)

一般 PR 合併至 `main` 只跑 E2E，不會部署。合併改了 `packages/backend/package.json` 版號的 release PR 後，GitHub Actions 經人工核准，打包映像檔推送到 ghcr 並觸發 Dokploy 部署。

- 發版步驟：[AGENTS.md](./AGENTS.md)「發版」
- 架構與設定：[DEPLOYMENT.md](./docs/DEPLOYMENT.md)
- 版本紀錄：[CHANGELOG.md](./CHANGELOG.md)

---

**準備好開始拍賣了嗎？請查閱 [DEVELOPMENT.md](https://www.google.com/search?q=./docs/DEVELOPMENT.md) 了解更多細節。**
