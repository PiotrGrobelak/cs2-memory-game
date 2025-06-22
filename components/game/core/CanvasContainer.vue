<template>
  <div
    ref="canvasContainerRef"
    class="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-lg shadow-inner h-full w-full xl:w-1/2 flex items-center justify-center min-h-0"
    :data-device="deviceType"
    data-size="canvas-container"
  >
    <ClientOnly>
      <GameCanvas
        v-if="shouldShowCanvas"
        :cards="cards"
        :canvas-width="canvasDimensions.width"
        :canvas-height="canvasDimensions.height"
        :game-status="gameStatus"
        :is-interactive="gameStatus === 'playing'"
        :selected-cards="selectedCards"
        :device-type="deviceInfo.type"
        :is-resizing="isResizing"
        :is-orientation-loading="isLoading"
        @card-clicked="$emit('card-clicked', $event)"
        @canvas-ready="handleCanvasReady"
        @canvas-error="handleCanvasError"
        @loading-state-changed="$emit('loading-state-changed', $event)"
      />

      <FallbackCardGrid v-else-if="showFallback" />

      <GameLoadingState v-else-if="isCanvasLoading" />

      <GameEmptyState v-else />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, useTemplateRef, onMounted, nextTick } from "vue";
import GameCanvas from "./GameCanvas.vue";
import FallbackCardGrid from "./FallbackCardGrid.vue";
import GameLoadingState from "./GameLoadingState.vue";
import GameEmptyState from "./GameEmptyState.vue";
import type { GameCard, DifficultyLevel } from "~/types/game";
import { useResponsiveCanvas } from "~/composables/engine/useResponsiveCanvas/useResponsiveCanvas";

type GameStatus = "initializing" | "ready" | "playing" | "paused" | "completed";

interface Props {
  showFallback: boolean;
  isGameLoading: boolean;
  cards: GameCard[];
  gameStatus: GameStatus;
  selectedCards: GameCard[];
  selectedCardsIds: string[];
  deviceType: string;
  difficulty: DifficultyLevel | null;
  topComponentsHeight: number;
}

interface Emits {
  (e: "card-clicked", cardId: string): void;
  (e: "canvas-ready" | "canvas-error"): void;
  (e: "loading-state-changed", loading: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const canvasContainerRef = useTemplateRef<HTMLDivElement>("canvasContainerRef");

const isCanvasInitialized = ref(false);
const isComponentMounted = ref(false);
const isCanvasReady = ref(false);

const {
  isResizing,
  isLoading,
  canvasWidth,
  canvasHeight,
  deviceInfo,
  topComponentsHeight: topHeight,
  containerHeight,
  containerWidth,
} = useResponsiveCanvas({
  minWidth: 480,
  minHeight: 360,
  padding: 20,
  resizeThrottleMs: 100,
});

const hasCards = computed(() => props.cards.length > 0);

const canvasDimensions = computed(() => {
  const dimensions = {
    width: canvasWidth.value,
    height: canvasHeight.value,
  };

  return dimensions;
});

const shouldShowCanvas = computed(() => {
  const hasValidDimensions =
    canvasDimensions.value.width > 0 && canvasDimensions.value.height > 0;

  return (
    !props.showFallback &&
    hasCards.value &&
    hasValidDimensions &&
    isCanvasInitialized.value &&
    isComponentMounted.value
  );
});

onMounted(async () => {
  await nextTick();
  isComponentMounted.value = true;
});

const isCanvasLoading = computed(() => {
  return (
    props.isGameLoading ||
    isLoading.value ||
    isResizing.value ||
    !isCanvasInitialized.value
  );
});

const handleCanvasReady = () => {
  isCanvasReady.value = true;
  emit("canvas-ready");
};

const handleCanvasError = () => {
  isCanvasReady.value = false;
  emit("canvas-error");
};

watch(
  canvasContainerRef,
  () => {
    const { width, height } = useElementSize(canvasContainerRef);

    containerHeight.value = height.value;
    containerWidth.value = width.value;

    console.log("🔧 containerHeight one:", containerHeight.value);
    console.log("🔧 containerWidth  one:", containerWidth.value);
  },
  { once: true }
);

// Watch for canvas dimension changes and mark as initialized
watch(
  [
    () => canvasDimensions.value.width,
    () => canvasDimensions.value.height,
    isComponentMounted,
    () => props.topComponentsHeight,
  ],
  async () => {
    const hasValidDimensions =
      canvasDimensions.value.width > 0 && canvasDimensions.value.height > 0;

    if (hasValidDimensions && isComponentMounted.value) {
      // Additional nextTick to ensure all reactive updates are processed
      await nextTick();
      isCanvasInitialized.value = true;

      if (process.env.NODE_ENV === "development") {
        console.log("🎯 Canvas dimensions ready:", {
          width: canvasDimensions.value.width,
          height: canvasDimensions.value.height,
          componentMounted: isComponentMounted.value,
          canvasInitialized: isCanvasInitialized.value,
        });
      }
    } else {
      isCanvasInitialized.value = false;
      isCanvasReady.value = false;
    }
  },
  { immediate: true }
);

// Watch for cards changes - let canvas handle its own ready state
watch(
  () => props.cards.length,
  () => {
    if (props.cards.length === 0) {
      // Only reset when cards are cleared
      isCanvasReady.value = false;
    }
  }
);

// Emit loading state changes
watch(
  isCanvasLoading,
  (loading) => {
    emit("loading-state-changed", loading);
  },
  { immediate: true }
);

watch(
  () => props.topComponentsHeight,
  (newHeight) => {
    topHeight.value = newHeight;
  },
  { immediate: true }
);
</script>
