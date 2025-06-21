<template>
  <div class="w-full px-2 py-4 md:px-4">
    <!-- Game Header -->
    <GameHeader
      :can-share="canShare"
      @show-settings="uiStore.openDialog('settings')"
      @share-game="shareGame"
    />

    <!-- Game Status Bar -->
    <GameStatusBar
      :time-elapsed="coreStore.stats.timeElapsed"
      :stats="coreStore.stats"
      :current-score="coreStore.currentScore"
    />

    <!-- Progress Bar -->
    <GameProgressBar :progress="gameProgress" />

    <!-- Game Controls -->
    <div class="game-controls mb-6 transition-all duration-200">
      <div class="flex flex-wrap gap-3 justify-center">
        <Button
          v-if="gameStatus === 'ready'"
          label="Start Game"
          icon="pi pi-play"
          severity="success"
          size="large"
          @click="() => startNewGame()"
        />

        <Button
          v-if="gameStatus === 'playing'"
          label="Pause"
          icon="pi pi-pause"
          severity="warning"
          @click="pauseGame"
        />

        <Button
          v-if="gameStatus === 'completed'"
          label="Play Again"
          icon="pi pi-replay"
          severity="success"
          size="large"
          @click="playAgain"
        />

        <Button
          label="New Game"
          icon="pi pi-plus"
          severity="info"
          outlined
          @click="uiStore.openDialog('newGame')"
        />
      </div>
    </div>

    <!-- Game Canvas Container -->
    <div
      ref="canvasWrapperRef"
      class="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-lg p-2 md:p-4 shadow-inner min-h-[400px] flex items-center justify-center w-full"
      :data-device="deviceDetection.deviceType.value"
    >
      <ClientOnly>
        <GameCanvas
          v-if="!showFallbackUI && cardsStore.cards.length > 0"
          :cards="cardsStore.cards"
          :canvas-width="canvasDimensions.width"
          :canvas-height="canvasDimensions.height"
          :game-status="gameStatus"
          :is-interactive="gameStatus === 'playing'"
          :selected-cards="cardsStore.selectedCardsData"
          @card-clicked="handleCardClick"
          @canvas-ready="handleCanvasReady"
          @canvas-error="handleCanvasError"
          @loading-state-changed="handleLoadingStateChanged"
        />

        <!-- Enhanced Fallback UI when Canvas fails -->
        <div v-else-if="showFallbackUI" class="w-full max-w-4xl">
          <div class="text-center mb-6">
            <div
              class="bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900 dark:to-orange-900 border border-yellow-300 dark:border-yellow-700 rounded-lg p-6 mb-4"
            >
              <i
                class="pi pi-exclamation-triangle text-yellow-600 dark:text-yellow-400 text-3xl mb-3"
              ></i>
              <h3
                class="text-xl font-bold text-yellow-800 dark:text-yellow-200 mb-2"
              >
                Advanced Rendering Unavailable
              </h3>
              <p class="text-yellow-700 dark:text-yellow-300 mb-3">
                Using simplified fallback interface.
              </p>
            </div>
          </div>

          <!-- Fallback Card Grid -->
          <div
            class="grid gap-3 md:gap-4 mx-auto p-4 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-xl shadow-inner"
            :class="fallbackGridClasses"
            :style="{ maxWidth: canvasDimensions.width + 'px' }"
          >
            <div
              v-for="card in cardsStore.cards"
              :key="card.id"
              class="fallback-card aspect-[3/4] rounded-xl border-2 transition-all duration-300 cursor-pointer select-none transform hover:scale-105 hover:shadow-lg"
              :class="getFallbackCardClasses(card)"
              @click="handleCardClick(card.id)"
            >
              <!-- Card Back -->
              <div
                v-if="card.state === 'hidden'"
                class="w-full h-full bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 rounded-xl flex items-center justify-center"
              >
                <i
                  class="pi pi-question text-white text-3xl md:text-4xl drop-shadow-lg"
                />
              </div>

              <!-- Card Front -->
              <div
                v-else
                class="w-full h-full rounded-xl flex flex-col items-center justify-center p-3"
                :class="getFallbackCardFrontClasses(card)"
              >
                <div class="text-center">
                  <div
                    class="text-sm md:text-base font-bold text-white drop-shadow-md mb-1"
                  >
                    {{ card.cs2Item?.name || "Unknown Item" }}
                  </div>
                  <div class="text-xs md:text-sm text-white/90 capitalize">
                    {{ card.cs2Item?.rarity || "Common" }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div v-else-if="isLoading" class="w-full text-center py-12">
          <i class="pi pi-spin pi-spinner text-4xl text-gray-400 mb-4" />
          <p class="text-gray-600 dark:text-gray-400">Loading game...</p>
        </div>

        <!-- Empty State -->
        <div v-else class="w-full text-center py-12">
          <i class="pi pi-play text-4xl text-gray-400 mb-4" />
          <p class="text-gray-600 dark:text-gray-400">
            Start a new game to begin playing
          </p>
        </div>
      </ClientOnly>
    </div>

    <!-- Game Dialogs -->
    <NewGameDialog
      :visible="uiStore.dialogsState.newGame"
      :difficulties="difficulties"
      :seed-history="seedHistory"
      :seed-validator="seedValidator"
      @close="uiStore.closeDialog('newGame')"
      @start-game="handleNewGameStart"
    />

    <SettingsDialog
      :visible="uiStore.dialogsState.settings"
      :difficulties="difficulties"
      :seed-validator="seedValidator"
      @close="uiStore.closeDialog('settings')"
      @apply="handleSettingsApply"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from "vue";

import GameHeader from "../ui/header/GameHeader.vue";
import GameStatusBar from "../ui/status/GameStatusBar.vue";
import GameProgressBar from "../ui/status/GameProgressBar.vue";
import SettingsDialog from "../dialogs/SettingsDialog.vue";
import NewGameDialog from "../dialogs/NewGameDialog.vue";
import GameCanvas from "./GameCanvas.vue";

import { useToast } from "primevue/usetoast";
import type { GameOptions, GameCard, GameResult } from "~/types/game";
import { useDeviceDetection } from "~/composables/device/useDeviceDetection";
import { useGameUIStore } from "~/stores/game/ui";
import { useGameCoreStore } from "~/stores/game/core";
import { useGameCardsStore } from "~/stores/game/cards";
import { useGameTimerStore } from "~/stores/game/timer";
import { useCS2Data } from "~/composables/data/useCS2Data";
import { useGamePersistence } from "~/composables/data/useGamePersistence";

// Composables
const toast = useToast();
const deviceDetection = useDeviceDetection();

// Stores - Direct Pinia usage like the plan suggests
const uiStore = useGameUIStore();
const coreStore = useGameCoreStore();
const cardsStore = useGameCardsStore();
const timerStore = useGameTimerStore();

// Data loading - Simple like weapon.vue
const { initializeData } = useCS2Data();

// Game persistence for seed history
const { loadGameHistory } = useGamePersistence();

// Refs
const canvasWrapperRef = ref<HTMLDivElement>();
const showFallbackUI = ref(false);
const isLoading = ref(false);

// Difficulty configurations
const difficulties = computed(() => [
  {
    name: "easy" as const,
    label: "Easy",
    cardCount: 12,
    gridSize: { rows: 3, cols: 4 },
  },
  {
    name: "medium" as const,
    label: "Medium",
    cardCount: 24,
    gridSize: { rows: 4, cols: 6 },
  },
  {
    name: "hard" as const,
    label: "Hard",
    cardCount: 48,
    gridSize: { rows: 6, cols: 8 },
  },
]);

// Seed history
const seedHistory = ref<string[]>([]);

// Load seed history on component mount
const loadSeedHistory = async () => {
  try {
    const history = await loadGameHistory();
    seedHistory.value = [
      ...new Set(history.map((h: GameResult) => h.seed).filter(Boolean)),
    ].slice(0, 10); // Last 10 unique seeds
  } catch (error) {
    console.error("Failed to load seed history:", error);
    seedHistory.value = [];
  }
};

// Seed validator
const seedValidator = (seed: string) => {
  if (!seed.trim()) {
    return { isValid: false, error: "Seed cannot be empty" };
  }
  if (seed.length < 3) {
    return { isValid: false, error: "Seed must be at least 3 characters" };
  }
  if (seed.length > 50) {
    return { isValid: false, error: "Seed must be less than 50 characters" };
  }
  return { isValid: true, error: null };
};

// Computed properties - Direct from stores
const gameStatus = computed(() => {
  if (isLoading.value) return "initializing";
  if (!coreStore.isPlaying && cardsStore.cards.length === 0) return "ready";
  if (coreStore.isPlaying) return "playing";
  if (coreStore.isGameComplete) return "completed";
  return "ready";
});

const gameProgress = computed(() => {
  if (cardsStore.cards.length === 0) return 0;
  const totalPairs = coreStore.stats.totalPairs;
  const matchedPairs = coreStore.stats.matchesFound;
  return totalPairs > 0 ? (matchedPairs / totalPairs) * 100 : 0;
});

const canShare = computed(() => cardsStore.cards.length > 0);

// Game initialization - Simplified like weapon.vue
const initializeGame = async (options: Partial<GameOptions> = {}) => {
  try {
    isLoading.value = true;

    // Reset timer first
    timerStore.resetTimer();

    // Initialize core game settings
    await coreStore.initializeGame(options);

    // Load CS2 data - simple like weapon.vue
    const difficulty = coreStore.difficulty;
    await initializeData(100); // Load 100 items like analysis suggests

    // Generate cards with Pinia store
    await cardsStore.generateCards(difficulty, coreStore.seed);

    console.log(
      `🎮 Game initialized: ${difficulty.name} mode with ${cardsStore.cards.length} cards`
    );
  } catch (error) {
    console.error("Failed to initialize game:", error);
    toast.add({
      severity: "error",
      summary: "Initialization Failed",
      detail: "Could not load game data",
      life: 5000,
    });
  } finally {
    isLoading.value = false;
  }
};

// Game actions - Simplified
const startNewGame = async (options: Partial<GameOptions> = {}) => {
  await initializeGame(options);
  coreStore.startGame();
  timerStore.startTimer();
  console.log("🕐 Timer started, isRunning:", timerStore.isRunning);
};

const pauseGame = () => {
  coreStore.pauseGame();
  timerStore.pauseTimer();
};

const playAgain = async () => {
  const currentDifficulty = coreStore.difficulty.name;
  await startNewGame({ difficulty: currentDifficulty });
};

// Canvas dimensions
const canvasDimensions = computed(() => {
  const container = canvasWrapperRef.value;
  if (!container) {
    return { width: 800, height: 600 };
  }

  const containerRect = container.getBoundingClientRect();
  const padding = 32;

  return {
    width: Math.max(400, containerRect.width - padding),
    height: Math.max(300, containerRect.height - padding),
  };
});

// Canvas event handlers
const handleCardClick = (cardId: string) => {
  if (gameStatus.value !== "playing") return;

  console.log(`🎯 Card clicked in GameInterface: ${cardId}`);
  // Card selection is now handled directly in GameCanvas via store
};

const handleCanvasReady = () => {
  console.log("✅ Game canvas ready");
};

const handleCanvasError = (error?: string) => {
  console.error("❌ Canvas error:", error);
  showFallbackUI.value = true;
  toast.add({
    severity: "warn",
    summary: "Rendering Issue",
    detail: "Switched to fallback interface",
    life: 3000,
  });
};

const handleLoadingStateChanged = (loading: boolean) => {
  console.log("Canvas loading state:", loading);
};

// Game sharing
const shareGame = async () => {
  try {
    const shareUrl = `${window.location.origin}${window.location.pathname}?seed=${coreStore.seed}&difficulty=${coreStore.difficulty.name}`;
    await navigator.clipboard.writeText(shareUrl);
    toast.add({
      severity: "success",
      summary: "Shared!",
      detail: "Game URL copied to clipboard",
      life: 3000,
    });
  } catch (error) {
    console.error("Failed to share game:", error);
    toast.add({
      severity: "error",
      summary: "Share Failed",
      detail: "Could not copy URL to clipboard",
      life: 3000,
    });
  }
};

// Dialog handlers
const handleSettingsApply = async (settings: {
  difficulty: "easy" | "medium" | "hard";
  seed?: string;
  enableSound: boolean;
  enableParallax: boolean;
}) => {
  try {
    uiStore.updateUIOption("enableSound", settings.enableSound);
    uiStore.updateUIOption("enableParallax", settings.enableParallax);

    await startNewGame({
      difficulty: settings.difficulty,
      seed: settings.seed,
      enableSound: settings.enableSound,
      enableParallax: settings.enableParallax,
    });

    uiStore.closeDialog("settings");
    toast.add({
      severity: "success",
      summary: "Settings Applied",
      detail: "New game started with updated settings",
      life: 3000,
    });
  } catch (error) {
    console.error("Failed to apply settings:", error);
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Failed to apply settings",
      life: 3000,
    });
  }
};

