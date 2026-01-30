// packages/shared/index.ts
export type CardValue = 1 | 2 | 3 | 4 | 6 | 8 | 10 | 12 | 15 | 20 | 25;

export interface Player {
  id: string;
  name: string;
  hand: CardValue[];
  spent: number;
}

// Socket.io 型別
export interface RoomPlayer {
  id: string;
  discordId: string;
  name: string;
  avatar: string | null;
  isOnline: boolean;
}

export interface RoomState {
  id: string;
  instanceId: string;
  players: RoomPlayer[];
}

export interface ServerToClientEvents {
  "room:joined": (state: RoomState) => void;
  "player:joined": (player: RoomPlayer) => void;
  "player:left": (playerId: string) => void;
  error: (message: string) => void;
}

export interface ClientToServerEvents {
  // 目前連線時透過 auth 傳遞資訊，暫無額外 client 事件
}

export interface SocketAuth {
  token: string;
  instanceId: string;
  nickname: string | null;
}
