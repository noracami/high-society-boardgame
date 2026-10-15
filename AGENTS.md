# high society

This file provides guidance to AI coding agents working with this repository.

## 專案概述

「上流社會 (High Society)」是一款 Discord Activity 回合制策略桌遊，玩家在 Discord 語音頻道內進行即時競標。

## 目前開發階段

> 完整 Roadmap 請參考 [ROADMAP.md](./ROADMAP.md)

**Phase 7: 潤飾** ← 下一階段

> Phase 6 已完成（完整規則實作）

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
- **Dokploy 部署**：Docker 容器化，單副本 `stop-first`；Cloudflare Tunnel＋Traefik 處理 TLS 與 WebSocket 轉發

## 部署

**Production URL**: `https://hs.miao-bao.cc`（架構與設定見 `docs/DEPLOYMENT.md`）

```
PR → CI（E2E：容器＋真的 Postgres）
release PR merge → E2E → 核准 → dokploy-deploy（ghcr）→ Dokploy → tag vX.Y.Z
```

容器啟動時先跑 `prisma migrate deploy`；新增 migration 不需要額外步驟，但要確認它能在既有資料上跑。

## 發版

**一般 PR merge 進 `main` 不會部署，merge release PR 才會**——也就是改了 `packages/backend/package.json` 的 `version` 的 PR。`.github/workflows/release.yml` 看到版號 X.Y.Z 還沒有 `vX.Y.Z` tag，就跑 E2E、build image、打 Dokploy webhook，成功後才在該 commit 打上 `vX.Y.Z`。版號已經有 tag 的 push 會被跳過。部署失敗就修好原因、手動重跑 workflow（`workflow_dispatch`）。不要手動推 `v*` tag。

deploy job 跑在 GitHub Environment **`production`**：要審核者（目前是 @noracami）核准才會執行，只有 main 能部署。`DOKPLOY_WEBHOOK` 是這個 environment 的 secret。

**什麼時候該提議發版（agent）**——只提議，不要自己動手：

- 剛 merge 了一個 `feat`／`fix`／`perf` 且改到 `packages/` 或 `Dockerfile` 的 PR；
- 使用者要求部署或上線；
- session 開始時 `git log $(git describe --tags --match 'v*' --abbrev=0)..origin/main --oneline -- packages Dockerfile` 不是空的（提一次就好）。

**沒有使用者同意，絕對不要 merge release PR**——merge 就是部署到正式站。

**步驟：**

1. 找出上一個 tag 之後 merge 的 PR：
   ```sh
   LAST=$(git describe --tags --match 'v*' --abbrev=0)
   git log --merges --first-parent "$LAST"..origin/main --format='%s'   # "Merge pull request #N …"
   gh pr view <N> --json title,files
   ```
2. 決定版號：有 `feat` → minor，只有 `fix`／`perf` → patch。沒有值得發的就不發。
3. 開 branch，改 `packages/backend/package.json` 的 `version`，在 `CHANGELOG.md` 最上面加一節——**一個 PR 一行**，分「新功能」／「修正」，連結 PR：`* <PR 標題去掉類型前綴> ([#N](https://github.com/noracami/high-society-boardgame/pull/N))`。用 merge commit 時同一個改動在 `git log` 會出現兩次，所以以 PR 為單位。
4. 開 PR，標題 `chore: release X.Y.Z`，只含版號與 CHANGELOG。不要在功能 PR 裡順便改版號。
5. merge 後就會部署。部署會讓玩家斷線幾秒、自動重連，遊戲狀態在 DB 不會遺失。確認 *Release* run 成功、`vX.Y.Z` 有打上、`https://hs.miao-bao.cc/up` 回 200。

回滾：在 Dokploy 把 image 改成之前的 `:X.Y.Z` 再 redeploy。**版號打過 tag 就不再重用。**

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
