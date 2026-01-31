import {
  AuctionCard,
  AuctionResult,
  CardValue,
  ClientAuctionRoundState,
  DECK_CARDS,
  GameState,
  INITIAL_HAND,
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
  // Phase 5 只使用正向拍賣牌
  const forwardCards = DECK_CARDS.filter(
    (card) => card.auctionType === "forward"
  );
  return forwardCards.map((card) => ({
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
  };

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
  const activePlayers = [...gameState.turnOrder];

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
    return settleAuction(gameState);
  }

  // 調整 currentBidderIndex（如果移除的玩家在當前玩家之前或正好是當前玩家）
  if (auctionRound.currentBidderIndex >= auctionRound.activePlayers.length) {
    auctionRound.currentBidderIndex = 0;
  }

  return { success: true, auctionEnded: false };
}

// 輪到下一位玩家
function advanceToNextBidder(auctionRound: InternalAuctionRoundState): void {
  auctionRound.currentBidderIndex =
    (auctionRound.currentBidderIndex + 1) % auctionRound.activePlayers.length;
}

// 結算拍賣
export function settleAuction(gameState: InternalGameState): PassResult {
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

  // 翻開下一張牌
  const nextCard = revealNextCard(gameState);

  if (nextCard) {
    // 開始新拍賣輪
    startAuctionRound(gameState);
  } else {
    // 遊戲結束
    gameState.auctionRound = null;
    gameState.currentCard = null;
  }

  return { success: true, auctionEnded: true, auctionResult: result };
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
