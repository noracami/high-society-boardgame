# 🤝 貢獻指南 (Contributing Guide)

感謝你對 **High Society** 專案的關注！這是一個強調技術美感與工程嚴謹度的桌遊開發計畫。為了確保開發過程順暢，請在開始動手前閱讀本指南。

---

## 🏗 開發哲學

在 Stoa，我們遵循以下三個核心原則：

1. **Schema 優先**：資料結構是遊戲的靈魂，變動必須最先討論。
2. **型別即合約**：所有通訊封包必須在 `packages/shared` 定義型別。
3. **脈絡重於代碼**：代碼會變，但決策的原因必須透過 ADR 留下。

---

## 🛠 開發流程 (Workflow)

我們採用 GitHub Flow。請遵循以下步驟進行開發：

1. **分支命名**：

- 功能開發：`feat/your-feature-name`
- 修正 Bug：`fix/bug-description`
- 基礎建設：`infra/description`

2. **Schema 變更先行**：

- 如果你的功能涉及資料庫異動，請**先發一個僅包含 Schema 修改的 PR**。
- 獲得認可後再進行後續邏輯開發，避免大規模重構。

3. **提交 (Commit)**：

- 請遵循 [Conventional Commits](https://www.conventionalcommits.org/) 規範。
- 範例：`feat(backend): add auction timer logic`

---

## 🔍 代碼審查 (Code Review) 準則

作為 Reviewer，請使用以下 Checklist 檢查 PR：

- **Schema 變更**：是否符合業務邏輯？命名是否具備語義化？
- **型別一致性**：是否正確引用了 `shared` 裡面的型別？
- **環境邊界**：後端是否處理了 Discord 的權限驗證？前端是否使用相對路徑？
- **ADR 觸發點**：這次變動是否涉及重大決策？
  > **💡 什麼時候要寫 ADR？**
  >
  > - 當你發現自己需要解釋「為什麼不選另一種做法」時。
  > - 當這是一次「不可逆」的重大設計變動時。
  > - 當這是一個「全新的工程慣例」時。

---

## 📝 ADR 撰寫指南

本專案將 ADR 視為與程式碼同等重要的資產。

- **位置**：`/docs/adr`
- **模板**：請參考 `/docs/adr/0000-template.md`。
- **語氣**：客觀、誠實地記錄當下的限制與最終的取捨（Trade-offs）。

---

## 🎨 程式碼風格 (Style Guide)

- **TypeScript**: 強制使用嚴格模式。
- **命名**:
- 變數與函式：`camelCase`
- 類別與型別：`PascalCase`
- 資料庫欄位：`snake_case` (配合 Prisma 對應)

- **API**: 統一使用相對路徑（如 `/api/rooms`），禁止寫死網域。

---

## 🚀 提交 Pull Request (PR)

1. 確保 `pnpm lint` 與 `pnpm test` 皆通過。
2. 在 PR 說明中填寫「為什麼要這樣改」以及「如何測試」。
3. 如果涉及 UI 變動，請附上截圖或螢幕錄影。
