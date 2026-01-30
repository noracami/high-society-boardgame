import { PrismaClient, PlayerRole as PrismaPlayerRole, RoomStatus as PrismaRoomStatus } from "@prisma/client";
import type { RoomState, RoomPlayer, RoomStatus, PlayerRole } from "@high-society/shared";

const prisma = new PrismaClient();

const MAX_PLAYERS = 5;
const MIN_PLAYERS = 2; // TODO: 改回 4（正式遊戲規則）

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

function toRoomPlayer(player: {
  id: string;
  discordId: string;
  name: string;
  avatar: string | null;
  isOnline: boolean;
  role: PrismaPlayerRole;
  isReady: boolean;
}): RoomPlayer {
  return {
    id: player.id,
    discordId: player.discordId,
    name: player.name,
    avatar: player.avatar,
    isOnline: player.isOnline,
    role: player.role as PlayerRole,
    isReady: player.isReady,
  };
}

export async function findOrCreateRoom(instanceId: string): Promise<string> {
  const room = await prisma.room.upsert({
    where: { instanceId },
    update: {},
    create: { instanceId },
  });
  return room.id;
}

export async function joinRoom(
  roomId: string,
  user: DiscordUser,
  nickname: string | null
): Promise<{ player: RoomPlayer; isNew: boolean }> {
  // 優先順序：伺服器別名 > 帳號顯示名稱 > 帳號名稱
  const displayName = nickname || user.global_name || user.username;

  const existing = await prisma.player.findUnique({
    where: {
      roomId_discordId: {
        roomId,
        discordId: user.id,
      },
    },
  });

  if (existing) {
    const updated = await prisma.player.update({
      where: { id: existing.id },
      data: {
        name: displayName,
        avatar: user.avatar,
        isOnline: true,
      },
    });
    return { player: toRoomPlayer(updated), isNew: false };
  }

  const created = await prisma.player.create({
    data: {
      roomId,
      discordId: user.id,
      name: displayName,
      avatar: user.avatar,
      isOnline: true,
    },
  });
  return { player: toRoomPlayer(created), isNew: true };
}

export async function leaveRoom(
  roomId: string,
  discordId: string
): Promise<string | null> {
  const player = await prisma.player.findUnique({
    where: {
      roomId_discordId: {
        roomId,
        discordId,
      },
    },
  });

  if (!player) return null;

  await prisma.player.update({
    where: { id: player.id },
    data: { isOnline: false },
  });

  return player.id;
}

export async function getRoomState(instanceId: string): Promise<RoomState | null> {
  const room = await prisma.room.findUnique({
    where: { instanceId },
    include: { players: true },
  });

  if (!room) return null;

  return {
    id: room.id,
    instanceId: room.instanceId,
    status: room.status as RoomStatus,
    players: room.players.map(toRoomPlayer),
  };
}

export async function joinLobby(
  roomId: string,
  discordId: string
): Promise<{ success: boolean; player?: RoomPlayer; error?: string }> {
  return await prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({
      where: { id: roomId },
      include: { players: true },
    });

    if (!room) {
      return { success: false, error: "房間不存在" };
    }

    if (room.status !== "lobby") {
      return { success: false, error: "遊戲已經開始" };
    }

    const playerCount = room.players.filter((p) => p.role === "player").length;
    if (playerCount >= MAX_PLAYERS) {
      return { success: false, error: "遊戲人數已滿" };
    }

    const player = await tx.player.update({
      where: {
        roomId_discordId: { roomId, discordId },
      },
      data: {
        role: "player",
        isReady: false,
      },
    });

    return { success: true, player: toRoomPlayer(player) };
  });
}

export async function leaveLobby(
  roomId: string,
  discordId: string
): Promise<{ success: boolean; player?: RoomPlayer; error?: string }> {
  return await prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return { success: false, error: "房間不存在" };
    }

    if (room.status !== "lobby") {
      return { success: false, error: "遊戲已經開始" };
    }

    const player = await tx.player.update({
      where: {
        roomId_discordId: { roomId, discordId },
      },
      data: {
        role: "observer",
        isReady: false,
      },
    });

    return { success: true, player: toRoomPlayer(player) };
  });
}

export async function setReady(
  roomId: string,
  discordId: string,
  isReady: boolean
): Promise<{ success: boolean; player?: RoomPlayer; error?: string }> {
  return await prisma.$transaction(async (tx) => {
    const existingPlayer = await tx.player.findUnique({
      where: {
        roomId_discordId: { roomId, discordId },
      },
    });

    if (!existingPlayer || existingPlayer.role !== "player") {
      return { success: false, error: "只有玩家可以準備" };
    }

    const room = await tx.room.findUnique({
      where: { id: roomId },
    });

    if (!room || room.status !== "lobby") {
      return { success: false, error: "遊戲已經開始" };
    }

    const player = await tx.player.update({
      where: { id: existingPlayer.id },
      data: { isReady },
    });

    return { success: true, player: toRoomPlayer(player) };
  });
}

export async function canStartGame(roomId: string): Promise<{ canStart: boolean; reason?: string }> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { players: true },
  });

  if (!room) {
    return { canStart: false, reason: "房間不存在" };
  }

  if (room.status !== "lobby") {
    return { canStart: false, reason: "遊戲已經開始" };
  }

  const activePlayers = room.players.filter((p) => p.role === "player");
  const playerCount = activePlayers.length;

  if (playerCount < MIN_PLAYERS) {
    return { canStart: false, reason: `需要至少 ${MIN_PLAYERS} 人` };
  }

  if (playerCount > MAX_PLAYERS) {
    return { canStart: false, reason: `最多 ${MAX_PLAYERS} 人` };
  }

  const allReady = activePlayers.every((p) => p.isReady);
  if (!allReady) {
    return { canStart: false, reason: "有玩家尚未準備" };
  }

  const allOnline = activePlayers.every((p) => p.isOnline);
  if (!allOnline) {
    return { canStart: false, reason: "有玩家離線中" };
  }

  return { canStart: true };
}

export async function startGame(
  roomId: string
): Promise<{ success: boolean; status?: RoomStatus; error?: string }> {
  return await prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({
      where: { id: roomId },
      include: { players: true },
    });

    if (!room) {
      return { success: false, error: "房間不存在" };
    }

    if (room.status !== "lobby") {
      return { success: false, error: "遊戲已經開始" };
    }

    const activePlayers = room.players.filter((p) => p.role === "player");
    const playerCount = activePlayers.length;

    if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
      return { success: false, error: `需要 ${MIN_PLAYERS}-${MAX_PLAYERS} 人才能開始` };
    }

    const allReady = activePlayers.every((p) => p.isReady);
    if (!allReady) {
      return { success: false, error: "有玩家尚未準備" };
    }

    const allOnline = activePlayers.every((p) => p.isOnline);
    if (!allOnline) {
      return { success: false, error: "有玩家離線中" };
    }

    await tx.room.update({
      where: { id: roomId },
      data: { status: "playing" },
    });

    return { success: true, status: "playing" };
  });
}

export async function verifyDiscordToken(token: string): Promise<DiscordUser | null> {
  try {
    const response = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error("Discord API error:", response.status);
      return null;
    }

    const user = await response.json();
    return {
      id: user.id,
      username: user.username,
      global_name: user.global_name,
      avatar: user.avatar,
    };
  } catch (error) {
    console.error("Discord token verification error:", error);
    return null;
  }
}
