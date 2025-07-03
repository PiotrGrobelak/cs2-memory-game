<template>
  <div
    v-if="isVisible && currentLayout"
    class="absolute top-2 left-2 bg-black bg-opacity-90 text-white text-xs p-3 rounded-lg z-40 font-mono border border-gray-600"
    style="backdrop-filter: blur(4px)"
  >
    <!-- Basic Info -->
    <div class="space-y-1">
      <div>Device: {{ deviceType }} {{ deviceOrientation }}</div>
      <div>Canvas: {{ canvasWidth }}×{{ canvasHeight }}px</div>
      <div>
        Aspect:
        {{
          canvasWidth && canvasHeight
            ? (canvasWidth / canvasHeight).toFixed(2)
            : "0"
        }}
      </div>
    </div>

    <!-- Grid Layout -->
    <div class="mt-2 pt-2 border-t border-gray-600 space-y-1">
      <div>Grid: {{ currentLayout.cols }}×{{ currentLayout.rows }}</div>
      <div>
        Card: {{ currentLayout.cardDimensions.width }}×{{
          currentLayout.cardDimensions.height
        }}px
      </div>
      <div class="flex justify-between">
        <span>Efficiency:</span>
        <span
          :class="
            currentLayout && currentLayout.efficiency >= 0.8
              ? 'text-green-400'
              : currentLayout && currentLayout.efficiency >= 0.6
                ? 'text-yellow-400'
                : 'text-red-400'
          "
          >{{ Math.round(currentLayout.efficiency * 100) }}%</span
        >
      </div>
      <div>
        Cards: {{ cardCount }}/{{
          currentLayout ? currentLayout.cols * currentLayout.rows : 0
        }}
      </div>
    </div>

    <!-- Toggle hint -->
    <div class="mt-2 pt-2 border-t border-gray-600 text-xs text-gray-400">
      Press 'D' to toggle
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GridLayout } from "~/composables/engine/layout/useOrientationGrid";

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
