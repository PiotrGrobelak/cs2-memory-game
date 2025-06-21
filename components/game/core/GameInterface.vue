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

    <!-- Unfinished Game Banner -->
    <div v-if="canResumeGame" class="mb-4">
      <div
        class="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 border border-blue-300 dark:border-blue-700 rounded-lg p-4"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <i
              class="pi pi-info-circle text-blue-600 dark:text-blue-400 text-xl"
            ></i>
            <div>
              <h4 class="text-blue-800 dark:text-blue-200 font-semibold mb-1">
                Unfinished Game Found
              </h4>
              <p class="text-blue-700 dark:text-blue-300 text-sm">
                You have a saved game in progress. Click "Resume Game" to
                continue or "Clear Save" to start fresh.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Game Controls -->
    <div class="game-controls mb-6 transition-all duration-200">
      <div class="flex flex-wrap gap-3 justify-center">
        <!-- Resume Button for unfinished games -->
        <Button
          v-if="canResumeGame && gameStatus === 'ready'"
          label="Resume Game"
          icon="pi pi-play-circle"
          severity="success"
          size="large"
          @click="resumeUnfinishedGame"
        />

        <Button
          v-if="gameStatus === 'ready' && !canResumeGame"
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
          v-if="gameStatus === 'paused'"
          label="Resume"
          icon="pi pi-play"
          severity="success"
          size="large"
          @click="resumeGame"
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

        <!-- Clear unfinished game button (only show if there's an unfinished game) -->
        <Button
          v-if="canResumeGame"
          label="Clear Save"
          icon="pi pi-trash"
          severity="danger"
          outlined
          size="small"
          @click="clearUnfinishedGame"
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
          v-if="!state.showFallbackUI && cardsStore.cards.length > 0"
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
        <div v-else-if="state.showFallbackUI" class="w-full max-w-4xl">
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
        <div v-else-if="state.isLoading" class="w-full text-center py-12">
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
      :seed-history="state.seedHistory"
      :seed-validator="seedValidator"
      @close="uiStore.closeDialog('newGame')"
      @start-game="handleNewGameStart"
    />

    <SettingsDialog
      :visible="uiStore.dialogsState.settings"
      :enable-sound="uiStore.uiOptions.enableSound"
      :enable-parallax="uiStore.uiOptions.enableParallax"
      @close="uiStore.closeDialog('settings')"
      @apply="handleSettingsApply"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";

import GameHeader from "../ui/header/GameHeader.vue";
import GameStatusBar from "../ui/status/GameStatusBar.vue";
import GameProgressBar from "../ui/status/GameProgressBar.vue";
import SettingsDialog from "../dialogs/SettingsDialog.vue";
import NewGameDialog from "../dialogs/NewGameDialog.vue";
import GameCanvas from "./GameCanvas.vue";

import type { GameCard } from "~/types/game";
import { useDeviceDetection } from "~/composables/device/useDeviceDetection";
import { useGameController } from "~/composables/core/useGameController";

// Composables
const deviceDetection = useDeviceDetection();

// Game controller - All game logic is now orchestrated here
const gameController = useGameController();

// Destructure everything we need from the controller
const {
  state,
  gameStatus,
  gameProgress,
  canShare,
  canResumeGame,
  difficulties,
  uiStore,
  coreStore,
  cardsStore,
  // timerStore,
  startNewGame,
  pauseGame,
  resumeGame,
  playAgain,
  resumeUnfinishedGame,
  clearUnfinishedGame,
  handleCanvasReady,
  handleCanvasError,
  handleCardClick,
  shareGame,
  handleSettingsApply,
  handleNewGameStart,
  seedValidator,
} = gameController;

// Refs
const canvasWrapperRef = ref<HTMLDivElement>();

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
const handleLoadingStateChanged = (loading: boolean) => {
  console.log("Canvas loading state:", loading);
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

// Initialize on mount
onMounted(async () => {
  // Setup the game controller
  gameController.setupWatchers();
  await gameController.initialize();
});
</script>