const handleNewGameStart = async (options: {
  difficulty: "easy" | "medium" | "hard";
  seed?: string;
}) => {
  try {
    await startNewGame(options);
    uiStore.closeDialog("newGame");
    toast.add({
      severity: "success",
      summary: "New Game Started",
      detail: `Started ${options.difficulty} difficulty game`,
      life: 3000,
    });
  } catch (error) {
    console.error("Failed to start new game:", error);
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Failed to start new game",
      life: 3000,
    });
  }
};

// Fallback UI helpers
const fallbackGridClasses = computed(() => {
  const difficulty = coreStore.difficulty?.name || "easy";
  const gridConfigs: Record<string, string> = {
    easy: "grid-cols-4 md:grid-cols-4",
    medium: "grid-cols-4 md:grid-cols-6",
    hard: "grid-cols-4 md:grid-cols-8",
  };
  return gridConfigs[difficulty] || gridConfigs.easy;
});

const getFallbackCardClasses = (card: GameCard) => {
  const isSelected = cardsStore.selectedCards.includes(card.id);
  const isMatched = card.state === "matched";
  const isRevealed = card.state === "revealed";

  return {
    "border-blue-500 bg-blue-50 dark:bg-blue-900": card.state === "hidden",
    "border-green-500 bg-green-50 dark:bg-green-900": isMatched,
    "border-yellow-500 bg-yellow-50 dark:bg-yellow-900":
      isRevealed && !isMatched,
    "ring-2 ring-blue-400": isSelected,
    "opacity-50": isMatched,
  };
};

