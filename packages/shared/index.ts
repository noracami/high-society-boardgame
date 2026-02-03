// packages/shared/index.ts
export type CardValue = 1 | 2 | 3 | 4 | 6 | 8 | 10 | 12 | 15 | 20 | 25;

export interface Player {
  id: string;
  name: string;
  hand: CardValue[];
  spent: number;
}

// 拍賣牌型別
export type AuctionCardType = "luxury" | "zero" | "penalty" | "multiplier";
export type AuctionType = "forward" | "reverse";

export interface AuctionCard {
  id: string;
  type: AuctionCardType;
  value: number; // 1-10 for luxury, 0 for zero, -5 for penalty, 2 or 0.5 for multiplier
  auctionType: AuctionType;
}

// 玩家出價資訊
export interface PlayerBid {
  playerId: string;
  cards: CardValue[];
  total: number;
}

// 其他玩家出價的公開資訊（隱藏牌面細節）
export interface PublicPlayerBid {
  playerId: string;
  cardCount: number;
  total: number;
}

// 拍賣結算結果
export interface AuctionResult {
  winnerId: string;
  card: AuctionCard;
  spentCards: CardValue[];
  spentTotal: number;
}

// 最終計分結果
export interface FinalScore {
  playerId: string;
  playerName: string;
  luxuryTotal: number; // 奢侈品總值
  multiplier: number; // 倍率（累乘）
  penalty: number; // 扣分
  finalScore: number; // 最終分數
  remainingMoney: number; // 剩餘現金
  isEliminated: boolean; // 是否出局
  wonCards: AuctionCard[]; // 獲得的牌
}

// 遊戲結束結果
export interface GameEndResult {
  rankings: FinalScore[]; // 按分數排序（已排除出局者）
  eliminated: FinalScore[]; // 出局玩家
}

// 玩家遊戲狀態
export interface PlayerGameState {
  hand: CardValue[];
  wonCards: AuctionCard[];
  spentTotal: number;
}

// 其他玩家的公開資訊（隱藏手牌內容）
export interface PublicPlayerGameState {
  handCount: number;
  wonCards: AuctionCard[];
  spentTotal: number;
}

// 客戶端拍賣輪狀態
export interface ClientAuctionRoundState {
  phase: "bidding" | "settling";
  activePlayers: string[]; // 尚未 Pass 的玩家 ID
  myBid: PlayerBid | null; // 自己的完整出價資訊
  otherBids: Record<string, PublicPlayerBid>; // 其他玩家的公開出價資訊
  currentHighest: number; // 當前最高出價
  currentBidderId: string; // 當前輪到的玩家 ID
  isMyTurn: boolean; // 是否輪到自己
}

// 旁觀者的拍賣狀態（沒有 myBid、isMyTurn）
export interface ObserverAuctionRoundState {
  phase: "bidding" | "settling";
  activePlayers: string[];
  bids: Record<string, PublicPlayerBid>;
  currentHighest: number;
  currentBidderId: string;
}

// 遊戲狀態
export interface GameState {
  deckCount: number; // 剩餘牌數（不揭露內容）
  currentCard: AuctionCard | null;
  discardPile: AuctionCard[];
  turnOrder: string[];
  currentPlayerIndex: number;
  myState: PlayerGameState; // 自己的完整狀態
  otherPlayers: Record<string, PublicPlayerGameState>; // 其他玩家的公開狀態
  auctionRound: ClientAuctionRoundState | null; // 拍賣輪狀態
}

// 旁觀者的遊戲狀態（沒有 myState，所有玩家都是 PublicPlayerGameState）
export interface ObserverGameState {
  deckCount: number;
  currentCard: AuctionCard | null;
  discardPile: AuctionCard[];
  turnOrder: string[];
  currentPlayerIndex: number;
  players: Record<string, PublicPlayerGameState>; // 所有玩家的公開狀態
  auctionRound: ObserverAuctionRoundState | null;
}

// 常數
export const INITIAL_HAND: CardValue[] = [1, 2, 3, 4, 6, 8, 10, 12, 15, 20, 25];

export const DECK_CARDS: Omit<AuctionCard, "id">[] = [
  // 奢侈品 1-10（正向拍賣）
  { type: "luxury", value: 1, auctionType: "forward" },
  { type: "luxury", value: 2, auctionType: "forward" },
  { type: "luxury", value: 3, auctionType: "forward" },
  { type: "luxury", value: 4, auctionType: "forward" },
  { type: "luxury", value: 5, auctionType: "forward" },
  { type: "luxury", value: 6, auctionType: "forward" },
  { type: "luxury", value: 7, auctionType: "forward" },
  { type: "luxury", value: 8, auctionType: "forward" },
  { type: "luxury", value: 9, auctionType: "forward" },
  { type: "luxury", value: 10, auctionType: "forward" },
  // 零卡（反向拍賣）
  { type: "zero", value: 0, auctionType: "reverse" },
  // 扣分卡（反向拍賣）
  { type: "penalty", value: -5, auctionType: "reverse" },
  // 倍率卡 x2（正向拍賣）
  { type: "multiplier", value: 2, auctionType: "forward" },
  { type: "multiplier", value: 2, auctionType: "forward" },
  { type: "multiplier", value: 2, auctionType: "forward" },
  // 倍率卡 x0.5（反向拍賣）
  { type: "multiplier", value: 0.5, auctionType: "reverse" },
];

// Lobby 型別
export type PlayerRole = "observer" | "player";
export type RoomStatus = "lobby" | "playing";

// Socket.io 型別
export interface RoomPlayer {
  id: string;
  discordId: string;
  name: string;
  avatar: string | null;
  isOnline: boolean;
  role: PlayerRole;
  isReady: boolean;
}

export interface RoomState {
  id: string;
  instanceId: string;
  status: RoomStatus;
  players: RoomPlayer[];
  gameState: GameState | ObserverGameState | null;
}

export interface ServerToClientEvents {
  "room:joined": (state: RoomState) => void;
  "player:joined": (player: RoomPlayer) => void;
  "player:left": (playerId: string) => void;
  "player:updated": (player: RoomPlayer) => void;
  "room:statusChanged": (status: RoomStatus) => void;
  "game:started": (gameState: GameState | ObserverGameState) => void;
  "game:cardRevealed": (card: AuctionCard) => void;
  "game:stateUpdated": (gameState: GameState | ObserverGameState) => void;
  "game:auctionEnded": (result: AuctionResult) => void;
  "game:ended": (result: GameEndResult) => void;
  error: (message: string) => void;
}

export interface ClientToServerEvents {
  "lobby:join": () => void;
  "lobby:leave": () => void;
  "lobby:ready": () => void;
  "lobby:unready": () => void;
  "lobby:start": () => void;
  "game:bid": (cards: CardValue[]) => void;
  "game:pass": () => void;
}

export interface SocketAuth {
  token: string;
  instanceId: string;
  nickname: string | null;
}
