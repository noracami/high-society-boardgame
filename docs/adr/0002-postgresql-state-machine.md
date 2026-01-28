# ADR-0002: 使用 PostgreSQL 處理回合狀態而非 Redis

- **狀態 (Status)**: Accepted
- **日期 (Date)**: 2026-01-28
- **參與者 (Deciders)**: [noracami](https://github.com/noracami)

---

## 1. 背景與問題 (Context)

回合制遊戲需要儲存進行中的對局狀態，並確保伺服器重啟後狀態不丟失。我們需要決定使用哪種資料儲存方案。

- **現狀**: 專案剛啟動，尚未選定資料庫。
- **痛點**: 遊戲狀態需要持久化，避免伺服器重啟導致對局中斷。
- **限制**: 單機部署，資源有限。

---

## 2. 考量方案 (Options Considered)

### 方案 A: Redis（記憶體資料庫）

- **描述**: 使用 Redis 儲存熱狀態，搭配 RDB/AOF 持久化。
- **優點**:
  - 極低延遲
  - 內建 Pub/Sub 可用於狀態廣播
- **缺點**:
  - 需額外維護一個服務
  - 持久化設定較複雜
  - 未來若需歷史紀錄查詢，仍需搭配關聯式資料庫

### 方案 B: PostgreSQL + JSONB

- **描述**: 使用 PostgreSQL 的 JSONB 欄位儲存遊戲狀態，同一資料庫處理熱狀態與歷史紀錄。
- **優點**:
  - 單一資料庫，架構簡單
  - 原生支援 Transaction，避免競態條件
  - JSONB 查詢效能足夠應付回合制遊戲
  - 歷史紀錄、統計查詢一併解決
- **缺點**:
  - 延遲略高於 Redis（但對回合制遊戲可接受）

---

## 3. 最終決策 (Decision)

**我們決定採用方案 B：PostgreSQL + JSONB**。

### 為什麼選它？

- 回合制遊戲的併發需求不高，PostgreSQL 的效能綽綽有餘
- Node.js 單執行緒配合 Transaction 已能處理競態條件
- 減少維運複雜度：只需維護一個資料庫服務
- 未來擴展（勝率統計、對局歷史）不需額外架構變動

---

## 4. 後果與影響 (Consequences)

- **正面影響**:
  - 伺服器重啟後，玩家可無縫回到進行中的對局
  - 開發時使用 Prisma ORM，型別安全
- **負面影響**:
  - 若未來需要即時排行榜等高頻讀取場景，可能需引入快取層
- **後續行動**:
  - 使用 Prisma 定義 Schema
  - 所有狀態變更必須封裝在 `prisma.$transaction` 中

---

## 5. 相關紀錄 (References)

- [Prisma 官方文件](https://www.prisma.io/docs)
- [PostgreSQL JSONB 文件](https://www.postgresql.org/docs/current/datatype-json.html)
