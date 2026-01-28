# ADR-0003: 採用 pnpm Workspaces 建構 Monorepo

- **狀態 (Status)**: Accepted
- **日期 (Date)**: 2026-01-28
- **參與者 (Deciders)**: [noracami](https://github.com/noracami)

---

## 1. 背景與問題 (Context)

專案包含前端、後端與共用型別定義，需要決定程式碼的組織方式。

- **現狀**: 專案剛啟動，需決定 Repository 結構。
- **痛點**: 前後端共用型別定義，需確保型別一致性。
- **限制**: 團隊規模小，希望維護成本低。

---

## 2. 考量方案 (Options Considered)

### 方案 A: 多 Repository（Polyrepo）

- **描述**: 前端、後端、共用型別各自獨立 Repository。
- **優點**:
  - 各專案獨立版本控制
  - CI/CD 觸發條件清晰
- **缺點**:
  - 共用型別需發布到 npm，增加維護成本
  - 跨專案修改需多次 PR

### 方案 B: pnpm Workspaces Monorepo

- **描述**: 單一 Repository，使用 pnpm workspaces 管理多個 package。
- **優點**:
  - 共用型別透過 `workspace:*` 直接引用，無需發布
  - 單一 PR 可同時修改前後端
  - Turborepo 可平行執行 build/dev
- **缺點**:
  - 初期設定較複雜
  - Repository 體積較大

---

## 3. 最終決策 (Decision)

**我們決定採用方案 B：pnpm Workspaces Monorepo**。

### 為什麼選它？

- 共用型別 (`@high-society/shared`) 可直接引用，確保前後端型別一致
- 單一 Repository 降低維護成本
- Turborepo 提供優秀的開發體驗（平行執行、快取）

---

## 4. 後果與影響 (Consequences)

- **正面影響**:
  - 型別變更立即反映在前後端
  - `pnpm dev` 一鍵啟動所有服務
- **負面影響**:
  - 需熟悉 pnpm workspaces 語法
- **後續行動**:
  - 設定 `pnpm-workspace.yaml`
  - 設定 `turbo.json` 定義 task pipeline

---

## 5. 相關紀錄 (References)

- [pnpm Workspaces 文件](https://pnpm.io/workspaces)
- [Turborepo 文件](https://turbo.build/repo/docs)
