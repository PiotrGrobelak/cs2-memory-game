<template>
  <div
    ref="canvasContainerRef"
    class="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-lg shadow-inner h-full w-full flex items-center justify-center min-h-0"
    :data-device="deviceType"
    data-size="canvas-container"
  >
    <ClientOnly>
      <GameCanvas
        v-if="shouldShowCanvas"
        :cards="cards"
        :game-status="gameStatus"
        :is-interactive="gameStatus === 'playing'"
        :selected-cards="selectedCards"
        :container-width="canvasContainerWidth"
        :container-height="canvasContainerHeight"
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
import { useElementSize } from "@vueuse/core";
import GameCanvas from "./GameCanvas.vue";
import FallbackCardGrid from "./FallbackCardGrid.vue";
import GameLoadingState from "./GameLoadingState.vue";
import GameEmptyState from "./GameEmptyState.vue";
import type { GameCard, DifficultyLevel, GameStatus } from "~/types/game";
import type { GridLayout } from "~/composables/engine/useAdaptiveGridLayout";

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
  (e: "layout-changed", layout: GridLayout): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const canvasContainerRef = useTemplateRef<HTMLDivElement>("canvasContainerRef");

const isComponentMounted = ref(false);
const isCanvasReady = ref(false);

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
</script>
