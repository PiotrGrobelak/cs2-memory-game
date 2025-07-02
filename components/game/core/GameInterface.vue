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

    <!-- Game Canvas Area - simplified -->
    <div ref="gameAreaRef" class="flex-1 min-h-0 w-full flex justify-center">
      <div
        class="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-lg shadow-inner h-full w-full flex items-center justify-center min-h-0"
        data-size="canvas-container"
      >
        <ClientOnly>
          <!-- Resize overlay -->
          <ResizeOverlay
            v-if="isResizing && !isCanvasLoading"
            :is-visible="true"
          />

          <GameCanvas
            v-else-if="shouldShowCanvas"
            :key="canvasKey"
            :cards="cardsStore.cards"
            :game-status="gameStatus"
            :container-width="gameAreaWidth"
            :container-height="gameAreaHeight"
            @card-clicked="handleCardClick"
            @canvas-ready="onCanvasReady"
            @canvas-error="onCanvasError"
          />

          <GameLoadingState v-else-if="isCanvasLoading" />
          <FallbackCardGrid v-else-if="state.showFallbackUI" />
          <GameEmptyState v-else />
        </ClientOnly>
      </div>
    </div>

    <!-- Dialogs -->
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
import { ref, computed, watch, onMounted, nextTick, useTemplateRef } from "vue";
import { useElementSize, useDebounceFn } from "@vueuse/core";
import { useGameController } from "~/composables/core/useGameController";
import { useGameSounds } from "~/composables/audio/useGameSounds";

// Components
import GameHeader from "../ui/header/GameHeader.vue";
import GameStatusBar from "../ui/status/GameStatusBar.vue";
import GameControlButtons from "../ui/GameControlButtons.vue";
import GameCanvas from "./GameCanvas.vue";
import FallbackCardGrid from "./FallbackCardGrid.vue";
import GameLoadingState from "./GameLoadingState.vue";
import GameEmptyState from "./GameEmptyState.vue";

const ResizeOverlay = defineAsyncComponent(
  () => import("../ui/overlays/ResizeOverlay.vue")
);

const NewGameDialog = defineAsyncComponent(
  () => import("../dialogs/NewGameDialog.vue")
);
const SettingsDialog = defineAsyncComponent(
  () => import("../dialogs/SettingsDialog.vue")
);

// Canvas management - moved from CanvasContainer
const gameAreaRef = useTemplateRef<HTMLDivElement>("gameAreaRef");
const isCanvasReady = ref(false);
const isComponentMounted = ref(false);
const isResizing = ref(false);

const { width: gameAreaWidth, height: gameAreaHeight } =
  useElementSize(gameAreaRef);

// Game controller
const gameController = useGameController();
const gameSounds = useGameSounds();

const {
  state,
  gameStatus,
  canShare,
  canResumeGame,
  difficulties,
  uiStore,
  coreStore,
  cardsStore,
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
  canvasKey,
  resetCanvas,
} = gameController;

// Canvas state logic - moved from CanvasContainer
const hasCards = computed(() => cardsStore.cards.length > 0);
const isCanvasLoading = computed(
  () => state.value.isLoading || !isComponentMounted.value
);

const shouldShowCanvas = computed(() => {
  return (
    !state.value.showFallbackUI && hasCards.value && isComponentMounted.value
  );
});

// Canvas event handlers - simplified names
const onCanvasReady = () => {
  isCanvasReady.value = true;
  state.value.showFallbackUI = false;
};

const onCanvasError = (error?: string) => {
  isCanvasReady.value = false;
  state.value.showFallbackUI = true;
};

// Canvas recreation - moved from CanvasContainer
const recreateCanvas = useDebounceFn(() => {
  resetCanvas();
  isCanvasReady.value = false;
  isResizing.value = false;
}, 300);

// Watchers
watch(
  () => cardsStore.cards.length,
  () => {
    if (cardsStore.cards.length === 0) {
      isCanvasReady.value = false;
    }
  }
);

watch([gameAreaWidth, gameAreaHeight], (newSize, oldSize) => {
  if (oldSize && (newSize[0] !== oldSize[0] || newSize[1] !== oldSize[1])) {
    isResizing.value = true;
    recreateCanvas();
  }
});

onMounted(async () => {
  await nextTick();
  isComponentMounted.value = true;

  gameController.setupWatchers();
  await gameController.initialize();
  await gameSounds.initializeAudio();
});
</script>
