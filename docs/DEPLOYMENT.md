# 🚢 部署指南 (Deployment Guide)

本文件說明 **High Society** 專案的自動化部署流程，包含基礎設施架構、GCP Registry 驗證以及 GitHub Actions 的整合。

---

## 1. 部署架構 (Deployment Architecture)

我們採用 **"Separated Build & Deploy"** 模式，確保伺服器（VM）資源專注於運行遊戲，而非執行繁重的編譯工作。

1. **Build (GHA)**: GitHub Actions 負責打包 Vue 與 Node.js 為單一 Docker Image。
2. **Push (GAR)**: 打包好的 Image 推送到 **GCP Artifact Registry (GAR)**。
3. **Deploy (Kamal)**: GHA 透過 SSH 遙控 VM，指令 VM 從 GAR 抓取 Image 並執行。

---

## 2. 前置需求 (Prerequisites)

在執行首次部署前，必須完成以下設定：

### **A. 伺服器端 (VPS/VM)**

- 系統環境：Ubuntu 22.04+ 或任何支援 Docker 的 Linux 發行版。
- 權限：SSH 存取權限，且該 User 具備執行 `docker` 的權限。
- 防火牆：開啟 `80` (HTTP), `443` (HTTPS) 以及 `22` (SSH) 埠口。

### **B. GCP 雲端設定**

- 啟用 **Artifact Registry**。
- 建立一個 **Service Account** 並給予 `Artifact Registry Reader` 權限。
- 產生 JSON Key，並進行 Base64 編碼，用於 Kamal 登入。

### **C. GitHub Secrets**

請在 GitHub Repo 設定以下 Secrets：

- `SSH_KEY`: 登入 VM 的私鑰。
- `GCP_ARTIFACT_KEY`: GCP Service Account 的 Base64 Key。
- `KAMAL_SECRETS`: 包含資料庫密碼、Discord Client Secret 的 Kamal 加密內容。

---

## 3. Kamal 2 設定檔範本 (`config/deploy.yml`)

這是部署的核心，定義了應用程式與 PostgreSQL 的連動方式。

```yaml
service: high-society
image: [GCP_REGION]-docker.pkg.dev/[PROJECT_ID]/[REPO]/game-app

servers:
  web:
    hosts:
      - [YOUR_VM_IP]

proxy:
  ssl: true
  host: game.miao-bao.cc
  app_port: 3000

registry:
  server: [GCP_REGION]-docker.pkg.dev
  username: _json_key_base64
  password:
    - GCP_ARTIFACT_KEY

accessories:
  db:
    image: postgres:16
    host: [YOUR_VM_IP]
    port: 5432
    env:
      clear:
        POSTGRES_USER: app_user
        POSTGRES_DB: high_society
      secret:
        - POSTGRES_PASSWORD
    directories:
      - /var/lib/postgresql/data:/var/lib/postgresql/data

```

---

## 4. 自動化流程 (GitHub Actions)

當代碼合併至 `main` 時，`.github/workflows/deploy.yml` 會觸發以下流程：

1. **Checkout Code**: 取得最新代碼。
2. **Setup Kamal**: 安裝 Ruby 與 Kamal 2。
3. **Build & Push**: 在 GHA 環境下打包 Docker Image 並推送到 GCP。
4. **Kamal Deploy**:

```bash
kamal deploy --skip-push

```

此指令會透過 SSH 連到伺服器，啟動新容器，通過健康檢查後切換流量。

---

## 5. 常用運維指令 (Operation Commands)

所有指令皆在本地執行，由 Kamal 透過 SSH 轉達給伺服器。

| 指令                        | 說明                                     |
| --------------------------- | ---------------------------------------- |
| `kamal deploy`              | 完整部署流程（打包 + 推送 + 更新）       |
| `kamal rollback`            | 發現 Bug？秒級回滾到上一個穩定版本       |
| `kamal app details`         | 查看目前容器運行狀態與版本               |
| `kamal app logs -f`         | 即時查看伺服器 Log (Socket 排除障礙必備) |
| `kamal accessory reboot db` | 重啟 PostgreSQL 容器                     |

---

## 6. 零停機部署 (Zero-Downtime) 運作原理

Kamal 2 使用 **Kamal Proxy** 來達成無縫切換：

1. **Boot**: 啟動新版本的容器。
2. **Healthcheck**: 每隔一秒檢查一次 `/up` 端點。
3. **Switch**: 只有在新容器回報 `200 OK` 後，Proxy 才會將流量導入新容器。
4. **Prune**: 流量完全切換後，舊容器會被優雅地關閉。

---

## 7. Cloudflare 設定注意事項

若使用 Cloudflare 作為 CDN 與反向代理，需注意以下設定：

### SSL/TLS 模式

**必須設為 Full (Strict)**，原因：

- Kamal Proxy 會自動處理 Let's Encrypt 憑證（HTTPS）
- 若 Cloudflare 設為 Flexible，會導致 HTTP → HTTPS 重新導向迴圈
- Full (Strict) 確保 Cloudflare ↔ Origin 之間也使用 HTTPS

### 設定步驟

1. 進入 Cloudflare Dashboard → 選擇網域
2. **SSL/TLS** → **Overview**
3. 選擇 **Full (Strict)**

### Proxy 狀態

- 開啟「橘色雲朵」(Proxied) 可獲得 CDN 快取與 DDoS 防護
- 若遇到 WebSocket 問題，確認 **Network** → **WebSockets** 已開啟

---

> 所有的秘密（Secrets）都應該保存在 GitHub Secrets 或 `.kamal/secrets` 中，**絕對不要將明文密碼提交到 Git**。如果發現部署失敗，請優先檢查 SSH 通訊與 GCP Registry 的權限設定。
