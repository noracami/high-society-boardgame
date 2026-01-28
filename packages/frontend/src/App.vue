<script setup lang="ts">
import { ref, onMounted } from "vue";
import { setupDiscordSdk, type DiscordUser } from "./discord";

const user = ref<DiscordUser | null>(null);
const error = ref<string | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    const result = await setupDiscordSdk();
    user.value = result.user;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Unknown error";
  } finally {
    loading.value = false;
  }
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
</style>
