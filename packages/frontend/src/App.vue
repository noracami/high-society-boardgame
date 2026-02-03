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
  emitBid,
  emitPass,
} from "./socket";
import type { RoomPlayer, RoomStatus, GameState, ObserverGameState, AuctionCard, AuctionResult, CardValue, GameEndResult } from "@high-society/shared";

const user = ref<DiscordUser | null>(null);
const error = ref<string | null>(null);
const loading = ref(true);
const players = ref<RoomPlayer[]>([]);
const roomStatus = ref<RoomStatus>("lobby");
const gameState = ref<GameState | ObserverGameState | null>(null);
const selectedCards = ref<CardValue[]>([]);
const auctionResult = ref<AuctionResult | null>(null);
const gameEndResult = ref<GameEndResult | null>(null);

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

// 判斷是否以觀戰者視角觀看遊戲（gameState 沒有 myState 屬性）
const isViewingAsObserver = computed(() => {
  if (!gameState.value) return false;
  return !("myState" in gameState.value);
});

const canStartGame = computed(() => {
  if (roomStatus.value !== "lobby") return false;
  if (playerCount.value < 2 || playerCount.value > 5) return false; // TODO: 改回 4（正式遊戲規則）
  if (!activePlayers.value.every((p) => p.isReady)) return false;
  if (!activePlayers.value.every((p) => p.isOnline)) return false;
  return true;
});

// 拍賣相關計算屬性
const isInAuction = computed(() => {
  return gameState.value?.auctionRound !== null && gameState.value?.auctionRound !== undefined;
});

const isMyTurn = computed(() => {
  if (isViewingAsObserver.value) return false;
  const state = gameState.value as GameState | null;
  return state?.auctionRound?.isMyTurn ?? false;
});

const currentHighest = computed(() => {
  return gameState.value?.auctionRound?.currentHighest ?? 0;
});

const myCurrentBidTotal = computed(() => {
  if (isViewingAsObserver.value) return 0;
  const state = gameState.value as GameState | null;
  return state?.auctionRound?.myBid?.total ?? 0;
});

const selectedTotal = computed(() => {
  return selectedCards.value.reduce((sum, card) => sum + card, 0);
});

const newBidTotal = computed(() => {
  return myCurrentBidTotal.value + selectedTotal.value;
});

const canBid = computed(() => {
  if (!isMyTurn.value) return false;
  if (selectedCards.value.length === 0) return false;
  return newBidTotal.value > currentHighest.value;
});

const canPass = computed(() => {
  return isMyTurn.value;
});

