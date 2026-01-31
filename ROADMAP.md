# Roadmap

## 設計原則

- **每個 Phase 產出可執行版本**：不是「完成某功能」，而是「可以跑起來做某事」
- **遞增式開發**：後一個 Phase 建立在前一個之上
- **不綁定時間**：完成即推進，沒有 deadline 壓力

---

## Phase 1: 骨架 ✅ 完成

**一句話**：Discord 內打開，看到自己是誰

### 可執行版本

在 Discord 語音頻道開啟 Activity → 畫面顯示「Hello, {你的 Discord 名稱}」

### Checklist

- [x] Activity 可在 Discord 內正常開啟
- [x] 前端取得 Discord authorization code
- [x] 後端用 code 換取 access token
- [x] 前端顯示當前用戶名稱

---

## Phase 2: 連線 + 資料庫 ✅ 完成

**一句話**：多人同時在線，房間狀態持久化

### 可執行版本

4 個人在同一個語音頻道開啟 Activity → 每個人都能看到房間內所有人的名字列表（資料來自 DB）

### Checklist

- [x] 設定 PostgreSQL（Kamal Accessory）
- [x] 設定 Prisma Schema（Room, Player）
- [x] 建立 Socket.io 連線
- [x] 以 `instance_id` 作為 Room ID
- [x] 用戶連線時寫入 DB 並加入房間
- [x] 廣播房間內用戶列表
- [x] 前端顯示所有在線用戶

### 補充優化

- [x] 玩家名稱優先顯示伺服器別名（Guild Nickname），無設定時才用帳號名稱

---

## Phase 3: Lobby ✅ 完成

**一句話**：可以加入遊戲、準備、開始

### 可執行版本

用戶開啟 Activity → 按「加入遊戲」成為玩家 → 按「準備」→ 4~5 人都準備後 → 按「開始」→ 畫面顯示「遊戲開始！」

### Checklist

- [x] Observer / Player / Ready 狀態管理（存入 DB）
- [x] 「加入遊戲」按鈕與邏輯
- [x] 「準備」按鈕與邏輯
- [x] 「開始遊戲」按鈕（全員準備 + 在線才可開始）
- [x] 遊戲開始後切換畫面

---

## Phase 4: 遊戲骨架 ✅ 完成

**一句話**：能發牌、看到自己的手牌

### 可執行版本

遊戲開始 → 每個玩家收到手牌 `[1,2,3,4,6,8,10,12,15,20,25]` → 畫面顯示自己的手牌 → 翻開第一張拍賣牌

### Checklist

- [x] 初始化遊戲狀態
- [x] 發放手牌給所有玩家
- [x] 前端顯示手牌 UI
- [x] 洗牌並翻開第一張拍賣牌
- [x] 前端顯示當前拍賣牌

---

## Phase 5: 拍賣機制（正向） ✅ 完成

**一句話**：能完成一輪正向拍賣

### 可執行版本

翻開綠框牌 → 輪到你時可選牌出價或 Pass → 最後一人得標 → 結算後翻下一張牌

### Checklist

- [x] 回合制輪流機制
- [x] 「出價」：選擇手牌、驗證金額 > 當前最高價
- [x] 「Pass」：退出本輪，收回已出的牌
- [x] 結算：最後一人付出已出牌、獲得拍賣牌
- [x] 廣播遊戲狀態（隱藏他人手牌面額）

---

## Phase 6: 完整規則 ✅ 完成

**一句話**：正向 + 反向拍賣，完整遊戲流程

### 可執行版本

可以玩完一整場遊戲：正向拍賣、反向拍賣、第 4 張紅框牌結束、失格判定、計算分數、顯示勝者

### 牌組分類

| 牌 | 數量 | 外框顏色 | 拍賣類型 |
|---|-----|---------|---------|
| 奢侈品 1-10 | 10張 | 黃框 | forward |
| x2 倍率卡 | 3張 | 紅框 | forward |
| x0.5 倍率卡 | 1張 | 紅框 | reverse |
| -5 扣分卡 | 1張 | 黃框 | reverse |
| 0 零卡 | 1張 | 黃框 | reverse |

**遊戲結束條件**：第 4 張紅框牌（multiplier 類型）翻開時立即結束

### Checklist

- [x] 正向拍賣邏輯：最後一人得標
- [x] 反向拍賣邏輯：第一個 Pass 的人收牌
- [x] 結束條件：第 4 張紅框牌（x2 或 x0.5）翻開
- [x] 失格判定：現金最少者出局
- [x] 計算最終分數（奢侈品總值 × 倍率 + 扣分）
- [x] 顯示遊戲結果畫面
- [x] 顯示玩家獲得的牌（wonCards UI）
- [ ] 沒牌的玩家自動 Pass（優化）
- [ ] 0 卡的完整實作：獲得時立即選擇一張非災難卡丟棄；若當前無非災難卡，下次獲得的第一張奢侈卡要丟棄

---

## Phase 7: 潤飾

**一句話**：斷線重連、UI 優化、錯誤處理

### 可執行版本

穩定可玩的遊戲體驗，斷線可重連，有適當的錯誤提示

### Checklist

- [ ] 斷線重連：回填遊戲狀態
- [ ] 錯誤處理：網路異常、非法操作提示

### 實作備註

**斷線重連策略**

部署時 Kamal proxy 會 drain 舊連線，超過 `drain_timeout` 後強制斷開 WebSocket。Socket.io 會自動重連，但 client-side 的 UI 狀態（如：選牌中但尚未送出）會遺失。

解決方案：用 localStorage 暫存 pending 狀態，重連後還原。

```typescript
// 選牌時
localStorage.setItem('pendingBid', JSON.stringify({
  cards: selectedCards,
  timestamp: Date.now(),
  roundId: currentRound.id
}))

// 重連後
const pending = JSON.parse(localStorage.getItem('pendingBid') || 'null')
if (pending
    && Date.now() - pending.timestamp < 60_000  // 1 分鐘內有效
    && pending.roundId === currentRound.id) {
  selectedCards = pending.cards
}

// 出牌成功後
localStorage.removeItem('pendingBid')
```
- [ ] UI/UX 改善：動畫、音效（可選）
- [ ] 紅框牌視覺區分：倍率卡（x2, x0.5）顯示紅色外框，與黃框牌明顯區隔
- [ ] 遊戲結束後可「再來一局」

---

## 後續迭代（待規劃）

- 觀戰模式
- 遊戲歷史紀錄
- 勝率統計
- 更多卡牌變體規則

---

## 開發工具（待規劃）

### Debug 模式

**目標**：方便測試，不需湊齊 4 人即可開始遊戲

**方案評估**：

| 方案 | 說明 | 狀態 |
|------|------|------|
| A. Server 環境變數 | `MIN_PLAYERS=2` 在 dev 環境 | 適合區分環境 |
| B. 隱藏手勢觸發 | 連點標題 5 次開啟 debug panel | 長期方案 |
| C. 直接改常數 | 開發期間 `MIN_PLAYERS=2` | ✅ 目前採用 |

**短期**：方案 C，直接修改 `MIN_PLAYERS` 常數

**長期**：方案 B，實作隱藏手勢開啟 debug panel，可調整：
- 最低/最高玩家人數
- 跳過準備檢查
- 模擬玩家加入（COM player）

**備註**：Discord Activity 無法控制 URL query parameter，排除 URL 參數方案

---

## CI/CD 改進（待規劃）

- [x] Workflow 觸發範圍優化：文件變更（*.md）不應觸發 deploy workflow
