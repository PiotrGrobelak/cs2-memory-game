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
      class="flex flex-row gap-4 md:gap-6 lg:gap-8 justify-between items-start h-24 md:h-auto md:my-2 lg:my-3"
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
      <UnfinishedGameBanner v-show="canResumeGame" />
    </div>

    <!-- Game Canvas Container -->
    <div class="flex-1 min-h-0 w-full flex justify-center">
      <CanvasContainer
        :key="canvasKey"
        :show-fallback="state.showFallbackUI"
        :is-game-loading="state.isLoading"
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
import { onMounted, computed, useTemplateRef, nextTick, ref, watch } from "vue";
import { useElementSize, useDebounceFn, useWindowSize } from "@vueuse/core";

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

const gameHeaderRef = useTemplateRef<HTMLElement>("gameHeaderRef");
const statusBarRowRef = useTemplateRef<HTMLElement>("statusBarRowRef");
const controlButtonsRowRef = useTemplateRef<HTMLElement>(
  "controlButtonsRowRef"
);

const canvasRemountTrigger = ref("");

const { height: headerHeight } = useElementSize(gameHeaderRef);
const { height: statusBarHeight } = useElementSize(statusBarRowRef);
const { height: controlButtonsHeight } = useElementSize(controlButtonsRowRef);
const { width: windowWidth, height: windowHeight } = useWindowSize();

const topComponentsHeight = computed(() => {
  return (
    headerHeight.value + statusBarHeight.value + controlButtonsHeight.value
  );
});

const updateCanvasKey = useDebounceFn(() => {
  canvasRemountTrigger.value = `${Date.now()}-${windowWidth.value}-${windowHeight.value}`;
}, 500);

watch([windowWidth, windowHeight], updateCanvasKey);

const canvasKey = computed(() => {
  return `canvas-${canvasRemountTrigger.value}`;
});

const deviceDetection = useDeviceDetection();

const gameController = useGameController();

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

const enhancedHandleCanvasReady = () => {
  handleCanvasReady();
};

onMounted(async () => {
  gameController.setupWatchers();
  await gameController.initialize();
});
</script>
