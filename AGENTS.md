# high society

This file provides guidance to AI coding agents working with this repository.

## 專案概述

「上流社會 (High Society)」是一款 Discord Activity 回合制策略桌遊，玩家在 Discord 語音頻道內進行即時競標。

## 目前開發階段

> 完整 Roadmap 請參考 [ROADMAP.md](./ROADMAP.md)

**Phase 2 補充優化** ← 目前

- [ ] 玩家名稱優先顯示伺服器別名（Guild Nickname）

## 開發指令

```bash
pnpm install    # 安裝依賴
pnpm dev        # 啟動所有開發伺服器 (Turbo)
pnpm build      # 建置所有套件
pnpm test:e2e   # E2E 測試（需要 Docker）
```

## 架構

Turborepo monorepo，使用 pnpm workspace：

```
packages/
├── frontend/   # Vue 3 + Vite + TypeScript
├── backend/    # Express + Socket.io + TypeScript
└── shared/     # 共用型別定義 (@high-society/shared)
```

**核心技術決策：**

- **Authoritative Server 模式**：所有遊戲邏輯在後端驗證，前端僅為狀態投影
- **PostgreSQL JSONB**：儲存遊戲狀態，伺服器重啟不丟失
- **Socket.io Room**：以 Discord `activity_instance_id` 作為房間 ID
- **Kamal 2 部署**：Docker 容器化，Kamal Proxy 處理 TLS 終止與 WebSocket 轉發

## 部署

**Production URL**: `https://hs.miao-bao.cc`

**CI/CD Pipeline** (GitHub Actions):
```
push to main → test (E2E) → deploy (Kamal)
```

- **Runner**: `ubuntu-24.04-arm` (ARM64 原生，與 VM 架構相同)
- **Docker Cache**: test 和 deploy 共用 GHA cache，加速建構
- **Kamal Timeout**:
  - `deploy_timeout: 10` - 等待新 container 健康檢查
  - `drain_timeout: 5` - 等待舊連線結束（配合 localStorage 重連策略）

## 共用型別

`@high-society/shared` 套件定義遊戲核心型別：

- `CardValue`: 手牌面額 (1, 2, 3, 4, 6, 8, 10, 12, 15, 20, 25)
- `Player`: 玩家資料 (id, name, hand, spent)

## Commit 規範

遵循 [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)：

```
<type>(<scope>): <摘要 commit 目的>

<body>
```

**Type**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`

**Scope** (可選): `frontend`, `backend`, `shared`

**範例**:

```
feat(frontend): 實作 Discord OAuth 登入流程

整合 Discord Embedded App SDK，完成 token 交換機制
```

## 注意事項

- 斷線重連需實作狀態回填機制
- Cloudflare 使用時 SSL 模式須設為 Full (Strict)
