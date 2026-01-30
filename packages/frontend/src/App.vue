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
import type { RoomPlayer, RoomStatus, GameState, AuctionCard } from "@high-society/shared";

const user = ref<DiscordUser | null>(null);
const error = ref<string | null>(null);
const loading = ref(true);
const players = ref<RoomPlayer[]>([]);
const roomStatus = ref<RoomStatus>("lobby");
const gameState = ref<GameState | null>(null);

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

// 遊戲相關計算屬性
const currentTurnPlayer = computed(() => {
  if (!gameState.value) return null;
  const playerId = gameState.value.turnOrder[gameState.value.currentPlayerIndex];
  return players.value.find((p) => p.id === playerId);
});

function getCardDisplayName(card: AuctionCard): string {
  switch (card.type) {
    case "luxury":
      return `${card.value}`;
    case "zero":
      return "0";
    case "penalty":
      return "-5";
    case "multiplier":
      return card.value === 2 ? "x2" : "x½";
    default:
      return "?";
  }
}

function getCardTypeLabel(card: AuctionCard): string {
  switch (card.type) {
    case "luxury":
      return "奢侈品";
    case "zero":
      return "零卡";
    case "penalty":
      return "扣分卡";
    case "multiplier":
      return "倍率卡";
    default:
      return "";
  }
}

function getAuctionTypeLabel(card: AuctionCard): string {
  return card.auctionType === "forward" ? "正向" : "反向";
}

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
        gameState.value = state.gameState;
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
      onGameStarted: (state) => {
        gameState.value = state;
      },
      onCardRevealed: (card) => {
        if (gameState.value) {
          gameState.value.currentCard = card;
        }
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
      <div v-if="roomStatus === 'playing' && gameState" class="game-screen">
        <!-- 遊戲資訊列 -->
        <div class="game-info-bar">
          <span>牌組剩餘: {{ gameState.deckCount }}</span>
          <span v-if="currentTurnPlayer">輪到: {{ currentTurnPlayer.name }}</span>
        </div>

        <!-- 當前拍賣牌 -->
        <div class="auction-area">
          <h2>當前拍賣牌</h2>
          <div v-if="gameState.currentCard" class="auction-card" :class="gameState.currentCard.type">
            <div class="card-value">{{ getCardDisplayName(gameState.currentCard) }}</div>
            <div class="card-type">{{ getCardTypeLabel(gameState.currentCard) }}</div>
            <div class="card-auction-type" :class="gameState.currentCard.auctionType">
              {{ getAuctionTypeLabel(gameState.currentCard) }}拍賣
            </div>
          </div>
          <p v-else class="no-card">沒有拍賣牌</p>
        </div>

        <!-- 玩家資訊區 -->
        <div class="players-info">
          <h3>玩家狀態</h3>
          <div class="player-cards">
            <div
              v-for="player in activePlayers"
              :key="player.id"
              class="player-info-card"
              :class="{ 'is-current': gameState.turnOrder[gameState.currentPlayerIndex] === player.id }"
            >
              <div class="player-info-name">
                {{ player.name }}
                <span v-if="player.discordId === user?.id">(你)</span>
              </div>
              <div class="player-info-stats">
                <template v-if="player.discordId === user?.id">
                  <span>手牌: {{ gameState.myState.hand.length }}張</span>
                  |
                  <span>已花費: {{ gameState.myState.spentTotal }}</span>
                </template>
                <template v-else-if="gameState.otherPlayers[player.id]">
                  <span>手牌: {{ gameState.otherPlayers[player.id]!.handCount }}張</span>
                  |
                  <span>已花費: {{ gameState.otherPlayers[player.id]!.spentTotal }}</span>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- 我的手牌 -->
        <div class="my-hand">
          <h3>我的手牌</h3>
          <div class="hand-cards">
            <div
              v-for="card in gameState.myState.hand"
              :key="card"
              class="hand-card"
            >
              {{ card }}
            </div>
          </div>
        </div>
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
  padding: 1.5rem;
  background-color: #2a2a2a;
  border-radius: 8px;
}

.game-info-bar {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background-color: #1a1a1a;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  font-size: 0.9em;
  color: #adb5bd;
}

.auction-area {
  margin-bottom: 1.5rem;
}

.auction-area h2 {
  font-size: 1.1rem;
  color: #adb5bd;
  margin-bottom: 1rem;
}

.auction-card {
  display: inline-block;
  width: 120px;
  padding: 1.5rem 1rem;
  border-radius: 12px;
  background: linear-gradient(145deg, #3a3a3a, #2a2a2a);
  border: 3px solid #4a4a4a;
}

.auction-card.luxury {
  border-color: #fab005;
  background: linear-gradient(145deg, #4a3a0a, #2a2a2a);
}

.auction-card.zero {
  border-color: #868e96;
  background: linear-gradient(145deg, #3a3a3a, #2a2a2a);
}

.auction-card.penalty {
  border-color: #ff6b6b;
  background: linear-gradient(145deg, #4a2a2a, #2a2a2a);
}

.auction-card.multiplier {
  border-color: #69db7c;
  background: linear-gradient(145deg, #2a4a2a, #2a2a2a);
}

.card-value {
  font-size: 2rem;
  font-weight: bold;
  color: #fff;
}

.card-type {
  font-size: 0.85em;
  color: #adb5bd;
  margin-top: 0.5rem;
}

.card-auction-type {
  font-size: 0.75em;
  margin-top: 0.5rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  display: inline-block;
}

.card-auction-type.forward {
  background-color: #228be6;
  color: #fff;
}

.card-auction-type.reverse {
  background-color: #f03e3e;
  color: #fff;
}

.no-card {
  color: #868e96;
  font-style: italic;
}

.players-info {
  margin-bottom: 1.5rem;
  text-align: left;
}

.players-info h3 {
  font-size: 1rem;
  color: #adb5bd;
  margin-bottom: 0.75rem;
}

.player-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.player-info-card {
  flex: 1;
  min-width: 140px;
  padding: 0.75rem;
  background-color: #1a1a1a;
  border-radius: 8px;
  border: 2px solid transparent;
}

.player-info-card.is-current {
  border-color: #fab005;
}

.player-info-name {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.player-info-stats {
  font-size: 0.8em;
  color: #adb5bd;
}

.my-hand {
  border-top: 1px solid #3a3a3a;
  padding-top: 1rem;
}

.my-hand h3 {
  font-size: 1rem;
  color: #adb5bd;
  margin-bottom: 0.75rem;
}

.hand-cards {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.hand-card {
  width: 50px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #364fc7, #1e3a8a);
  border-radius: 8px;
  font-size: 1.2rem;
  font-weight: bold;
  color: #fff;
  cursor: pointer;
  transition: transform 0.2s;
}

.hand-card:hover {
  transform: translateY(-5px);
}
</style>
