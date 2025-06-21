<template>
  <div class="w-full px-2 py-4 md:px-4">
    <GameHeader
      :can-share="canShare"
      @show-settings="uiStore.openDialog('settings')"
      @share-game="shareGame"
    />

    <GameStatusBar
      :time-elapsed="coreStore.stats.timeElapsed"
      :stats="coreStore.stats"
      :current-score="coreStore.currentScore"
    />

    <GameProgressBar :progress="gameProgress" />

    <UnfinishedGameBanner v-if="canResumeGame" />

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

    <!-- Game Canvas Container -->
    <CanvasContainer
      :show-fallback="state.showFallbackUI"
      :is-loading="state.isLoading"
      :cards="cardsStore.cards"
      :game-status="gameStatus"
      :selected-cards="cardsStore.selectedCardsData"
      :selected-cards-ids="cardsStore.selectedCards"
      :device-type="deviceDetection.deviceType.value"
      :difficulty="coreStore.difficulty"
      @card-clicked="handleCardClick"
      @canvas-ready="handleCanvasReady"
      @canvas-error="handleCanvasError"
      @loading-state-changed="handleLoadingStateChanged"
    />

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
import { onMounted } from "vue";

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

// Initialize on mount
onMounted(async () => {
  // Setup the game controller
  gameController.setupWatchers();
  await gameController.initialize();
});
</script>