const currentBidder = computed(() => {
  if (!gameState.value?.auctionRound) return null;
  const bidderId = gameState.value.auctionRound.currentBidderId;
  return players.value.find((p) => p.id === bidderId);
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

function toggleCardSelection(card: CardValue) {
  const index = selectedCards.value.indexOf(card);
  if (index >= 0) {
    selectedCards.value.splice(index, 1);
  } else {
    selectedCards.value.push(card);
  }
}

function isCardSelected(card: CardValue): boolean {
  return selectedCards.value.includes(card);
}

function handleBid() {
  if (!canBid.value) return;
  emitBid(selectedCards.value);
  selectedCards.value = [];
}

function handlePass() {
  if (!canPass.value) return;
  emitPass();
  selectedCards.value = [];
}

function clearAuctionResult() {
  auctionResult.value = null;
}

function getPlayerName(playerId: string): string {
  const player = players.value.find((p) => p.id === playerId);
  return player?.name ?? "未知玩家";
}

function getWonCardsForPlayer(playerId: string): AuctionCard[] {
  if (!gameState.value) return [];
  if (isViewingAsObserver.value) {
    // 觀戰者視角：所有玩家都在 players 中
    const observerState = gameState.value as ObserverGameState;
    return observerState.players[playerId]?.wonCards ?? [];
  }
  // 玩家視角
  const playerState = gameState.value as GameState;
  if (playerId === currentPlayer.value?.id) {
    return playerState.myState.wonCards;
  }
  return playerState.otherPlayers[playerId]?.wonCards ?? [];
}

function getWonCardsSummary(cards: AuctionCard[]): string {
  if (cards.length === 0) return "";
  return cards.map(c => getCardDisplayName(c)).join(", ");
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
      onGameStateUpdated: (state) => {
        gameState.value = state;
      },
      onAuctionEnded: (result) => {
        auctionResult.value = result;
        // 3 秒後自動清除結算通知
        setTimeout(() => {
          auctionResult.value = null;
        }, 3000);
      },
      onGameEnded: (result) => {
        gameEndResult.value = result;
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
        <!-- 觀戰模式提示 -->
        <div v-if="isViewingAsObserver" class="observer-banner">
          👁️ 觀戰模式 - 你正在觀看遊戲進行
        </div>
        <!-- 遊戲結束畫面 -->
        <div v-if="gameEndResult" class="game-end-overlay">
          <div class="game-end-modal">
            <h2>遊戲結束</h2>

            <!-- 排名 -->
            <div class="rankings-section">
              <h3>最終排名</h3>
              <div
                v-for="(score, index) in gameEndResult.rankings"
                :key="score.playerId"
                class="ranking-item"
                :class="{ winner: index === 0 }"
              >
                <div class="rank-position">{{ index + 1 }}</div>
                <div class="rank-info">
                  <div class="rank-name">{{ score.playerName }}</div>
                  <div class="rank-score">{{ score.finalScore }} 分</div>
                  <div class="rank-details">
                    奢侈品: {{ score.luxuryTotal }} ×{{ score.multiplier }}
                    <span v-if="score.penalty !== 0">{{ score.penalty }}</span>
                    | 剩餘現金: {{ score.remainingMoney }}
                  </div>
                  <div class="rank-cards">
                    獲得: {{ getWonCardsSummary(score.wonCards) || "無" }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 出局玩家 -->
            <div v-if="gameEndResult.eliminated.length > 0" class="eliminated-section">
              <h3>出局（現金最少）</h3>
              <div
                v-for="score in gameEndResult.eliminated"
                :key="score.playerId"
                class="eliminated-item"
              >
                <div class="rank-info">
                  <div class="rank-name">{{ score.playerName }}</div>
                  <div class="rank-details">
                    剩餘現金: {{ score.remainingMoney }}
                    | 原始分數: {{ score.finalScore }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 拍賣結算通知 -->
        <div v-if="auctionResult && !gameEndResult" class="auction-result-overlay" @click="clearAuctionResult">
          <div class="auction-result-modal">
            <h3>拍賣結束</h3>
            <p><strong>{{ getPlayerName(auctionResult.winnerId) }}</strong> 得標</p>
            <p>獲得：{{ getCardDisplayName(auctionResult.card) }} {{ getCardTypeLabel(auctionResult.card) }}</p>
            <p v-if="auctionResult.spentTotal > 0">
              花費：{{ auctionResult.spentTotal }}（{{ auctionResult.spentCards.join(', ') }}）
            </p>
            <p v-else>免費獲得</p>
          </div>
        </div>

        <!-- 遊戲資訊列 -->
        <div class="game-info-bar">
          <span>牌組剩餘: {{ gameState.deckCount }}</span>
          <span v-if="currentBidder">輪到: {{ currentBidder.name }}</span>
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

        <!-- 拍賣狀態區 -->
        <div v-if="isInAuction && gameState.auctionRound" class="auction-status">
          <div class="auction-status-info">
            <span class="highest-bid">當前最高出價: {{ currentHighest }}</span>
            <span v-if="isMyTurn" class="my-turn-indicator">輪到你了</span>
          </div>
          <div v-if="!isViewingAsObserver && (gameState as GameState).auctionRound?.myBid && (gameState as GameState).auctionRound!.myBid!.total > 0" class="my-bid-info">
            你已出價: {{ (gameState as GameState).auctionRound!.myBid!.total }}
            ({{ (gameState as GameState).auctionRound!.myBid!.cards.join(', ') }})
          </div>
        </div>

        <!-- 玩家資訊區 -->
        <div class="players-info">
          <h3>玩家狀態</h3>
          <div class="player-cards">
            <div
              v-for="player in activePlayers"
              :key="player.id"
              class="player-info-card"
              :class="{
                'is-current': gameState.auctionRound?.currentBidderId === player.id,
                'has-passed': gameState.auctionRound && !gameState.auctionRound.activePlayers.includes(player.id)
              }"
            >
              <div class="player-info-name">
                {{ player.name }}
                <span v-if="!isViewingAsObserver && player.discordId === user?.id">(你)</span>
                <span v-if="gameState.auctionRound && !gameState.auctionRound.activePlayers.includes(player.id)" class="passed-badge">已 Pass</span>
              </div>
              <div class="player-info-stats">
                <!-- 觀戰者視角：所有玩家都用 players -->
                <template v-if="isViewingAsObserver">
                  <span>手牌: {{ (gameState as ObserverGameState).players[player.id]?.handCount ?? 0 }}張</span>
                  |
                  <span>已花費: {{ (gameState as ObserverGameState).players[player.id]?.spentTotal ?? 0 }}</span>
                </template>
                <!-- 玩家視角 -->
                <template v-else-if="player.discordId === user?.id">
                  <span>手牌: {{ (gameState as GameState).myState.hand.length }}張</span>
                  |
                  <span>已花費: {{ (gameState as GameState).myState.spentTotal }}</span>
                </template>
                <template v-else-if="(gameState as GameState).otherPlayers[player.id]">
                  <span>手牌: {{ (gameState as GameState).otherPlayers[player.id]!.handCount }}張</span>
                  |
                  <span>已花費: {{ (gameState as GameState).otherPlayers[player.id]!.spentTotal }}</span>
                </template>
              </div>
              <!-- 顯示獲得的牌 -->
              <div v-if="getWonCardsForPlayer(player.id).length > 0" class="player-won-cards">
                獲得: {{ getWonCardsSummary(getWonCardsForPlayer(player.id)) }}
              </div>
              <!-- 顯示該玩家的出價（觀戰者與玩家視角不同） -->
              <template v-if="isViewingAsObserver">
                <div v-if="(gameState as ObserverGameState).auctionRound?.bids[player.id]" class="player-bid-info">
                  出價: {{ (gameState as ObserverGameState).auctionRound!.bids[player.id]!.total }}
                  ({{ (gameState as ObserverGameState).auctionRound!.bids[player.id]!.cardCount }}張牌)
                </div>
              </template>
              <template v-else>
                <div v-if="(gameState as GameState).auctionRound?.otherBids[player.id]" class="player-bid-info">
                  出價: {{ (gameState as GameState).auctionRound!.otherBids[player.id]!.total }}
                  ({{ (gameState as GameState).auctionRound!.otherBids[player.id]!.cardCount }}張牌)
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- 我的手牌（觀戰者不顯示） -->
        <div v-if="!isViewingAsObserver" class="my-hand">
          <h3>我的手牌 <span v-if="selectedCards.length > 0">(已選: {{ selectedTotal }})</span></h3>
          <div class="hand-cards">
            <div
              v-for="(card, index) in (gameState as GameState).myState.hand"
              :key="`${card}-${index}`"
              class="hand-card"
              :class="{ selected: isCardSelected(card) }"
              @click="toggleCardSelection(card)"
            >
              {{ card }}
            </div>
          </div>

          <!-- 出價操作區 -->
          <div v-if="isInAuction" class="bid-actions">
            <div class="bid-preview">
              <span v-if="selectedCards.length > 0">
                新出價總額: {{ newBidTotal }}
                <span v-if="newBidTotal <= currentHighest" class="bid-warning">
                  (需高於 {{ currentHighest }})
                </span>
              </span>
            </div>
            <div class="bid-buttons">
              <button
                class="btn btn-primary"
                :disabled="!canBid"
                @click="handleBid"
              >
                出價
              </button>
              <button
                class="btn btn-secondary"
                :disabled="!canPass"
                @click="handlePass"
              >
                Pass
              </button>
            </div>
            <p v-if="!isMyTurn" class="wait-hint">等待其他玩家...</p>
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

.player-info-card.has-passed {
  opacity: 0.5;
}

.player-info-name {
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.passed-badge {
  font-size: 0.7em;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  background-color: #868e96;
  color: #fff;
  margin-left: 0.25rem;
}

.player-bid-info {
  font-size: 0.75em;
  color: #fab005;
  margin-top: 0.25rem;
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

.hand-card.selected {
  transform: translateY(-10px);
  box-shadow: 0 0 15px rgba(250, 176, 5, 0.6);
  border: 2px solid #fab005;
}

.auction-status {
  background-color: #1a1a1a;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
}

.auction-status-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.highest-bid {
  font-size: 1.1em;
  font-weight: 600;
  color: #fab005;
}

.my-turn-indicator {
  background-color: #2f9e44;
  color: #fff;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-weight: 600;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.my-bid-info {
  margin-top: 0.5rem;
  font-size: 0.9em;
  color: #69db7c;
}

.bid-actions {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #3a3a3a;
}

.bid-preview {
  margin-bottom: 0.75rem;
  font-size: 0.9em;
  color: #adb5bd;
}

.bid-warning {
  color: #ff6b6b;
}

.bid-buttons {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.wait-hint {
  margin-top: 0.5rem;
  font-size: 0.85em;
  color: #868e96;
  font-style: italic;
}

.auction-result-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  cursor: pointer;
}

.auction-result-modal {
  background-color: #2a2a2a;
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  border: 2px solid #fab005;
  max-width: 90%;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.auction-result-modal h3 {
  color: #fab005;
  margin-bottom: 1rem;
}

.auction-result-modal p {
  margin: 0.5rem 0;
  color: #adb5bd;
}

.auction-result-modal strong {
  color: #fff;
}

.player-won-cards {
  font-size: 0.75em;
  color: #69db7c;
  margin-top: 0.25rem;
}

.game-end-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  overflow-y: auto;
  padding: 1rem;
}

.game-end-modal {
  background-color: #2a2a2a;
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  border: 3px solid #fab005;
  max-width: 500px;
  width: 100%;
  animation: slideIn 0.3s ease-out;
}

.game-end-modal h2 {
  color: #fab005;
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
}

.rankings-section h3,
.eliminated-section h3 {
  color: #adb5bd;
  font-size: 1rem;
  margin-bottom: 0.75rem;
  text-align: left;
}

.ranking-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.75rem;
  background-color: #1a1a1a;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  text-align: left;
}

.ranking-item.winner {
  border: 2px solid #fab005;
  background-color: #2a2a1a;
}

.rank-position {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: #495057;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  color: #fff;
  flex-shrink: 0;
}

.ranking-item.winner .rank-position {
  background-color: #fab005;
  color: #1a1a1a;
}

.rank-info {
  flex: 1;
}

.rank-name {
  font-weight: 600;
  color: #fff;
  margin-bottom: 0.25rem;
}

.rank-score {
  font-size: 1.2em;
  font-weight: bold;
  color: #69db7c;
  margin-bottom: 0.25rem;
}

.rank-details {
  font-size: 0.8em;
  color: #adb5bd;
}

.rank-cards {
  font-size: 0.75em;
  color: #868e96;
  margin-top: 0.25rem;
}

.eliminated-section {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #3a3a3a;
}

.eliminated-item {
  padding: 0.75rem;
  background-color: #2a1a1a;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  text-align: left;
  border: 1px solid #ff6b6b;
}

.eliminated-item .rank-name {
  color: #ff6b6b;
}

.eliminated-item .rank-details {
  color: #868e96;
}

.observer-banner {
  background-color: #364fc7;
  color: #fff;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-weight: 600;
  text-align: center;
}
</style>
