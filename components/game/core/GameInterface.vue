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
      :time-elapsed="gameController.game.timeElapsed.value"
      :stats="gameController.game.stats.value"
      :current-score="gameController.game.currentScore.value"
    />

    <!-- Progress Bar -->
    <GameProgressBar :progress="gameController.gameProgress.value" />

    <!-- Game Controls -->
    <div class="game-controls mb-6 transition-all duration-200">
      <div class="flex flex-wrap gap-3 justify-center">
        <Button
          v-if="
            gameController.gameStatus.value === 'ready' &&
            gameController.canContinueSavedGame.value
          "
          label="Continue Game"
          icon="pi pi-play-circle"
          severity="success"
          size="large"
          @click="continueSavedGame"
        />

        <Button
          v-if="
            gameController.gameStatus.value === 'ready' &&
            !gameController.canContinueSavedGame.value
          "
          label="Start Game"
          icon="pi pi-play"
          severity="success"
          size="large"
          @click="startNewGame"
        />

        <Button
          v-if="
            gameController.gameStatus.value === 'ready' &&
            gameController.canContinueSavedGame.value
          "
          label="Start New Game"
          icon="pi pi-plus"
          severity="info"
          outlined
          @click="confirmStartNewGame"
        />

        <Button
          v-if="gameController.gameStatus.value === 'playing'"
          label="Pause"
          icon="pi pi-pause"
          severity="warning"
          @click="pauseGame"
        />

        <Button
          v-if="gameController.gameStatus.value === 'playing'"
          label="Restart"
          icon="pi pi-refresh"
          severity="danger"
          outlined
          @click="uiStore.openDialog('confirmRestart')"
        />

        <Button
          v-if="gameController.gameStatus.value === 'completed'"
          label="Play Again"
          icon="pi pi-replay"
          severity="success"
          size="large"
          @click="playAgain"
        />

        <Button
          v-if="!gameController.canContinueSavedGame.value"
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
          v-if="!showFallbackUI"
          :cards="gameController.game.cards.value"
          :canvas-width="canvasDimensions.width"
          :canvas-height="canvasDimensions.height"
          :game-status="gameController.gameStatus.value"
          :is-interactive="gameController.gameStatus.value === 'playing'"
          :selected-cards="gameController.game.selectedCardsData.value"
          @card-clicked="handleCardClick"
          @canvas-ready="handleCanvasReady"
          @canvas-error="handleCanvasError"
          @loading-state-changed="handleLoadingStateChanged"
        />

        <!-- Enhanced Fallback UI when Canvas fails -->
        <div v-else class="w-full max-w-4xl">
          <!-- Enhanced Error Message -->
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
                Your browser doesn't support WebGL or Canvas rendering failed.
                Using optimized grid interface with full game functionality.
              </p>
              <div class="flex justify-center gap-2">
                <Button
                  label="Retry Advanced Mode"
                  icon="pi pi-refresh"
                  severity="warning"
                  size="small"
                  @click="retryCanvas"
                />
                <Button
                  label="Continue with Grid"
                  icon="pi pi-check"
                  severity="success"
                  size="small"
                  outlined
                  @click="acceptFallback"
                />
              </div>
            </div>
          </div>

          <!-- Enhanced Fallback Card Grid -->
          <div
            class="grid gap-3 md:gap-4 mx-auto p-4 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-xl shadow-inner"
            :class="fallbackGridClasses"
            :style="{ maxWidth: canvasDimensions.width + 'px' }"
          >
            <div
              v-for="card in gameController.game.cards.value"
              :key="card.id"
              class="fallback-card aspect-[3/4] rounded-xl border-2 transition-all duration-300 cursor-pointer select-none transform hover:scale-105 hover:shadow-lg"
              :class="getFallbackCardClasses(card)"
              @click="handleCardClick(card.id)"
            >
              <!-- Enhanced Card Back -->
              <div
                v-if="card.state === 'hidden'"
                class="w-full h-full bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 rounded-xl flex items-center justify-center relative overflow-hidden"
              >
                <div
                  class="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 transform -skew-x-12 translate-x-full animate-pulse"
                ></div>
                <i
                  class="pi pi-question text-white text-3xl md:text-4xl drop-shadow-lg"
                ></i>
              </div>

              <!-- Enhanced Card Front -->
              <div
                v-else
                class="w-full h-full rounded-xl flex flex-col items-center justify-center p-3 relative overflow-hidden"
                :class="getFallbackCardFrontClasses(card)"
              >
                <div
                  class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"
                ></div>
                <div class="relative z-10 text-center">
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

          <!-- Fallback Status -->
          <div
            class="text-center mt-6 text-sm text-gray-600 dark:text-gray-400"
          >
            <i class="pi pi-info-circle mr-1"></i>
            Grid mode active - All game features available
          </div>
        </div>
      </ClientOnly>
    </div>

    <!-- Settings Dialog -->
    <SettingsDialog
      :visible="uiStore.dialogsState.settings"
      :difficulties="difficulties"
      :seed-validator="gameController.seedSystem.validateSeed"
      @visible="
        (value) =>
          value
            ? uiStore.openDialog('settings')
            : uiStore.closeDialog('settings')
      "
      @apply="handleSettingsApply"
      @cancel="uiStore.closeDialog('settings')"
    />

    <!-- New Game Dialog -->
    <NewGameDialog
      :visible="uiStore.dialogsState.newGame"
      :difficulties="difficulties"
      :seed-history="seedHistory"
      :seed-validator="gameController.seedSystem.validateSeed"
      @visible="
        (value) =>
          value ? uiStore.openDialog('newGame') : uiStore.closeDialog('newGame')
      "
      @start-game="handleNewGameStart"
      @cancel="uiStore.closeDialog('newGame')"
    />

    <!-- Confirmation Dialogs -->
    <ConfirmDialog />

    <!-- Game Completion Toast -->
    <Toast />

    <!-- Debug Panel (Development Only) -->
    <GameDebugPanel :debug-info="debugInfo" />
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, useTemplateRef, ref, nextTick } from "vue";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import type { GameOptions, GameCard } from "~/types/game";
import { useGameController } from "~/composables/core/useGameController";
import { useGameUIStore } from "~/stores/game/ui";
import { useDeviceDetection } from "~/composables/device/useDeviceDetection";

