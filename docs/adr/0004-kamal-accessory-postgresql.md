# ADR-0004: 使用 Kamal Accessory 部署 PostgreSQL

- **狀態 (Status)**: Accepted
- **日期 (Date)**: 2026-01-30
- **參與者 (Deciders)**: [noracami](https://github.com/noracami)

---

## 1. 背景與問題 (Context)

Phase 2 需要 PostgreSQL 來儲存房間和玩家狀態。我們需要決定 production 環境的資料庫部署方式。

- **現狀**: 本地開發使用 docker-compose 啟動 PostgreSQL。
- **痛點**: Production 需要持久化、可靠的資料庫服務。
- **限制**: 單機部署，希望維運簡單、成本低。

---

## 2. 考量方案 (Options Considered)

### 方案 A: Managed Database Service（Supabase / Neon / Railway）

- **描述**: 使用第三方託管的 PostgreSQL 服務，透過連線字串注入。
- **優點**:
  - 自動備份、監控
  - 換 VM 時只需改連線字串
  - 免維護
- **缺點**:
  - 免費額度有限（約 500MB）
  - 資料存放在第三方
  - 網路延遲略高（跨網路）

### 方案 B: Kamal Accessory 自架

- **描述**: 使用 Kamal 的 accessory 功能，在同一台 VM 上部署 PostgreSQL container。
- **優點**:
  - 零額外費用（使用現有 VM）
  - 資料在自己機器上
  - 低延遲（同機器通訊）
  - 與現有 Kamal 部署流程整合
- **缺點**:
  - 備份需自行處理
  - 換 VM 需手動 migrate 資料
  - 資料庫生命週期綁定 VM

---

## 3. 最終決策 (Decision)

**我們決定採用方案 B：Kamal Accessory 自架**。

### 為什麼選它？

- 專案初期資料量小，managed service 的優勢不明顯
- VM 預期長期穩定使用，不常更換
- 簡化架構：所有服務都由 Kamal 管理
- 零額外成本

---

## 4. 後果與影響 (Consequences)

- **正面影響**:
  - 部署配置集中在 `deploy.yml`
  - 資料庫與應用同機器，延遲最低
- **負面影響**:
  - 需定期手動備份（可用 cron + pg_dump）
  - VM 硬碟故障會導致資料遺失
- **後續行動**:
  - 在 `deploy.yml` 加入 db accessory 配置
  - 考慮加入定期備份機制（Phase 3+）

---

## 附錄：密碼明碼儲存決策

**決定將 `POSTGRES_PASSWORD` 明碼寫在 `deploy.yml` 中。**

### 為什麼可接受？

| 因素 | 評估 |
|------|------|
| 網路隔離 | PostgreSQL 只暴露於 Docker 內網，無外部 port mapping |
| 攻擊面 | 攻擊者需先入侵 VM，屆時密碼已非主要防線 |
| Repo 可見性 | 私有 repo，只有授權成員可見 |
| 維運簡化 | 省去 secrets 管理，降低部署複雜度 |

### 風險接受

- 接受 repo 公開後密碼可見的風險（DB 僅內網可存取，無實際危害）
- 此決策僅適用於內網資料庫，不適用於暴露外網的服務

---

## 5. 相關紀錄 (References)

- [Kamal Accessories 文件](https://kamal-deploy.org/docs/configuration/accessories/)
- [ADR-0002: PostgreSQL + JSONB](./0002-postgresql-state-machine.md)
