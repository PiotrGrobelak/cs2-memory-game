<template>
  <div
    ref="canvasWrapperRef"
    class="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-lg p-2 md:p-4 shadow-inner min-h-[400px] flex items-center justify-center w-full"
    :data-device="deviceType"
  >
    <ClientOnly>
      <GameCanvas
        v-if="!showFallback && hasCards"
        :cards="cards"
        :canvas-width="canvasDimensions.width"
        :canvas-height="canvasDimensions.height"
        :game-status="gameStatus"
        :is-interactive="gameStatus === 'playing'"
        :selected-cards="selectedCards"
        @card-clicked="$emit('card-clicked', $event)"
        @canvas-ready="$emit('canvas-ready')"
        @canvas-error="$emit('canvas-error')"
        @loading-state-changed="$emit('loading-state-changed', $event)"
      />

      <FallbackCardGrid v-else-if="showFallback" />

      <GameLoadingState v-else-if="isLoading" />

      <GameEmptyState v-else />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import GameCanvas from "./GameCanvas.vue";
import FallbackCardGrid from "./FallbackCardGrid.vue";
import GameLoadingState from "./GameLoadingState.vue";
import GameEmptyState from "./GameEmptyState.vue";
import type { GameCard, DifficultyLevel } from "~/types/game";

type GameStatus = "initializing" | "ready" | "playing" | "paused" | "completed";

interface Props {
  showFallback: boolean;
  isLoading: boolean;
  cards: GameCard[];
  gameStatus: GameStatus;
  selectedCards: GameCard[];
  selectedCardsIds: string[];
  deviceType: string;
  difficulty: DifficultyLevel | null;
}

interface Emits {
  (e: "card-clicked", cardId: string): void;
  (e: "canvas-ready" | "canvas-error"): void;
  (e: "loading-state-changed", loading: boolean): void;
}

const props = defineProps<Props>();

defineEmits<Emits>();

const canvasWrapperRef = ref<HTMLDivElement>();

const hasCards = computed(() => props.cards.length > 0);

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
</script>
