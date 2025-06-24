<template>
  <div
    ref="canvasContainerRef"
    class="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-lg shadow-inner h-full w-full flex items-center justify-center min-h-0"
    data-size="canvas-container"
  >
    <ClientOnly>
      <GameCanvas
        v-if="shouldShowCanvas"
        :key="canvasKey"
        :cards="cards"
        :game-status="gameStatus"
        :is-interactive="gameStatus === 'playing'"
        :container-width="canvasContainerWidth"
        :container-height="canvasContainerHeight"
        :is-resizing="isResizing"
        @card-clicked="$emit('card-clicked', $event)"
        @canvas-ready="handleCanvasReady"
        @canvas-error="handleCanvasError"
        @loading-state-changed="$emit('loading-state-changed', $event)"
        @layout-changed="$emit('layout-changed', $event)"
      />

      <GameLoadingState v-else-if="isCanvasLoading" />

      <FallbackCardGrid v-else-if="showFallback" />

      <GameEmptyState v-else />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, useTemplateRef, onMounted, nextTick } from "vue";
import { useElementSize, useDebounceFn } from "@vueuse/core";
import GameCanvas from "./GameCanvas.vue";
import FallbackCardGrid from "./FallbackCardGrid.vue";
import GameLoadingState from "./GameLoadingState.vue";
import GameEmptyState from "./GameEmptyState.vue";
import type { GameCard, GameStatus } from "~/types/game";
import type { GridLayout } from "~/composables/engine/layout/adaptiveGridLayout";
import { useDeviceDetection } from "~/composables/engine/device";

interface Props {
  showFallback: boolean;
  isGameLoading: boolean;
  cards: GameCard[];
  gameStatus: GameStatus;
}

interface Emits {
  (e: "card-clicked", cardId: string): void;
  (e: "canvas-ready" | "canvas-error"): void;
  (e: "loading-state-changed", loading: boolean): void;
  (e: "layout-changed", layout: GridLayout): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { windowSize } = useDeviceDetection();

const canvasContainerRef = useTemplateRef<HTMLDivElement>("canvasContainerRef");

const isComponentMounted = ref(false);
const isCanvasReady = ref(false);
const canvasKey = ref(`canvas-${Date.now()}`);
const isResizing = ref(false);

const hasCards = computed(() => props.cards.length > 0);

const { height: canvasContainerHeight, width: canvasContainerWidth } =
  useElementSize(canvasContainerRef);

const shouldShowCanvas = computed(() => {
  return !props.showFallback && hasCards.value && isComponentMounted.value;
});

onMounted(async () => {
  await nextTick();
  isComponentMounted.value = true;
});

const isCanvasLoading = computed(() => {
  return props.isGameLoading || !isComponentMounted.value;
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
  () => props.cards.length,
  () => {
    if (props.cards.length === 0) {
      isCanvasReady.value = false;
    }
  }
);

watch(
  isCanvasLoading,
  (loading) => {
    emit("loading-state-changed", loading);
  },
  { immediate: true }
);

// Watch for size changes and recreate canvas when resizing stops
const recreateCanvasOnResize = useDebounceFn(() => {
  canvasKey.value = `canvas-${Date.now()}`;
  isCanvasReady.value = false;
  isResizing.value = false;
}, 300);

watch([canvasContainerWidth, canvasContainerHeight], (newSize, oldSize) => {
  if (oldSize && (newSize[0] !== oldSize[0] || newSize[1] !== oldSize[1])) {
    isResizing.value = true;
    recreateCanvasOnResize();
  }
});
</script>
