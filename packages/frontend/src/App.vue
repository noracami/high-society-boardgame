<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { setupDiscordSdk, getInstanceId, type DiscordUser } from "./discord";
import {
  connectSocket,
  disconnectSocket,
  emitLobbyJoin,
  emitLobbyLeave,
  emitLobbyReady,
  emitLobbyUnready,
  emitLobbyStart,
} from "./socket";
import type { RoomPlayer, RoomStatus } from "@high-society/shared";

const user = ref<DiscordUser | null>(null);
const error = ref<string | null>(null);
const loading = ref(true);
const players = ref<RoomPlayer[]>([]);
const roomStatus = ref<RoomStatus>("lobby");

const currentPlayer = computed(() =>
  players.value.find((p) => p.discordId === user.value?.id)
);

const isObserver = computed(() => currentPlayer.value?.role === "observer");
const isPlayer = computed(() => currentPlayer.value?.role === "player");
const isReady = computed(() => currentPlayer.value?.isReady ?? false);

const activePlayers = computed(() =>
  players.value.filter((p) => p.role === "player")
);

const playerCount = computed(() => activePlayers.value.length);

const isRoomFull = computed(() => playerCount.value >= 5);

const canStartGame = computed(() => {
  if (roomStatus.value !== "lobby") return false;
  if (playerCount.value < 2 || playerCount.value > 5) return false; // TODO: 改回 4（正式遊戲規則）
  if (!activePlayers.value.every((p) => p.isReady)) return false;
  if (!activePlayers.value.every((p) => p.isOnline)) return false;
  return true;
});

function handleJoinGame() {
  emitLobbyJoin();
}

function handleLeaveGame() {
  emitLobbyLeave();
}

function handleReady() {
  emitLobbyReady();
}

function handleUnready() {
  emitLobbyUnready();
}

function handleStartGame() {
  emitLobbyStart();
}

