import {
  AuctionCard,
  CardValue,
  DECK_CARDS,
  GameState,
  INITIAL_HAND,
  PlayerGameState,
  PublicPlayerGameState,
} from "@high-society/shared";

// 內部遊戲狀態（包含完整資訊，儲存於 DB）
export interface InternalGameState {
  deck: AuctionCard[];
  currentCard: AuctionCard | null;
  discardPile: AuctionCard[];
  turnOrder: string[];
  currentPlayerIndex: number;
  players: Record<string, PlayerGameState>;
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

  return {
    deck,
    currentCard,
    discardPile: [],
    turnOrder,
    currentPlayerIndex: 0,
    players,
  };
}

export function revealNextCard(gameState: InternalGameState): AuctionCard | null {
  if (gameState.deck.length === 0) {
    return null;
  }
  const card = gameState.deck.pop()!;
  gameState.currentCard = card;
  return card;
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

  return {
    deckCount: internalState.deck.length,
    currentCard: internalState.currentCard,
    discardPile: internalState.discardPile,
    turnOrder: internalState.turnOrder,
    currentPlayerIndex: internalState.currentPlayerIndex,
    myState: internalState.players[viewerPlayerId],
    otherPlayers,
  };
}
