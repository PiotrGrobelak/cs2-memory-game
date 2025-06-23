<template>
  <div
    class="w-full p-2 md:px-6 lg:px-8 md:py-6 lg:py-8 h-screen flex flex-col"
  >
    <GameHeader
      :can-share="canShare"
      @show-settings="uiStore.openDialog('settings')"
      @share-game="shareGame"
    />
    <div
      class="flex mobile:flex-col tablet:flex-row portrait:flex-col landscape:flex-row md:portrait:flex-row lg:flex-row gap-2 tablet:gap-4 desktop:gap-6 justify-between items-start tablet:h-auto mb-2"
    >
      <GameStatusBar
        class="w-[50%] portrait:w-full"
        :time-elapsed="coreStore.stats.timeElapsed"
        :stats="coreStore.stats"
        :current-score="coreStore.currentScore"
      />

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
    </div>

    <!-- Game Canvas Container -->
    <div class="flex-1 min-h-0 w-full flex justify-center">
      <CanvasContainer
        :key="gameCanvas.canvasKey.value"
        :show-fallback="state.showFallbackUI"
        :is-game-loading="state.isLoading"
        :cards="cardsStore.cards"
        :game-status="gameStatus"
        @card-clicked="handleCardClick"
        @canvas-ready="gameCanvas.handleCanvasReady"
        @canvas-error="gameCanvas.handleCanvasError"
        @loading-state-changed="gameCanvas.handleLoadingStateChanged"
        @layout-changed="gameCanvas.handleLayoutChanged"
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
      :volume="uiStore.uiOptions.volume"
      @close="uiStore.closeDialog('settings')"
      @apply="handleSettingsApply"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from "vue";
import { useDebounceFn, useWindowSize } from "@vueuse/core";

import GameHeader from "../ui/header/GameHeader.vue";
import GameStatusBar from "../ui/status/GameStatusBar.vue";
import GameControlButtons from "../ui/GameControlButtons.vue";
import CanvasContainer from "./CanvasContainer.vue";
import { useGameController } from "~/composables/core/useGameController";
import { useGameCanvas } from "~/composables/core/useGameCanvas";
import { useGameSounds } from "~/composables/audio/useGameSounds";

const NewGameDialog = defineAsyncComponent(
  () => import("../dialogs/NewGameDialog.vue")
);
const SettingsDialog = defineAsyncComponent(
  () => import("../dialogs/SettingsDialog.vue")
);

const { width: windowWidth, height: windowHeight } = useWindowSize();

const gameCanvas = useGameCanvas();
const gameSounds = useGameSounds();

const updateCanvasKey = useDebounceFn(() => {
  gameCanvas.resetCanvas();
}, 500);

watch([windowWidth, windowHeight], updateCanvasKey);

const gameController = useGameController();

const {
  state,
  gameStatus,
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
  handleCardClick,
  shareGame,
  handleSettingsApply,
  handleNewGameStart,
  seedValidator,
} = gameController;

onMounted(async () => {
  gameController.setupWatchers();
  await gameController.initialize();

  // Initialize game sounds - settings auto-synced via localStorage
  await gameSounds.initializeAudio();
});
</script>