// PrimeVue components
import Button from "primevue/button";
import ConfirmDialog from "primevue/confirmdialog";
import Toast from "primevue/toast";

// Game components
import GameHeader from "../ui/header/GameHeader.vue";
import GameStatusBar from "../ui/status/GameStatusBar.vue";
import GameProgressBar from "../ui/status/GameProgressBar.vue";
import SettingsDialog from "../dialogs/SettingsDialog.vue";
import NewGameDialog from "../dialogs/NewGameDialog.vue";
import GameCanvas from "./GameCanvas.vue";
import GameDebugPanel from "../../debug/GameDebugPanel.vue";

// Composables and stores
const gameController = useGameController();
const uiStore = useGameUIStore();
const confirm = useConfirm();
const toast = useToast();

// Device detection and layout
const deviceDetection = useDeviceDetection();

// Template refs
const canvasWrapperRef = useTemplateRef<HTMLDivElement>("canvasWrapperRef");

// Debug configuration (set to true for development/testing)

// Difficulty configurations
const difficulties = [
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
];

// Computed properties
const canShare = computed(() => {
  return gameController.seedSystem.canShareSeed.value;
});

const seedHistory = computed(() => {
  return [...gameController.seedSystem.state.value.seedHistory];
});

// Debug info for development
const debugInfo = computed(() => ({
  gameStatus: gameController.gameStatus.value,
  seedHistoryCount: gameController.seedSystem.state.value.seedHistory.length,
  cs2ItemsCount: gameController.cs2Data.state.value.items.length,
  cacheValid: gameController.cs2Data.hasItems.value,
  autoSaveStatus: gameController.state.value.hasUnsavedChanges
    ? "Pending"
    : "Saved",
  currentSeed: gameController.seedSystem.state.value.currentSeed,
}));

// Methods
const startNewGame = async () => {
  try {
    await gameController.game.startGame();
  } catch (error) {
    console.error("Failed to start game:", error);
  }
};

const continueSavedGame = async () => {
  try {
    const success = await gameController.continueSavedGame();
    if (success) {
      toast.add({
        severity: "success",
        summary: "Game Resumed",
        detail: "Your saved game has been resumed",
        life: 3000,
      });
    }
  } catch (error) {
    console.error("Failed to continue saved game:", error);
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Failed to continue saved game",
      life: 3000,
    });
  }
};

const pauseGame = () => {
  try {
    gameController.game.pauseGame();
  } catch (error) {
    console.error("Failed to pause game:", error);
  }
};

const playAgain = async () => {
  try {
    await gameController.restartGame();
  } catch (error) {
    console.error("Failed to restart game:", error);
  }
};