const getFallbackCardFrontClasses = (card: GameCard) => {
  const rarityColors: Record<string, string> = {
    consumer: "bg-gradient-to-br from-gray-400 to-gray-600",
    industrial: "bg-gradient-to-br from-blue-400 to-blue-600",
    milSpec: "bg-gradient-to-br from-purple-400 to-purple-600",
    restricted: "bg-gradient-to-br from-pink-400 to-pink-600",
    classified: "bg-gradient-to-br from-red-400 to-red-600",
    covert: "bg-gradient-to-br from-orange-400 to-orange-600",
    contraband: "bg-gradient-to-br from-yellow-400 to-yellow-600",
  };

  const rarity = card.cs2Item?.rarity || "consumer";
  return rarityColors[rarity] || rarityColors.consumer;
};

// Watchers
watch(
  () => coreStore.isGameComplete,
  (isComplete) => {
    if (isComplete) {
      const score = coreStore.currentScore;
      const timeElapsed = coreStore.stats.timeElapsed;
      const moves = coreStore.stats.moves;

      const minutes = Math.floor(timeElapsed / 60);
      const seconds = Math.floor(timeElapsed % 60);
      const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

      toast.add({
        severity: "success",
        summary: "🎉 Congratulations!",
        detail: `Game completed in ${formattedTime} with ${moves} moves. Score: ${score.toLocaleString()}`,
        life: 5000,
      });

      timerStore.stopTimer();
    }
  }
);

// Sync timer store with core store stats
watch(
  () => timerStore.timeElapsed,
  (newTimeElapsed) => {
    coreStore.updateTimeElapsed(newTimeElapsed);
    // Uncomment for debugging: console.log("⏰ Timer sync:", newTimeElapsed, "ms");
  }
);

// Initialize default game on mount
onMounted(async () => {
  await nextTick();
  // Load seed history
  await loadSeedHistory();
  // Auto-start easy game for testing
  // await startNewGame({ difficulty: "easy" });
});
</script>
