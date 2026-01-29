<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { setupDiscordSdk, getInstanceId, type DiscordUser } from "./discord";
import { connectSocket, disconnectSocket } from "./socket";
import type { RoomPlayer } from "@high-society/shared";

const user = ref<DiscordUser | null>(null);
const error = ref<string | null>(null);
const loading = ref(true);
const players = ref<RoomPlayer[]>([]);

onMounted(async () => {
  try {
    const result = await setupDiscordSdk();
    user.value = result.user;

    connectSocket(result.accessToken, getInstanceId(), {
      onRoomJoined: (state) => {
        players.value = state.players;
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

    <div v-else-if="user" class="user-info">
      <p class="status success">已認證</p>
      <p><strong>User ID:</strong> {{ user.id }}</p>
      <p><strong>Username:</strong> {{ user.global_name || user.username }}</p>

      <div class="players-section">
        <h2>房間玩家</h2>
        <ul class="player-list">
          <li
            v-for="player in players"
            :key="player.id"
            :class="{ offline: !player.isOnline }"
          >
            <span class="status-dot" :class="{ online: player.isOnline }"></span>
            {{ player.name }}
            <span v-if="player.discordId === user.id" class="you-badge">(你)</span>
          </li>
        </ul>
        <p v-if="players.length === 0" class="no-players">等待其他玩家加入...</p>
      </div>
    </div>
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
</style>