const shareGame = async () => {
  try {
    const shareUrl = gameController.shareCurrentGame();
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

const handleSettingsApply = async (settings: {
  difficulty: "easy" | "medium" | "hard";
  seed?: string;
  enableSound: boolean;
  enableParallax: boolean;
}) => {
  const newOptions: GameOptions = {
    difficulty: settings.difficulty,
    seed: settings.seed,
    enableSound: settings.enableSound,
    enableParallax: settings.enableParallax,
  };

  try {
    // Update UI options
    uiStore.updateUIOption("enableSound", settings.enableSound);
    uiStore.updateUIOption("enableParallax", settings.enableParallax);

    await gameController.startNewGame(newOptions);
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
  const newOptions: GameOptions = {
    difficulty: options.difficulty,
    seed: options.seed,
    enableSound: uiStore.uiOptions.enableSound,
    enableParallax: uiStore.uiOptions.enableParallax,
  };

  try {
    await gameController.startNewGame(newOptions);
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

const confirmStartNewGame = () => {
  confirm.require({
    message:
      "Are you sure you want to start a new game? Your current saved game will be lost.",
    header: "Confirm New Game",
    icon: "pi pi-exclamation-triangle",
    accept: async () => {
      uiStore.openDialog("newGame");
    },
    reject: () => {
      // User rejected the confirmation
    },
  });
};

// Watchers
watch(
  () => gameController.game.isGameComplete.value,
  (isComplete) => {
    if (isComplete) {
      const score = gameController.game.currentScore.value;
      const timeElapsed = gameController.game.timeElapsed.value;
      const moves = gameController.game.stats.value.moves;

      const minutes = Math.floor(timeElapsed / 60);
      const seconds = Math.floor(timeElapsed % 60);
      const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

      toast.add({
        severity: "success",
        summary: "🎉 Congratulations!",
        detail: `Game completed in ${formattedTime} with ${moves} moves. Score: ${score.toLocaleString()}`,
        life: 5000,
      });
    }
  }
);

// Canvas dimensions calculation
const canvasDimensions = computed(() => {
  const container = canvasWrapperRef.value;
  if (!container) {
    return { width: 800, height: 600 }; // Default dimensions
  }

  const containerRect = container.getBoundingClientRect();
  const padding = 32; // Account for container padding

  return {
    width: Math.max(400, containerRect.width - padding),
    height: Math.max(300, containerRect.height - padding),
  };
});

// Canvas event handlers
const handleCardClick = (cardOrId: GameCard | string) => {
  try {
    const cardId = typeof cardOrId === "string" ? cardOrId : cardOrId.id;
    gameController.game.selectCard(cardId);
  } catch (error) {
    console.error("Failed to select card:", error);
  }
};

const handleCanvasReady = () => {
  console.log("Game canvas initialized successfully");
};

// Removed duplicate - see updated version below

const handleLoadingStateChanged = (isLoading: boolean) => {
  // Could be used to show/hide loading indicators
  console.log("Canvas loading state changed:", isLoading);
};

// Watch for window size changes to update canvas dimensions
watch(
  () => deviceDetection.windowSize.value,
  (newSize) => {
    console.log(
      `📏 Window size changed: ${newSize.width}×${newSize.height}, device: ${deviceDetection.deviceType.value}`
    );
    // The canvasDimensions computed will automatically recalculate due to reactive dependencies
  },
  { deep: true }
);

// Fallback UI state
const showFallbackUI = ref(false);

// Fallback UI computed properties
const fallbackGridClasses = computed(() => {
  // Get difficulty from current game state or default to easy
  const difficulty = gameController.game.difficulty.value?.name || "easy";
  const gridConfigs: Record<string, string> = {
    easy: "grid-cols-4 md:grid-cols-4",
    medium: "grid-cols-4 md:grid-cols-6",
    hard: "grid-cols-4 md:grid-cols-8",
  };
  return gridConfigs[difficulty] || gridConfigs.easy;
});

// Fallback UI methods
const getFallbackCardClasses = (card: GameCard) => {
  const isSelected = gameController.game.selectedCards.value.includes(card.id);
  const isMatched = card.state === "matched";

  return [
    "border-slate-300 dark:border-slate-600",
    {
      "border-blue-500 dark:border-blue-400 shadow-lg": isSelected,
      "border-green-500 dark:border-green-400 opacity-75": isMatched,
      "hover:border-slate-400 dark:hover:border-slate-500":
        !isSelected && !isMatched,
    },
  ];
};

const getFallbackCardFrontClasses = (card: GameCard) => {
  const rarity = card.cs2Item?.rarity || "consumer";
  const rarityColors = {
    consumer: "bg-gradient-to-br from-gray-500 to-gray-700",
    industrial: "bg-gradient-to-br from-blue-500 to-blue-700",
    milSpec: "bg-gradient-to-br from-blue-600 to-blue-800",
    restricted: "bg-gradient-to-br from-purple-500 to-purple-700",
    classified: "bg-gradient-to-br from-pink-500 to-pink-700",
    covert: "bg-gradient-to-br from-red-500 to-red-700",
    contraband: "bg-gradient-to-br from-yellow-500 to-yellow-700",
  };

  return (
    rarityColors[rarity as keyof typeof rarityColors] ||
    rarityColors["consumer"]
  );
};

// Enhanced error handler for better error handling
const handleCanvasError = (error: string) => {
  console.error("Canvas error:", error);
  showFallbackUI.value = true;

  // Show toast with information about switching to fallback
  toast.add({
    severity: "warn",
    summary: "Canvas Unavailable",
    detail:
      "Switched to fallback grid interface. Game functionality is preserved.",
    life: 5000,
  });
};

// Improved retry mechanism
const retryCanvas = async () => {
  showFallbackUI.value = false;

  await nextTick();

  toast.add({
    severity: "info",
    summary: "Retrying Canvas",
    detail: "Attempting to initialize advanced rendering...",
    life: 3000,
  });
};

// Accept fallback method
const acceptFallback = () => {
  toast.add({
    severity: "success",
    summary: "Grid Mode Active",
    detail: "Continuing with optimized grid interface",
    life: 3000,
  });
};

// Initialize on mount
onMounted(async () => {
  await gameController.initializeGame();
});
</script>
