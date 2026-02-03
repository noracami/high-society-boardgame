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
import { toClientGameState, toObserverGameState, processBid, processPass, calculateFinalScores } from "./services/gameService";
import type { InternalGameState } from "./services/gameService";
import { getInternalGameState, saveGameState, getRoom } from "./services/roomService";

interface SocketData {
  discordId: string;
  instanceId: string;
  roomId: string;
  playerId: string;
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

// Helper function: 廣播遊戲狀態給房間內所有人（玩家收到 GameState，旁觀者收到 ObserverGameState）
async function broadcastGameState(
  io: TypedServer,
  instanceId: string,
  gameState: InternalGameState,
  eventName: "game:started" | "game:stateUpdated"
): Promise<void> {
  const socketsInRoom = await io.in(instanceId).fetchSockets();
  for (const s of socketsInRoom) {
    const viewerPlayerId = s.data.playerId;
    if (viewerPlayerId && gameState.players[viewerPlayerId]) {
      // 玩家：發送專屬視角的遊戲狀態
      const clientGameState = toClientGameState(gameState, viewerPlayerId);
      s.emit(eventName, clientGameState);
    } else if (viewerPlayerId) {
      // 旁觀者：發送公開的遊戲狀態
      const observerGameState = toObserverGameState(gameState);
      s.emit(eventName, observerGameState);
    }
  }
}

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
    socket.data.playerId = player.id;

    socket.join(auth.instanceId);

    // 廣播給房間內其他人：有玩家加入/上線
    socket.to(auth.instanceId).emit("player:joined", player);

    next();
  });

  io.on("connection", async (socket: TypedSocket) => {
    const { instanceId, discordId, roomId, playerId } = socket.data;

    console.log(`Player connected: ${discordId} to room ${instanceId}`);

    const roomState = await getRoomState(instanceId, playerId);
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
      if (result.success && result.status && result.gameState) {
        io.to(instanceId).emit("room:statusChanged", result.status);

        // 為每位玩家發送專屬視角的遊戲狀態，旁觀者發送公開狀態
        await broadcastGameState(io, instanceId, result.gameState, "game:started");
      } else {
        socket.emit("error", result.error || "開始遊戲失敗");
      }
    });

    socket.on("game:bid", async (cards) => {
      const gameState = await getInternalGameState(roomId);
      if (!gameState) {
        socket.emit("error", "遊戲狀態不存在");
        return;
      }

      const result = processBid(gameState, playerId, cards);
      if (!result.success) {
        socket.emit("error", result.error || "出價失敗");
        return;
      }

      await saveGameState(roomId, gameState);

      // 為每位玩家發送專屬視角的遊戲狀態，旁觀者發送公開狀態
      await broadcastGameState(io, instanceId, gameState, "game:stateUpdated");
    });

    socket.on("game:pass", async () => {
      const gameState = await getInternalGameState(roomId);
      if (!gameState) {
        socket.emit("error", "遊戲狀態不存在");
        return;
      }

      const result = processPass(gameState, playerId);
      if (!result.success) {
        socket.emit("error", result.error || "Pass 失敗");
        return;
      }

      await saveGameState(roomId, gameState);

      // 廣播拍賣結算結果
      if (result.auctionEnded && result.auctionResult) {
        io.to(instanceId).emit("game:auctionEnded", result.auctionResult);
      }

      // 為每位玩家發送專屬視角的遊戲狀態，旁觀者發送公開狀態
      await broadcastGameState(io, instanceId, gameState, "game:stateUpdated");

      // 檢查遊戲是否結束，廣播最終結果
      if (result.gameEnded) {
        const room = await getRoom(roomId);
        if (room) {
          // 建立 playerId 到 playerName 的對應
          const playerNames: Record<string, string> = {};
          for (const player of room.players) {
            playerNames[player.id] = player.name;
          }
          const gameEndResult = calculateFinalScores(gameState, playerNames);
          io.to(instanceId).emit("game:ended", gameEndResult);
        }
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