onMounted(async () => {
  try {
    const result = await setupDiscordSdk();
    user.value = result.user;

    const nickname = result.guildMember?.nick ?? null;
    connectSocket(result.accessToken, getInstanceId(), nickname, {
      onRoomJoined: (state) => {
        players.value = state.players;
        roomStatus.value = state.status;
      },
      onPlayerJoined: (player) => {
        const index = players.value.findIndex((p) => p.id === player.id);
        if (index >= 0) {
          players.value[index] = player;
        } else {
          players.value.push(player);
        }
      },
      onPlayerLeft: (playerId) => {
        const player = players.value.find((p) => p.id === playerId);
        if (player) {
          player.isOnline = false;
        }
      },
      onPlayerUpdated: (player) => {
        const index = players.value.findIndex((p) => p.id === player.id);
        if (index >= 0) {
          players.value[index] = player;
        }
      },
      onRoomStatusChanged: (status) => {
        roomStatus.value = status;
      },
      onError: (message) => {
        error.value = message;
      },
    });
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Unknown error";
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  disconnectSocket();
});
</script>

<template>
  <div class="container">
    <h1>上流社會</h1>

    <div v-if="loading" class="status">
      正在連接 Discord...
    </div>

    <div v-else-if="error" class="status error">
      認證失敗: {{ error }}
    </div>

    <template v-else-if="user">
      <!-- 遊戲進行中畫面 -->
      <div v-if="roomStatus === 'playing'" class="game-screen">
        <h2>遊戲開始！</h2>
        <p>遊戲功能開發中...</p>
      </div>

      <!-- Lobby 畫面 -->
      <div v-else class="user-info">
        <p class="status success">已認證</p>
        <p><strong>User ID:</strong> {{ user.id }}</p>
        <p><strong>Username:</strong> {{ user.global_name || user.username }}</p>

        <div class="players-section">
          <h2>房間玩家 ({{ playerCount }}/5)</h2>
          <ul class="player-list">
            <li
              v-for="player in players"
              :key="player.id"
              :class="{ offline: !player.isOnline }"
            >
              <span class="status-dot" :class="{ online: player.isOnline }"></span>
              {{ player.name }}
              <span v-if="player.discordId === user.id" class="you-badge">(你)</span>
              <span v-if="player.role === 'player'" class="role-badge player">玩家</span>
              <span v-else class="role-badge observer">觀眾</span>
              <span v-if="player.role === 'player' && player.isReady" class="ready-badge">已準備</span>
            </li>
          </ul>
          <p v-if="players.length === 0" class="no-players">等待其他玩家加入...</p>
        </div>

        <!-- 操作按鈕 -->
        <div class="action-buttons">
          <!-- 觀眾：顯示加入遊戲按鈕 -->
          <template v-if="isObserver">
            <button
              class="btn btn-primary"
              :disabled="isRoomFull"
              @click="handleJoinGame"
            >
              {{ isRoomFull ? '遊戲人數已滿' : '加入遊戲' }}
            </button>
          </template>

          <!-- 玩家但未準備：顯示準備和離開按鈕 -->
          <template v-else-if="isPlayer && !isReady">
            <button class="btn btn-primary" @click="handleReady">準備</button>
            <button class="btn btn-secondary" @click="handleLeaveGame">離開遊戲</button>
          </template>

          <!-- 玩家且已準備：顯示取消準備和開始遊戲按鈕 -->
          <template v-else-if="isPlayer && isReady">
            <button class="btn btn-secondary" @click="handleUnready">取消準備</button>
            <button
              class="btn btn-success"
              :disabled="!canStartGame"
              @click="handleStartGame"
            >
              開始遊戲
            </button>
          </template>
        </div>

        <!-- 開始遊戲條件提示 -->
        <div v-if="isPlayer && isReady && !canStartGame" class="start-hint">
          <p v-if="playerCount < 2">需要至少 2 位玩家</p>
          <p v-else-if="!activePlayers.every((p) => p.isReady)">等待所有玩家準備</p>
          <p v-else-if="!activePlayers.every((p) => p.isOnline)">有玩家離線中</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

h1 {
  margin-bottom: 2rem;
}

.status {
  padding: 1rem;
  border-radius: 8px;
  background-color: #2a2a2a;
}

.status.error {
  color: #ff6b6b;
  background-color: #2a1a1a;
}

.status.success {
  color: #69db7c;
  background-color: #1a2a1a;
}

.user-info {
  text-align: left;
  padding: 1rem;
  background-color: #2a2a2a;
  border-radius: 8px;
}

.user-info p {
  margin: 0.5rem 0;
}

.players-section {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #3a3a3a;
}

.players-section h2 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
}

.player-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.player-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.player-list li.offline {
  opacity: 0.5;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #666;
}

.status-dot.online {
  background-color: #69db7c;
}

.you-badge {
  font-size: 0.8em;
  color: #888;
}

.no-players {
  color: #888;
  font-style: italic;
}

.role-badge {
  font-size: 0.75em;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  margin-left: 0.25rem;
}

.role-badge.player {
  background-color: #364fc7;
  color: #fff;
}

.role-badge.observer {
  background-color: #495057;
  color: #adb5bd;
}

.ready-badge {
  font-size: 0.75em;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  background-color: #2f9e44;
  color: #fff;
  margin-left: 0.25rem;
}

.action-buttons {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #3a3a3a;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #228be6;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background-color: #1c7ed6;
}

.btn-secondary {
  background-color: #495057;
  color: #fff;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #343a40;
}

.btn-success {
  background-color: #2f9e44;
  color: #fff;
}

.btn-success:hover:not(:disabled) {
  background-color: #27862a;
}

.start-hint {
  margin-top: 0.75rem;
  color: #fab005;
  font-size: 0.9em;
}

.start-hint p {
  margin: 0.25rem 0;
}

.game-screen {
  text-align: center;
  padding: 2rem;
  background-color: #2a2a2a;
  border-radius: 8px;
}

.game-screen h2 {
  color: #69db7c;
  margin-bottom: 1rem;
}
</style>
