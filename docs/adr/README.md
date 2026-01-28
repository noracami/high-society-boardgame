# 📜 架構決策紀錄 (Architecture Decision Records, ADR)

這是 **High Society** 專案的技術決策大腦。我們將所有具備「戰略意義」或「不可逆性」的設計決定記錄於此。

---

## 為什麼要寫 ADR？

代碼（The What）告訴我們系統如何運作，但 **ADR（The Why）** 告訴我們為什麼系統長這樣。
我們記錄 ADR 是為了：

1. **保存時空背景**：紀錄當時的技術限制、預算考量或業務壓力。
2. **避免重複爭議**：當有人提議「我們改用某某技術」時，可以回溯當初為何捨棄它。
3. **降低維護成本**：讓新進成員能快速理解架構的靈魂，避免誤判設計意圖。

---

## 決策流程與狀態

每份 ADR 都會經歷以下狀態週期：

- **Proposed (提案中)**：想法已成形，正在進行 Code Review 或團隊討論。
- **Accepted (已通過)**：決策已定，目前專案正依照此路徑實作。
- **Deprecated (已廢棄)**：該決策已不符合現狀，但保留紀錄供後人參考。
- **Superseded (被取代)**：新的決策已完全覆蓋舊的決策（需標註取代者編號）。

---

## ADR 索引目錄

| 編號                                                                           | 狀態        | 標題                                     | 決策日期   |
| ------------------------------------------------------------------------------ | ----------- | ---------------------------------------- | ---------- |
| **[0000](https://www.google.com/search?q=./0000-template.md)**                 | -           | [ADR 輕量化模板]                         | 2026-01-28 |
| **[0001](https://www.google.com/search?q=./0001-initial-architecture.md)**     | ✅ Accepted | [選擇單一入口合體打包方案 (Option A)]    | 2026-01-28 |
| **[0002](https://www.google.com/search?q=./0002-postgresql-state-machine.md)** | ✅ Accepted | [使用 PostgreSQL 處理回合狀態而非 Redis] | 2026-01-28 |
| **[0003](https://www.google.com/search?q=./0003-monorepo-structure.md)**       | ✅ Accepted | [採用 pnpm Workspaces 建構 Monorepo]     | 2026-01-28 |

---

## 如何新增一份紀錄？

1. 複製 **[0000-template.md](https://www.google.com/search?q=./0000-template.md)** 並重新命名為 `NNNN-title.md`。
2. 填寫背景、考量方案與最終決定。
3. 發起 Pull Request (PR)，標籤標註為 `Architecture Decision`。
4. 在團隊討論（或 PR Review）達成共識後合併，狀態更新為 `Accepted`。

---

## 觸發 ADR 的時機 (Checklist)

如果你在開發過程中遇到以下情況，請考慮撰寫 ADR：

- [ ] 這次變動後，如果以後要改回來會非常痛苦？
- [ ] 我在兩個同樣優秀的方案中做出了選擇？
- [ ] 我引入了新的工程規範（例如：所有的 API 都要符合特定格式）？
- [ ] 我為了效能，故意寫了比較不直觀的代碼？

---

> **「決定本身並不昂貴，昂貴的是忘記為什麼做決定。」**
