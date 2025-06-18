<template>
  <div>
    <!-- Loading Screen -->
    <div
      v-if="isLoading"
      class="loading-screen fixed inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center z-50"
    >
      <div class="text-center text-white">
        <div class="mb-8">
          <i class="pi pi-spin pi-spinner text-6xl text-blue-400" />
        </div>
        <h2 class="text-3xl font-bold mb-4">CS2 Memory Game</h2>
        <p class="text-lg opacity-80 mb-4">{{ loadingMessage }}</p>
        <ProgressBar
          v-if="loadingProgress > 0"
          :value="loadingProgress"
          class="w-64 mx-auto"
          :show-value="false"
        />
      </div>
    </div>

    <!-- Error Screen -->
    <div
      v-else-if="hasError"
      class="error-screen min-h-screen bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900 dark:to-red-800 flex items-center justify-center p-4"
    >
      <Card class="max-w-md w-full">
        <template #content>
          <div class="text-center">
            <i class="pi pi-exclamation-triangle text-6xl text-red-500 mb-4" />
            <h2 class="text-2xl font-bold text-red-700 dark:text-red-300 mb-2">
              Game Loading Error
            </h2>
            <p class="text-red-600 dark:text-red-400 mb-6">
              {{ errorMessage }}
            </p>
            <div class="flex gap-3 justify-center">
              <Button
                label="Retry"
                icon="pi pi-refresh"
                severity="danger"
                @click="retryLoading"
              />
              <Button
                label="Reset Data"
                icon="pi pi-trash"
                severity="secondary"
                outlined
                @click="resetAllData"
              />
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- Main Game Interface -->
    <GameInterface v-else />

    <!-- Debug Panel (Development Only) -->
    <div
      v-if="isDev && showDebug"
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
        <div>Game Status: {{ gameController?.gameStatus.value || "N/A" }}</div>
        <div>Seeds in History: {{ seedHistory.length }}</div>
        <div>CS2 Items Loaded: {{ cs2ItemsCount }}</div>
        <div>Cache Valid: {{ cacheValid ? "Yes" : "No" }}</div>
        <div>Auto-save: {{ autoSaveStatus }}</div>
      </div>
    </div>

    <!-- Debug Toggle (Development Only) -->
    <Button
      v-if="isDev && !showDebug"
      icon="pi pi-bug"
      class="fixed bottom-4 right-4 opacity-50 hover:opacity-100"
      size="small"
      rounded
      severity="secondary"
      @click="showDebug = true"
    />

    <!-- Global Toast Container -->
    <Toast position="top-right" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import type { useGameController } from "~/composables/core/useGameController";

// PrimeVue components
import Button from "primevue/button";
import Card from "primevue/card";
import ProgressBar from "primevue/progressbar";
import Toast from "primevue/toast";

// Game components
import GameInterface from "~/components/game/core/GameInterface.vue";

// Define page meta
definePageMeta({
  layout: "default",
  title: "CS2 Memory Game",
  description: "Test your memory with Counter-Strike 2 weapons and items",
});

// State
const isLoading = ref(true);
const hasError = ref(false);
const errorMessage = ref("");
const loadingMessage = ref("Initializing...");
const loadingProgress = ref(0);
const showDebug = ref(false);

// Game controller
let gameController: ReturnType<typeof useGameController> | null = null;

// Environment check
const isDev = computed(() => {
  return process.env.NODE_ENV === "development";
});

// Debug info
const seedHistory = computed(() => {
  return gameController?.seedSystem.state.value.seedHistory || [];
});

const cs2ItemsCount = computed(() => {
  return gameController?.cs2Data.state.value.items.length || 0;
});

const cacheValid = computed(() => {
  return gameController?.cs2Data.cacheStatus.value.isValid || false;
});

const autoSaveStatus = computed(() => {
  if (!gameController) return "N/A";
  return gameController.shouldAutoSave.value ? "Active" : "Inactive";
});

// Loading simulation
const simulateLoading = async () => {
  const steps = [
    { message: "Initializing game engine...", duration: 500 },
    { message: "Loading CS2 item database...", duration: 800 },
    { message: "Setting up game systems...", duration: 600 },
    { message: "Preparing game interface...", duration: 400 },
    { message: "Ready to play!", duration: 300 },
  ];

  let progress = 0;
  const progressStep = 100 / steps.length;

  for (const step of steps) {
    loadingMessage.value = step.message;
    await new Promise((resolve) => setTimeout(resolve, step.duration));
    progress += progressStep;
    loadingProgress.value = Math.min(progress, 100);
  }
};

// Methods
const initializeGame = async () => {
  try {
    isLoading.value = true;
    hasError.value = false;
    errorMessage.value = "";

    // Import and initialize game controller
    const { useGameController } = await import(
      "~/composables/core/useGameController"
    );
    gameController = useGameController();

    // Run loading simulation in parallel with actual initialization
    const [_] = await Promise.all([
      simulateLoading(),
      gameController.initializeGame(),
    ]);

    // Check if initialization was successful
    if (gameController.state.value.error) {
      throw new Error(gameController.state.value.error);
    }

    console.log("Game initialized successfully");
  } catch (error) {
    console.error("Failed to initialize game:", error);
    hasError.value = true;
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "An unknown error occurred while loading the game";
  } finally {
    isLoading.value = false;
  }
};

const retryLoading = async () => {
  loadingProgress.value = 0;
  await initializeGame();
};

const resetAllData = async () => {
  try {
    // Clear all stored data
    if (typeof localStorage !== "undefined") {
      const keysToRemove = Object.keys(localStorage).filter((key) =>
        key.startsWith("cs2-memory-")
      );
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    }

    // Retry initialization
    await retryLoading();
  } catch (error) {
    console.error("Failed to reset data:", error);
  }
};

// Lifecycle
onMounted(async () => {
  await initializeGame();
});

onUnmounted(() => {
  // Cleanup if needed
  if (gameController?.state.value.hasUnsavedChanges) {
    // Save game before leaving
    gameController.saveGame().catch(console.error);
  }
});

// Handle browser refresh/close
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (event) => {
    if (gameController?.state.value.hasUnsavedChanges) {
      event.preventDefault();
      event.returnValue =
        "You have unsaved progress. Are you sure you want to leave?";
      return event.returnValue;
    }
  });
}

// Global error handler
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    // Handle cases where event.error might be null
    const error = event.error || new Error("Unknown error occurred");
    console.error("Global error:", error);

    // Only show error UI if we don't already have an error state
    if (!hasError.value) {
      hasError.value = true;
      errorMessage.value =
        error.message ||
        "An unexpected error occurred. Please refresh the page.";
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    // Handle promise rejections more gracefully
    const reason = event.reason || "Unknown rejection reason";
    console.error("Unhandled promise rejection:", reason);

    // Only show error UI if we don't already have an error state
    if (!hasError.value) {
      hasError.value = true;
      errorMessage.value =
        typeof reason === "string"
          ? reason
          : reason?.message ||
            "An unexpected error occurred. Please refresh the page.";
    }
  });
}
</script>
