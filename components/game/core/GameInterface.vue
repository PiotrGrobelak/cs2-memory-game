<template>
  <div
    class="w-full px-2 py-4 md:px-6 lg:px-8 md:py-6 lg:py-8 h-screen flex flex-col"
  >
    <GameHeader
      ref="gameHeaderRef"
      :can-share="canShare"
      @show-settings="uiStore.openDialog('settings')"
      @share-game="shareGame"
    />
    <div
      ref="statusBarRowRef"
      class="flex flex-row gap-4 md:gap-6 lg:gap-8 justify-between items-center md:my-2 lg:my-3"
    >
      <GameStatusBar
        :time-elapsed="coreStore.stats.timeElapsed"
        :stats="coreStore.stats"
        :current-score="coreStore.currentScore"
      />
      <GameProgressBar :progress="gameProgress" />
    </div>

    <div
      ref="controlButtonsRowRef"
      class="flex flex-row gap-4 md:gap-6 lg:gap-8 justify-between items-start h-24 md:h-28 lg:h-32 md:my-2 lg:my-3"
    >
      <GameControlButtons
        :can-resume-game="canResumeGame"
        :game-status="gameStatus"
        @resume-unfinished-game="resumeUnfinishedGame"
        @start-new-game="() => startNewGame()"
        @pause-game="pauseGame"
        @resume-game="resumeGame"
        @play-again="playAgain"
        @show-new-game-dialog="uiStore.openDialog('newGame')"
        @clear-unfinished-game="clearUnfinishedGame"
      />
      <UnfinishedGameBanner v-if="canResumeGame" />
    </div>

    <!-- Game Canvas Container -->
    <div class="flex-1 min-h-0">
      <CanvasContainer
        :show-fallback="state.showFallbackUI"
        :is-loading="state.isLoading"
        :cards="cardsStore.cards"
        :game-status="gameStatus"
        :selected-cards="cardsStore.selectedCardsData"
        :selected-cards-ids="cardsStore.selectedCards"
        :device-type="deviceDetection.deviceType.value"
        :difficulty="coreStore.difficulty"
        :top-components-height="topComponentsHeight"
        @card-clicked="handleCardClick"
        @canvas-ready="enhancedHandleCanvasReady"
        @canvas-error="handleCanvasError"
        @loading-state-changed="handleLoadingStateChanged"
      />
    </div>

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
import { onMounted, watch, unref, computed, useTemplateRef } from "vue";
import { useElementSize } from "@vueuse/core";

import GameHeader from "../ui/header/GameHeader.vue";
import GameStatusBar from "../ui/status/GameStatusBar.vue";
import GameProgressBar from "../ui/status/GameProgressBar.vue";
import UnfinishedGameBanner from "../ui/UnfinishedGameBanner.vue";
import GameControlButtons from "../ui/GameControlButtons.vue";
import SettingsDialog from "../dialogs/SettingsDialog.vue";
import NewGameDialog from "../dialogs/NewGameDialog.vue";
import CanvasContainer from "./CanvasContainer.vue";

import { useDeviceDetection } from "~/composables/device/useDeviceDetection";
import { useGameController } from "~/composables/core/useGameController";

// Template refs for measuring component heights
const gameHeaderRef = useTemplateRef<HTMLElement>("gameHeaderRef");
const statusBarRowRef = useTemplateRef<HTMLElement>("statusBarRowRef");
const controlButtonsRowRef = useTemplateRef<HTMLElement>(
  "controlButtonsRowRef"
);

// Use VueUse to track component heights
const { height: headerHeight } = useElementSize(gameHeaderRef);
const { height: statusBarHeight } = useElementSize(statusBarRowRef);
const { height: controlButtonsHeight } = useElementSize(controlButtonsRowRef);

// Calculate total height of components above canvas
const topComponentsHeight = computed(() => {
  const total =
    headerHeight.value + statusBarHeight.value + controlButtonsHeight.value;

  if (process.env.NODE_ENV === "development") {
    console.log("📏 Top Components Heights:", {
      header: headerHeight.value,
      statusBar: statusBarHeight.value,
      controlButtons: controlButtonsHeight.value,
      total: total,
    });
  }

  return total;
});

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

// Canvas event handlers
const handleLoadingStateChanged = (loading: boolean) => {
  console.log("Canvas loading state:", loading);
};

// Enhanced canvas ready handler for resumed games
const enhancedHandleCanvasReady = () => {
  console.log("🎯 Canvas ready - ensuring proper rendering for resumed game");
  handleCanvasReady();
};

// Initialize on mount
onMounted(async () => {
  // Setup the game controller
  gameController.setupWatchers();
  await gameController.initialize();
});

// Debug: Watch game state in GameInterface
if (process.env.NODE_ENV === "development") {
  watch(
    [() => cardsStore.cards.length, gameStatus, canResumeGame],
    ([cardCount, status, canResume]) => {
      console.log("🎯 GameInterface - State:", {
        cardCount,
        gameStatus: unref(status),
        canResumeGame: unref(canResume),
        hasUnfinishedGame: state.value.hasUnfinishedGame,
        isLoading: state.value.isLoading,
      });
    },
    { immediate: true }
  );
}
</script>
