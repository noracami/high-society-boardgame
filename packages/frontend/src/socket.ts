import { io, Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  RoomState,
  RoomPlayer,
  RoomStatus,
  GameState,
  AuctionCard,
  AuctionResult,
  CardValue,
} from "@high-society/shared";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export interface SocketCallbacks {
  onRoomJoined: (state: RoomState) => void;
  onPlayerJoined: (player: RoomPlayer) => void;
  onPlayerLeft: (playerId: string) => void;
  onPlayerUpdated: (player: RoomPlayer) => void;
  onRoomStatusChanged: (status: RoomStatus) => void;
  onGameStarted: (gameState: GameState) => void;
  onCardRevealed: (card: AuctionCard) => void;
  onGameStateUpdated: (gameState: GameState) => void;
  onAuctionEnded: (result: AuctionResult) => void;
  onError: (message: string) => void;
}

export function connectSocket(
  token: string,
  instanceId: string,
  nickname: string | null,
  callbacks: SocketCallbacks
): TypedSocket {
  if (socket?.connected) {
    return socket;
  }

  socket = io({
    auth: { token, instanceId, nickname },
  });

  socket.on("room:joined", callbacks.onRoomJoined);
  socket.on("player:joined", callbacks.onPlayerJoined);
  socket.on("player:left", callbacks.onPlayerLeft);
  socket.on("player:updated", callbacks.onPlayerUpdated);
  socket.on("room:statusChanged", callbacks.onRoomStatusChanged);
  socket.on("game:started", callbacks.onGameStarted);
  socket.on("game:cardRevealed", callbacks.onCardRevealed);
  socket.on("game:stateUpdated", callbacks.onGameStateUpdated);
  socket.on("game:auctionEnded", callbacks.onAuctionEnded);
  socket.on("error", callbacks.onError);

  socket.on("connect_error", (err) => {
    console.error("Socket connection error:", err.message);
    callbacks.onError(err.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function emitLobbyJoin(): void {
  socket?.emit("lobby:join");
}

export function emitLobbyLeave(): void {
  socket?.emit("lobby:leave");
}

export function emitLobbyReady(): void {
  socket?.emit("lobby:ready");
}

export function emitLobbyUnready(): void {
  socket?.emit("lobby:unready");
}

export function emitLobbyStart(): void {
  socket?.emit("lobby:start");
}

export function emitBid(cards: CardValue[]): void {
  socket?.emit("game:bid", cards);
}

export function emitPass(): void {
  socket?.emit("game:pass");
}
