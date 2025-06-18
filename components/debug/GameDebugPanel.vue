<template>
  <div v-if="isDev">
    <!-- Debug Panel -->
    <div
      v-if="showDebug"
      class="debug-panel fixed bottom-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg text-xs max-w-sm"
    >
      <div class="flex justify-between items-center mb-2">
        <h4 class="font-bold">Debug Info</h4>
        <Button
          icon="pi pi-times"
          size="small"
          text
          @click="showDebug = false"
        />
      </div>
      <div class="space-y-1">
        <div>Game Status: {{ debugInfo.gameStatus || "N/A" }}</div>
        <div>Seeds in History: {{ debugInfo.seedHistoryCount }}</div>
        <div>CS2 Items Loaded: {{ debugInfo.cs2ItemsCount }}</div>
        <div>Cache Valid: {{ debugInfo.cacheValid ? "Yes" : "No" }}</div>
        <div>Auto-save: {{ debugInfo.autoSaveStatus }}</div>
        <div v-if="debugInfo.currentSeed">
          Current Seed: {{ debugInfo.currentSeed }}
        </div>
      </div>
    </div>

    <!-- Debug Toggle -->
    <Button
      v-if="!showDebug"
      icon="pi pi-bug"
      class="fixed bottom-4 right-4 opacity-50 hover:opacity-100"
      size="small"
      rounded
      severity="secondary"
      aria-label="Show Debug Panel"
      @click="showDebug = true"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import Button from "primevue/button";

// Props
interface DebugInfo {
  gameStatus?: string;
  seedHistoryCount: number;
  cs2ItemsCount: number;
  cacheValid: boolean;
  autoSaveStatus: string;
  currentSeed?: string;
}

interface Props {
  debugInfo: DebugInfo;
}

defineProps<Props>();

// State
const showDebug = ref(false);

// Computed
const isDev = computed(() => {
  return process.env.NODE_ENV === "development";
});
</script>

<style scoped>
.debug-panel {
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  animation: slideInRight 0.3s ease-out;
}

.debug-panel::-webkit-scrollbar {
  width: 4px;
}

.debug-panel::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.debug-panel::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

.debug-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
