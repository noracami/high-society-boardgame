# ADR-0001: 選擇單一入口合體打包方案 (Option A)

- **狀態 (Status)**: Accepted
- **日期 (Date)**: 2026-01-28
- **參與者 (Deciders)**: [noracami](https://github.com/noracami)

---

## 1. 背景與問題 (Context)

Discord Activity 運行在 `https://*.discordsays.com` 的 iframe 中，對外部資源有嚴格的 CSP 限制。我們需要決定前後端的部署架構。

- **現狀**: 專案剛啟動，尚未決定部署方式。
- **痛點**: Discord iframe 的跨域限制可能導致 API 呼叫失敗。
- **限制**: 主機上使用 Kamal Proxy 作為統一入口（佔用 80/443），已有其他應用（如 `fizzy`）透過此 Proxy 運行中。

---

## 2. 考量方案 (Options Considered)

### 方案 A: 合體打包（單一入口）

- **描述**: 前端編譯為靜態檔案，由 Node.js 後端透過 `express.static` 一併託管。單一網域服務所有請求。
- **優點**:
  - 徹底解決 CORS 問題（同源）
  - 單一網域，簡化 SSL 憑證管理
  - Discord Developer Portal 設定簡單
- **缺點**:
  - 前後端部署耦合，無法獨立擴展
  - 靜態資源無法獨立使用 CDN（需透過 Cloudflare）

### 方案 B: 分離部署

- **描述**: 前端與後端使用不同子網域（如 `app.example.com` 與 `api.example.com`）。
- **優點**:
  - 前後端可獨立部署與擴展
  - 靜態資源可使用獨立 CDN
- **缺點**:
  - 需處理 CORS 標頭
  - 兩個網域的 SSL 憑證管理
  - Discord CSP 設定更複雜

---

## 3. 最終決策 (Decision)

**我們決定採用方案 A：合體打包**。

### 為什麼選它？

- Discord Activity 的 iframe CSP 限制嚴格，同源架構能大幅減少設定負擔
- 專案規模適中，不需要獨立擴展前後端
- 透過 Cloudflare Proxy 仍可享有 CDN 快取（針對靜態資源）

---

## 4. 後果與影響 (Consequences)

- **正面影響**:
  - 開發時使用 Vite proxy，生產環境同源，體驗一致
  - 部署流程單純：一個 Docker Image 搞定
- **負面影響**:
  - 前端更新必須重新部署整個應用
- **後續行動**:
  - Dockerfile 需包含前端 build 步驟
  - Express 需設定正確的 CSP Header

---

## 5. 相關紀錄 (References)

- [Discord Embedded App SDK 文件](https://discord.com/developers/docs/activities/overview)
- [ADR-0002: PostgreSQL 狀態管理](./0002-postgresql-state-machine.md)
