import {
  AuctionCard,
  AuctionResult,
  CardValue,
  ClientAuctionRoundState,
  DECK_CARDS,
  FinalScore,
  GameEndResult,
  GameState,
  INITIAL_HAND,
  ObserverAuctionRoundState,
  ObserverGameState,
  PlayerBid,
  PlayerGameState,
  PublicPlayerBid,
  PublicPlayerGameState,
} from "@high-society/shared";

// 內部拍賣輪狀態
export interface InternalAuctionRoundState {
  phase: "bidding" | "settling";
  activePlayers: string[]; // 尚未 Pass 的玩家 ID
  bids: Record<string, PlayerBid>; // 各玩家已出的牌
  currentHighest: number; // 當前最高出價
  currentBidderIndex: number; // 輪到誰（在 activePlayers 中的 index）
}

// 內部遊戲狀態（包含完整資訊，儲存於 DB）
export interface InternalGameState {
  deck: AuctionCard[];
  currentCard: AuctionCard | null;
  discardPile: AuctionCard[];
  turnOrder: string[];
  currentPlayerIndex: number;
  players: Record<string, PlayerGameState>;
  auctionRound: InternalAuctionRoundState | null;
  redCardCount: number; // 已翻出的紅框牌數量（multiplier 類型：x2, x0.5）
  gameEnded: boolean; // 遊戲是否已結束
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function shuffleDeck<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function createDeck(): AuctionCard[] {
  // 使用全部牌組（正向 + 反向）
  return DECK_CARDS.map((card) => ({
    ...card,
    id: generateId(),
  }));
}

export function createInitialGameState(playerIds: string[]): InternalGameState {
  const deck = shuffleDeck(createDeck());

  // 發手牌給每位玩家
  const players: Record<string, PlayerGameState> = {};
  for (const playerId of playerIds) {
    players[playerId] = {
      hand: [...INITIAL_HAND] as CardValue[],
      wonCards: [],
      spentTotal: 0,
    };
  }

  // 隨機決定回合順序
  const turnOrder = shuffleDeck([...playerIds]);

  // 翻開第一張牌
  const currentCard = deck.pop() || null;

  const state: InternalGameState = {
    deck,
    currentCard,
    discardPile: [],
    turnOrder,
    currentPlayerIndex: 0,
    players,
    auctionRound: null,
    redCardCount: 0,
    gameEnded: false,
  };

  // 檢查第一張牌是否為紅框牌（multiplier 類型：x2, x0.5）
  if (currentCard && currentCard.type === "multiplier") {
    state.redCardCount = 1;
    // 第 4 張紅框牌翻開時遊戲立即結束
    if (state.redCardCount >= 4) {
      state.gameEnded = true;
      state.auctionRound = null;
      return state;
    }
  }

  // 自動開始第一輪拍賣
  if (currentCard) {
    startAuctionRound(state);
  }

  return state;
}

export function revealNextCard(gameState: InternalGameState): AuctionCard | null {
  if (gameState.deck.length === 0) {
    return null;
  }
  const card = gameState.deck.pop()!;
  gameState.currentCard = card;
  return card;
}

// 開始新的拍賣輪
export function startAuctionRound(gameState: InternalGameState): void {
  // 活躍玩家列表（從當前玩家開始的順序）
  const startIndex = gameState.currentPlayerIndex;
  const activePlayers = [
    ...gameState.turnOrder.slice(startIndex),
    ...gameState.turnOrder.slice(0, startIndex),
  ];

  // 初始化所有玩家的出價
  const bids: Record<string, PlayerBid> = {};
  for (const playerId of activePlayers) {
    bids[playerId] = {
      playerId,
      cards: [],
      total: 0,
    };
  }

  gameState.auctionRound = {
    phase: "bidding",
    activePlayers,
    bids,
    currentHighest: 0,
    currentBidderIndex: 0,
  };
}

// 處理出價
export interface BidResult {
  success: boolean;
  error?: string;
}

export function processBid(
  gameState: InternalGameState,
  playerId: string,
  cards: CardValue[]
): BidResult {
  const auctionRound = gameState.auctionRound;
  if (!auctionRound || auctionRound.phase !== "bidding") {
    return { success: false, error: "目前不在拍賣階段" };
  }

  // 確認輪到該玩家
  const currentBidderId = auctionRound.activePlayers[auctionRound.currentBidderIndex];
  if (currentBidderId !== playerId) {
    return { success: false, error: "還沒輪到你" };
  }

  // 確認該玩家還在活躍玩家列表中
  if (!auctionRound.activePlayers.includes(playerId)) {
    return { success: false, error: "你已經 Pass 了" };
  }

  const playerState = gameState.players[playerId];
  if (!playerState) {
    return { success: false, error: "找不到玩家" };
  }

  // 計算新出價總額（之前已出的牌 + 新出的牌）
  const previousBid = auctionRound.bids[playerId];
  const newCards = [...previousBid.cards, ...cards];
  const newTotal = newCards.reduce((sum, card) => sum + card, 0);

  // 確認新出價 > 當前最高價
  if (newTotal <= auctionRound.currentHighest) {
    return { success: false, error: `出價必須高於 ${auctionRound.currentHighest}` };
  }

  // 確認牌在手中
  const handCopy = [...playerState.hand];
  for (const card of cards) {
    const cardIndex = handCopy.indexOf(card);
    if (cardIndex === -1) {
      return { success: false, error: `手中沒有 ${card} 這張牌` };
    }
    handCopy.splice(cardIndex, 1);
  }

  // 從手牌移除已出的牌
  for (const card of cards) {
    const cardIndex = playerState.hand.indexOf(card);
    playerState.hand.splice(cardIndex, 1);
  }

  // 更新出價
  auctionRound.bids[playerId] = {
    playerId,
    cards: newCards,
    total: newTotal,
  };
  auctionRound.currentHighest = newTotal;

  // 輪到下一位玩家
  advanceToNextBidder(auctionRound);

  return { success: true };
}

// 處理 Pass
export interface PassResult {
  success: boolean;
  error?: string;
  auctionEnded?: boolean;
  auctionResult?: AuctionResult;
  gameEnded?: boolean;
}

export function processPass(gameState: InternalGameState, playerId: string): PassResult {
  const auctionRound = gameState.auctionRound;
  if (!auctionRound || auctionRound.phase !== "bidding") {
    return { success: false, error: "目前不在拍賣階段" };
  }

  // 確認輪到該玩家
  const currentBidderId = auctionRound.activePlayers[auctionRound.currentBidderIndex];
  if (currentBidderId !== playerId) {
    return { success: false, error: "還沒輪到你" };
  }

  // 確認該玩家還在活躍玩家列表中
  const playerIndex = auctionRound.activePlayers.indexOf(playerId);
  if (playerIndex === -1) {
    return { success: false, error: "你已經 Pass 了" };
  }

  const playerState = gameState.players[playerId];
  if (!playerState) {
    return { success: false, error: "找不到玩家" };
  }

  const currentCard = gameState.currentCard;
  if (!currentCard) {
    return { success: false, error: "沒有拍賣牌" };
  }

  // 根據拍賣類型分流處理
  if (currentCard.auctionType === "reverse") {
    return processPassReverse(gameState, playerId, playerIndex);
  } else {
    return processPassForward(gameState, playerId, playerIndex);
  }
}

// 正向拍賣 Pass（原邏輯）
function processPassForward(
  gameState: InternalGameState,
  playerId: string,
  playerIndex: number
): PassResult {
  const auctionRound = gameState.auctionRound!;
  const playerState = gameState.players[playerId];

  // 收回已出的全部牌到手牌
  const playerBid = auctionRound.bids[playerId];
  if (playerBid && playerBid.cards.length > 0) {
    playerState.hand.push(...playerBid.cards);
    playerState.hand.sort((a, b) => a - b);
  }

  // 從活躍玩家移除
  auctionRound.activePlayers.splice(playerIndex, 1);

  // 清空該玩家的出價記錄
  delete auctionRound.bids[playerId];

  // 若只剩一人 → 結算
  if (auctionRound.activePlayers.length === 1) {
    return settleAuctionForward(gameState);
  }

  // 調整 currentBidderIndex（如果移除的玩家在當前玩家之前或正好是當前玩家）
  if (auctionRound.currentBidderIndex >= auctionRound.activePlayers.length) {
    auctionRound.currentBidderIndex = 0;
  }

  return { success: true, auctionEnded: false };
}

// 反向拍賣 Pass（第一個 Pass 的人得牌，其他人失去已出的牌）
function processPassReverse(
  gameState: InternalGameState,
  playerId: string,
  _playerIndex: number
): PassResult {
  const auctionRound = gameState.auctionRound!;
  const currentCard = gameState.currentCard!;

  // 第一個 Pass 的玩家直接得牌（免費但得到負面牌）
  const winnerState = gameState.players[playerId];
  winnerState.wonCards.push(currentCard);

  // Pass 的玩家收回自己已出的牌（因為他免費獲得，不用花費）
  const winnerBid = auctionRound.bids[playerId];
  if (winnerBid && winnerBid.cards.length > 0) {
    winnerState.hand.push(...winnerBid.cards);
    winnerState.hand.sort((a, b) => a - b);
  }

  // 其他所有玩家繳出已出的牌（失去，計入 spentTotal）
  for (const [otherPlayerId, bid] of Object.entries(auctionRound.bids)) {
    if (otherPlayerId !== playerId && bid.cards.length > 0) {
      const otherState = gameState.players[otherPlayerId];
      otherState.spentTotal += bid.total;
      // 牌已經從手牌移除，不用再做處理
    }
  }

  // 記錄結算結果
  const result: AuctionResult = {
    winnerId: playerId,
    card: currentCard,
    spentCards: [], // 反向拍賣得牌者免費
    spentTotal: 0,
  };

  // 設置下一輪的起始玩家為得牌者
  const winnerTurnIndex = gameState.turnOrder.indexOf(playerId);
  if (winnerTurnIndex !== -1) {
    gameState.currentPlayerIndex = winnerTurnIndex;
  }

  // 翻開下一張牌並檢查遊戲結束條件
  const nextCard = revealNextCard(gameState);

  if (nextCard) {
    // 檢查是否為紅框牌（multiplier 類型：x2, x0.5）
    if (nextCard.type === "multiplier") {
      gameState.redCardCount++;
      // 第 4 張紅框牌翻開時遊戲立即結束
      if (gameState.redCardCount >= 4) {
        gameState.gameEnded = true;
        gameState.auctionRound = null;
        gameState.currentCard = nextCard; // 保留最後一張牌以供顯示
        return { success: true, auctionEnded: true, auctionResult: result, gameEnded: true };
      }
    }
    // 開始新拍賣輪
    startAuctionRound(gameState);
  } else {
    // 牌組用完，遊戲結束
    gameState.gameEnded = true;
    gameState.auctionRound = null;
    gameState.currentCard = null;
  }

  return { success: true, auctionEnded: true, auctionResult: result, gameEnded: gameState.gameEnded };
}

// 輪到下一位玩家
function advanceToNextBidder(auctionRound: InternalAuctionRoundState): void {
  auctionRound.currentBidderIndex =
    (auctionRound.currentBidderIndex + 1) % auctionRound.activePlayers.length;
}

// 結算正向拍賣
function settleAuctionForward(gameState: InternalGameState): PassResult {
  const auctionRound = gameState.auctionRound;
  if (!auctionRound || auctionRound.activePlayers.length !== 1) {
    return { success: false, error: "無法結算" };
  }

  const winnerId = auctionRound.activePlayers[0];
  const winnerState = gameState.players[winnerId];
  const winnerBid = auctionRound.bids[winnerId];
  const currentCard = gameState.currentCard;

  if (!winnerState || !currentCard) {
    return { success: false, error: "結算時發生錯誤" };
  }

  // 記錄結算結果
  const result: AuctionResult = {
    winnerId,
    card: currentCard,
    spentCards: winnerBid ? winnerBid.cards : [],
    spentTotal: winnerBid ? winnerBid.total : 0,
  };

  // 得標者失去已出的牌（已從手牌移除）
  // 更新 spentTotal
  if (winnerBid) {
    winnerState.spentTotal += winnerBid.total;
  }

  // 得標者獲得拍賣卡
  winnerState.wonCards.push(currentCard);

  // 設置下一輪的起始玩家為得標者
  const winnerTurnIndex = gameState.turnOrder.indexOf(winnerId);
  if (winnerTurnIndex !== -1) {
    gameState.currentPlayerIndex = winnerTurnIndex;
  }

  // 翻開下一張牌並檢查遊戲結束條件
  const nextCard = revealNextCard(gameState);

  if (nextCard) {
    // 檢查是否為紅框牌（multiplier 類型：x2, x0.5）
    if (nextCard.type === "multiplier") {
      gameState.redCardCount++;
      // 第 4 張紅框牌翻開時遊戲立即結束
      if (gameState.redCardCount >= 4) {
        gameState.gameEnded = true;
        gameState.auctionRound = null;
        gameState.currentCard = nextCard; // 保留最後一張牌以供顯示
        return { success: true, auctionEnded: true, auctionResult: result, gameEnded: true };
      }
    }
    // 開始新拍賣輪
    startAuctionRound(gameState);
  } else {
    // 牌組用完，遊戲結束
    gameState.gameEnded = true;
    gameState.auctionRound = null;
    gameState.currentCard = null;
  }

  return { success: true, auctionEnded: true, auctionResult: result, gameEnded: gameState.gameEnded };
}

// 舊函數保留相容性（轉調新函數）
export function settleAuction(gameState: InternalGameState): PassResult {
  return settleAuctionForward(gameState);
}

// 轉換為客戶端視角的遊戲狀態（隱藏敏感資訊）
export function toClientGameState(
  internalState: InternalGameState,
  viewerPlayerId: string
): GameState {
  const otherPlayers: Record<string, PublicPlayerGameState> = {};

  for (const [playerId, playerState] of Object.entries(internalState.players)) {
    if (playerId !== viewerPlayerId) {
      otherPlayers[playerId] = {
        handCount: playerState.hand.length,
        wonCards: playerState.wonCards,
        spentTotal: playerState.spentTotal,
      };
    }
  }

  // 轉換拍賣輪狀態
  let auctionRound: ClientAuctionRoundState | null = null;
  if (internalState.auctionRound) {
    const internalAuction = internalState.auctionRound;
    const currentBidderId = internalAuction.activePlayers[internalAuction.currentBidderIndex];

    // 自己的完整出價資訊
    const myBid = internalAuction.bids[viewerPlayerId] || null;

    // 其他玩家的公開出價資訊（隱藏牌面細節）
    const otherBids: Record<string, PublicPlayerBid> = {};
    for (const [playerId, bid] of Object.entries(internalAuction.bids)) {
      if (playerId !== viewerPlayerId) {
        otherBids[playerId] = {
          playerId,
          cardCount: bid.cards.length,
          total: bid.total,
        };
      }
    }

    auctionRound = {
      phase: internalAuction.phase,
      activePlayers: internalAuction.activePlayers,
      myBid,
      otherBids,
      currentHighest: internalAuction.currentHighest,
      currentBidderId,
      isMyTurn: currentBidderId === viewerPlayerId,
    };
  }

  return {
    deckCount: internalState.deck.length,
    currentCard: internalState.currentCard,
    discardPile: internalState.discardPile,
    turnOrder: internalState.turnOrder,
    currentPlayerIndex: internalState.currentPlayerIndex,
    myState: internalState.players[viewerPlayerId],
    otherPlayers,
    auctionRound,
  };
}

// 轉換為旁觀者視角的遊戲狀態（隱藏所有玩家的手牌內容和出價牌面）
export function toObserverGameState(internalState: InternalGameState): ObserverGameState {
  const players: Record<string, PublicPlayerGameState> = {};

  for (const [playerId, playerState] of Object.entries(internalState.players)) {
    players[playerId] = {
      handCount: playerState.hand.length,
      wonCards: playerState.wonCards,
      spentTotal: playerState.spentTotal,
    };
  }

  // 轉換拍賣輪狀態（使用 PublicPlayerBid）
  let auctionRound: ObserverAuctionRoundState | null = null;
  if (internalState.auctionRound) {
    const internalAuction = internalState.auctionRound;
    const currentBidderId = internalAuction.activePlayers[internalAuction.currentBidderIndex];

    const bids: Record<string, PublicPlayerBid> = {};
    for (const [playerId, bid] of Object.entries(internalAuction.bids)) {
      bids[playerId] = {
        playerId,
        cardCount: bid.cards.length,
        total: bid.total,
      };
    }

    auctionRound = {
      phase: internalAuction.phase,
      activePlayers: internalAuction.activePlayers,
      bids,
      currentHighest: internalAuction.currentHighest,
      currentBidderId,
    };
  }

  return {
    deckCount: internalState.deck.length,
    currentCard: internalState.currentCard,
    discardPile: internalState.discardPile,
    turnOrder: internalState.turnOrder,
    currentPlayerIndex: internalState.currentPlayerIndex,
    players,
    auctionRound,
  };
}

// 初始手牌總和（用於計算剩餘現金）
const INITIAL_MONEY = INITIAL_HAND.reduce((sum, card) => sum + card, 0); // 66

// 計算最終分數
export function calculateFinalScores(
  gameState: InternalGameState,
  playerNames: Record<string, string>
): GameEndResult {
  const scores: FinalScore[] = [];

  for (const [playerId, playerState] of Object.entries(gameState.players)) {
    // 計算奢侈品總值（luxury 類型的牌）
    const luxuryTotal = playerState.wonCards
      .filter((card) => card.type === "luxury")
      .reduce((sum, card) => sum + card.value, 0);

    // 計算倍率（累乘，x2 × x2 = x4，x2 × x0.5 = x1）
    const multiplier = playerState.wonCards
      .filter((card) => card.type === "multiplier")
      .reduce((acc, card) => acc * card.value, 1);

    // 計算扣分（penalty 類型的牌，value 為 -5）
    const penalty = playerState.wonCards
      .filter((card) => card.type === "penalty")
      .reduce((sum, card) => sum + card.value, 0);

    // 計算剩餘現金
    const remainingMoney = INITIAL_MONEY - playerState.spentTotal;

    // 最終分數 = 奢侈品總值 × 倍率 + 扣分
    const finalScore = luxuryTotal * multiplier + penalty;

    scores.push({
      playerId,
      playerName: playerNames[playerId] || "未知玩家",
      luxuryTotal,
      multiplier,
      penalty,
      finalScore,
      remainingMoney,
      isEliminated: false, // 稍後判定
      wonCards: playerState.wonCards,
    });
  }

  // 找出剩餘現金最少的玩家（失格判定）
  const minMoney = Math.min(...scores.map((s) => s.remainingMoney));

  // 標記出局玩家
  for (const score of scores) {
    if (score.remainingMoney === minMoney) {
      score.isEliminated = true;
    }
  }

  // 分離出局與未出局玩家
  const eliminated = scores.filter((s) => s.isEliminated);
  const active = scores.filter((s) => !s.isEliminated);

  // 按分數排序（高到低）
  active.sort((a, b) => b.finalScore - a.finalScore);
  eliminated.sort((a, b) => b.finalScore - a.finalScore);

  return {
    rankings: active,
    eliminated,
  };
}
