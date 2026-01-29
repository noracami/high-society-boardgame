import { io, Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  RoomState,
  RoomPlayer,
} from "@high-society/shared";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export interface SocketCallbacks {
  onRoomJoined: (state: RoomState) => void;
  onPlayerJoined: (player: RoomPlayer) => void;
  onPlayerLeft: (playerId: string) => void;
  onError: (message: string) => void;
}

export function connectSocket(
  token: string,
  instanceId: string,
  callbacks: SocketCallbacks
): TypedSocket {
  if (socket?.connected) {
    return socket;
  }

  socket = io({
    auth: { token, instanceId },
  });

  socket.on("room:joined", callbacks.onRoomJoined);
  socket.on("player:joined", callbacks.onPlayerJoined);
  socket.on("player:left", callbacks.onPlayerLeft);
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
