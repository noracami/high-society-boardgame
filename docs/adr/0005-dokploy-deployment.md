# ADR-0005: 改用 Dokploy 部署，取代 Kamal

- **狀態 (Status)**: Accepted
- **日期 (Date)**: 2026-10-15
- **參與者 (Deciders)**: [noracami](https://github.com/noracami)
- **取代 (Supersedes)**: [ADR-0004](./0004-kamal-accessory-postgresql.md)

---

## 1. 背景與問題 (Context)

- **現狀**: 原本用 Kamal 2 部署到一台 ARM VM，Postgres 是 Kamal accessory，映像檔放在 GCP Artifact Registry。2026-07 那台 VM 退場時，這個專案跟著下線（資料庫最終備份留存）。
- **痛點**: 原本的 VM 和 Artifact Registry 都已經不存在。個人的其他服務已經統一搬到一台 amd64 VM 上的 Dokploy。
- **需求/限制**: 跟其他服務共用同一台機器與同一套部署流程；部署要經過人工核准。

---

## 2. 考量方案 (Options Considered)

### 方案 A: 沿用 Kamal，部署到新的 VM

- **優點**: 設定檔現成。
- **缺點**: 要和 Dokploy 搶 80/443 port，同一台機器上會有兩套 proxy 和兩種部署方式。

### 方案 B: 改用 Dokploy

- **優點**: 跟其他服務共用 Traefik、Cloudflare Tunnel、備份排程與 `dokploy-deploy` action；Postgres 由 Dokploy 管理。
- **缺點**: Migration 改成容器啟動時執行；要另外設定 `stop-first`。

---

## 3. 最終決策 (Decision)

**我們決定採用方案 B（Dokploy）**。映像檔改推 ghcr，release PR 觸發部署並經 GitHub Environment `production` 核准。細節見 [DEPLOYMENT.md](../DEPLOYMENT.md)。
