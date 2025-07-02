<template>
  <div
    v-if="isVisible && currentLayout"
    class="absolute top-2 left-2 bg-black bg-opacity-80 text-white text-xs p-2 rounded z-40 opacity-50"
  >
    <div>Device: {{ deviceType }} {{ deviceOrientation }}</div>
    <div>Canvas: {{ canvasWidth }}×{{ canvasHeight }}px</div>
    <div>Grid: {{ currentLayout.cols }}×{{ currentLayout.rows }}</div>
    <div>
      Card: {{ currentLayout.cardDimensions.width }}×{{
        currentLayout.cardDimensions.height
      }}px
    </div>
    <div>Efficiency: {{ Math.round(currentLayout.efficiency * 100) }}%</div>
    <div>Cards: {{ cardCount }}</div>
  </div>
</template>

<script setup lang="ts">
import type { GridLayout } from "~/composables/engine/layout/useLayoutStrategies";

interface Props {
  isVisible: boolean;
  currentLayout: GridLayout | null;
  strategyName?: string;
  deviceType: string;
  deviceOrientation: string;
  canvasWidth: number;
  canvasHeight: number;
  cardCount: number;
}

defineProps<Props>();
</script>
