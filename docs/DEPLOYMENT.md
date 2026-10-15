# 🚢 部署指南 (Deployment Guide)

正式站：`https://hs.miao-bao.cc`。跑在單台 GCP VM 上的 [Dokploy](https://dokploy.com)（Docker Swarm），對外走 Cloudflare Tunnel。主機與 tunnel 的設定放在另一個私有的 infra repo，這裡只記與這個專案有關的部分。決策背景見 [ADR-0005](./adr/0005-dokploy-deployment.md)。

---

## 1. 部署架構

```
release PR merge → GitHub Actions：E2E → 核准 → build image 推 ghcr → 打 Dokploy webhook → 打 vX.Y.Z tag
                                                                         │
Discord iframe → Cloudflare → Tunnel → Traefik（Dokploy）→ Node.js 容器 ──┘
                                                          └→ Postgres（Dokploy，內網）
```

- **Image**：`ghcr.io/noracami/high-society-boardgame`（public），tag `:X.Y.Z`、`:X.Y`、`:latest`、`:<sha>`。
- **Build**：`lathyrus-odoratus/dokploy-deploy@v1`，在 GitHub Actions 的 amd64 runner 上 build。`VITE_DISCORD_CLIENT_ID` 是 build-time 參數（前端會打包進去）。
- **資料庫**：Dokploy 的 Postgres 服務（postgres:17），只在內網，每天備份到 R2。
- **Migration**：容器啟動時先跑 `prisma migrate deploy` 再啟動伺服器（見 `Dockerfile` 的 `CMD`）。
- **健康檢查**：`Dockerfile` 的 `HEALTHCHECK` 打 `/up`。Swarm 用它判斷新版本能不能接流量，失敗會自動回滾。

---

## 2. 發版流程

一般 PR merge 進 `main` 只跑 E2E，**不會部署**。merge 一個改了 `packages/backend/package.json` 版號的 PR（release PR）才會：`.github/workflows/release.yml` 跑 E2E，等 `production` environment 的審核者核准，build＋推 ghcr＋觸發 Dokploy，成功後打 `vX.Y.Z` tag。步驟見 [AGENTS.md](../AGENTS.md)「發版」。

---

## 3. 設定放在哪裡

| 設定 | 位置 |
|---|---|
| `DATABASE_URL`、`DISCORD_CLIENT_ID`、`DISCORD_CLIENT_SECRET` | Dokploy → high-society app → Environment |
| `VITE_DISCORD_CLIENT_ID`（build-time） | GitHub repo secret `DISCORD_CLIENT_ID` |
| `DOKPLOY_WEBHOOK` | GitHub Environment `production` 的 secret |

**不要把密碼寫進 git。**舊的 Kamal 設定檔 `config/deploy.yml` 曾經用明文寫著 DB 密碼，那個資料庫已經不存在，新資料庫用的是不同的密碼。

---

## 4. 部署限制

- **單副本、先停後起**：Socket.io 的連線與房間廣播在程序記憶體裡，兩個副本同時在線會讓同一局的玩家分散在兩邊。Dokploy 的更新與回滾順序都設成 `stop-first`。遊戲狀態本身存在 Postgres（`Room.gameState`），重啟後可以接續。
- **部署時玩家會斷線幾秒**：前端會自動重連。
- **Discord Activity 的 URL Mapping**：Developer Portal 的 root mapping 指向 `hs.miao-bao.cc`。換網域時要一起改。

---

## 5. 回滾

在 Dokploy 把 image 改成之前的 `:X.Y.Z` 再 redeploy。版號打過 tag 就不再重用。Migration 不會自動回退，要回到舊 schema 必須另外寫 migration。
