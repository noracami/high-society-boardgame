// packages/shared/index.ts
export type CardValue = 1 | 2 | 3 | 4 | 6 | 8 | 10 | 12 | 15 | 20 | 25;

export interface Player {
  id: string;
  name: string;
  hand: CardValue[];
  spent: number;
}

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
}

export interface ServerToClientEvents {
  "room:joined": (state: RoomState) => void;
  "player:joined": (player: RoomPlayer) => void;
  "player:left": (playerId: string) => void;
  "player:updated": (player: RoomPlayer) => void;
  "room:statusChanged": (status: RoomStatus) => void;
  error: (message: string) => void;
}

export interface ClientToServerEvents {
  "lobby:join": () => void;
  "lobby:leave": () => void;
  "lobby:ready": () => void;
  "lobby:unready": () => void;
  "lobby:start": () => void;
}

export interface SocketAuth {
  token: string;
  instanceId: string;
  nickname: string | null;
}
