import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  SocketAuth,
} from "@high-society/shared";
import {
  verifyDiscordToken,
  findOrCreateRoom,
  joinRoom,
  leaveRoom,
  getRoomState,
  joinLobby,
  leaveLobby,
  setReady,
  startGame,
} from "./services/roomService";

interface SocketData {
  discordId: string;
  instanceId: string;
  roomId: string;
}

type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export function initSocketServer(httpServer: HttpServer): TypedServer {
  const io: TypedServer = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.use(async (socket: TypedSocket, next) => {
    const auth = socket.handshake.auth as SocketAuth;

    if (!auth.token || !auth.instanceId) {
      return next(new Error("Missing authentication"));
    }

    const user = await verifyDiscordToken(auth.token);
    if (!user) {
      return next(new Error("Invalid token"));
    }

    const roomId = await findOrCreateRoom(auth.instanceId);

    socket.data.discordId = user.id;
    socket.data.instanceId = auth.instanceId;
    socket.data.roomId = roomId;

    const { player } = await joinRoom(roomId, user, auth.nickname);

    socket.join(auth.instanceId);

    // 廣播給房間內其他人：有玩家加入/上線
    socket.to(auth.instanceId).emit("player:joined", player);

    next();
  });

  io.on("connection", async (socket: TypedSocket) => {
    const { instanceId, discordId, roomId } = socket.data;

    console.log(`Player connected: ${discordId} to room ${instanceId}`);

    const roomState = await getRoomState(instanceId);
    if (roomState) {
      socket.emit("room:joined", roomState);
    }

    socket.on("lobby:join", async () => {
      const result = await joinLobby(roomId, discordId);
      if (result.success && result.player) {
        io.to(instanceId).emit("player:updated", result.player);
      } else {
        socket.emit("error", result.error || "加入失敗");
      }
    });

    socket.on("lobby:leave", async () => {
      const result = await leaveLobby(roomId, discordId);
      if (result.success && result.player) {
        io.to(instanceId).emit("player:updated", result.player);
      } else {
        socket.emit("error", result.error || "離開失敗");
      }
    });

    socket.on("lobby:ready", async () => {
      const result = await setReady(roomId, discordId, true);
      if (result.success && result.player) {
        io.to(instanceId).emit("player:updated", result.player);
      } else {
        socket.emit("error", result.error || "準備失敗");
      }
    });

    socket.on("lobby:unready", async () => {
      const result = await setReady(roomId, discordId, false);
      if (result.success && result.player) {
        io.to(instanceId).emit("player:updated", result.player);
      } else {
        socket.emit("error", result.error || "取消準備失敗");
      }
    });

    socket.on("lobby:start", async () => {
      const result = await startGame(roomId);
      if (result.success && result.status) {
        io.to(instanceId).emit("room:statusChanged", result.status);
      } else {
        socket.emit("error", result.error || "開始遊戲失敗");
      }
    });

    socket.on("disconnect", async () => {
      console.log(`Player disconnected: ${discordId} from room ${instanceId}`);

      const playerId = await leaveRoom(roomId, discordId);
      if (playerId) {
        socket.to(instanceId).emit("player:left", playerId);
      }
    });
  });

  return io;
}
