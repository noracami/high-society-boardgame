import { PrismaClient } from "@prisma/client";
import type { RoomState, RoomPlayer } from "@high-society/shared";

const prisma = new PrismaClient();

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
}): RoomPlayer {
  return {
    id: player.id,
    discordId: player.discordId,
    name: player.name,
    avatar: player.avatar,
    isOnline: player.isOnline,
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
  user: DiscordUser
): Promise<{ player: RoomPlayer; isNew: boolean }> {
  const displayName = user.global_name || user.username;

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
    players: room.players.map(toRoomPlayer),
  };
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
