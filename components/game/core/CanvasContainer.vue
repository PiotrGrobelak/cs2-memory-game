<template>
  <div
    ref="canvasWrapperRef"
    class="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-lg shadow-inner h-full w-full flex items-center justify-center min-h-0"
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
        :device-type="responsiveCanvas.deviceInfo.value.type"
        :is-resizing="responsiveCanvas.isResizing.value"
        :is-orientation-loading="responsiveCanvas.isLoading.value"
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
import { useResponsiveCanvas } from "~/composables/engine/useResponsiveCanvas";
import { useAdaptiveGrid } from "~/composables/engine/useAdaptiveGrid";

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
  topComponentsHeight?: number;
}

interface Emits {
  (e: "card-clicked", cardId: string): void;
  (e: "canvas-ready" | "canvas-error"): void;
  (e: "loading-state-changed", loading: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const canvasWrapperRef = useTemplateRef<HTMLDivElement>("canvasWrapperRef");

// Add internal ready state to ensure proper canvas initialization order
const isCanvasInitialized = ref(false);
const isComponentMounted = ref(false);
// Keep isCanvasReady for debugging and emit purposes only
const isCanvasReady = ref(false);

// Responsive canvas system with better space utilization
const responsiveCanvas = useResponsiveCanvas(canvasWrapperRef, {
  minWidth: 480, // Better minimum for desktop layouts
  minHeight: 360, // Better minimum height, maintaining 4:3 aspect
  padding: 20, // Small padding for better visual spacing
  resizeThrottleMs: 100,
  // Don't force aspect ratio - let the grid algorithm handle it
  // aspectRatio: 1.33, // 4:3 aspect ratio (width/height)
  topComponentsHeight: () => props.topComponentsHeight || 0,
});

// Card size configuration for different device types and card counts
const CARD_SIZE_CONFIG = {
  mobile: {
    min: { small: 70, medium: 55, large: 42, xlarge: 35 },
    max: { small: 140, medium: 110, large: 85, xlarge: 70 },
  },
  tablet: {
    min: { small: 80, medium: 60, large: 45, xlarge: 35, xxlarge: 30 },
    max: { small: 160, medium: 120, large: 90, xlarge: 70, xxlarge: 60 },
  },
  desktop: {
    min: { small: 90, medium: 80, large: 70, xlarge: 60 },
    max: { small: 220, medium: 180, large: 140, xlarge: 120 },
  },
} as const;

// Spacing configuration for different scenarios
const SPACING_CONFIG = {
  mobile: { small: 10, medium: 8, large: 6, cards48: 6, xlarge: 4 },
  tablet: { small: 12, medium: 8, large: 6, cards48: 6, xlarge: 4, xxlarge: 3 },
  desktop: { small: 12, medium: 10, large: 8, cards48: 12, xlarge: 8 },
} as const;

// Helper functions to get card sizes and spacing based on device and card count
const getCardSize = (
  deviceType: keyof typeof CARD_SIZE_CONFIG,
  cardCount: number,
  type: "min" | "max"
) => {
  const config = CARD_SIZE_CONFIG[deviceType][type];

  if (cardCount <= 12) return config.small;
  if (cardCount <= 24) return config.medium;
  if (cardCount <= 36) return config.large;
  if (cardCount <= 48) return config.xlarge;
  return "xxlarge" in config ? config.xxlarge : config.xlarge;
};

const getSpacing = (
  deviceType: keyof typeof SPACING_CONFIG,
  cardCount: number
) => {
  const config = SPACING_CONFIG[deviceType];

  if (cardCount <= 12) return config.small;
  if (cardCount <= 24) return config.medium;
  if (cardCount <= 36) return config.large;
  if (cardCount === 48) return config.cards48; // Special case for 48 cards
  if (cardCount <= 48) return config.xlarge;
  return "xxlarge" in config ? config.xxlarge : config.xlarge;
};

// Adaptive grid system that responds to device type changes
const adaptiveGrid = computed(() => {
  const currentDeviceType = responsiveCanvas.deviceInfo.value
    .type as keyof typeof CARD_SIZE_CONFIG;
  const cardCount = props.cards.length;

  return useAdaptiveGrid({
    minCardSize: getCardSize(currentDeviceType, cardCount, "min"),
    maxCardSize: getCardSize(currentDeviceType, cardCount, "max"),
    aspectRatio: 0.75,
    spacing: getSpacing(currentDeviceType, cardCount),
    paddingRatio: 0.015,
  });
});

const hasCards = computed(() => props.cards.length > 0);

// Enhanced canvas dimensions with responsive behavior
const canvasDimensions = computed(() => {
  const dimensions = {
    width: responsiveCanvas.canvasWidth.value,
    height: responsiveCanvas.canvasHeight.value,
  };

  return dimensions;
});

// Simplified canvas showing logic - only check basic conditions
// Canvas will handle its own internal loading states
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

// Ensure component is fully mounted before initializing canvas
onMounted(async () => {
  await nextTick(); // Wait for DOM to be fully updated
  isComponentMounted.value = true;

  if (process.env.NODE_ENV === "development") {
    console.log(
      "✅ CanvasContainer mounted and ready for canvas initialization"
    );
  }
});

// Grid layout information for debugging/optimization
const gridLayout = computed(() => {
  if (!hasCards.value) return null;

  return adaptiveGrid.value.generateCardLayout(
    props.cards,
    canvasDimensions.value.width,
    canvasDimensions.value.height,
    responsiveCanvas.deviceInfo.value.type
  );
});

// Loading state management
const isCanvasLoading = computed(() => {
  return (
    props.isLoading ||
    responsiveCanvas.isLoading.value ||
    responsiveCanvas.isResizing.value ||
    !isCanvasInitialized.value
  );
});

// Handle canvas readiness
const handleCanvasReady = () => {
  isCanvasReady.value = true;
  emit("canvas-ready");
  console.log("✅ Canvas container ready - all dimensions and cards prepared");
};

const handleCanvasError = () => {
  isCanvasReady.value = false;
  emit("canvas-error");
};

// Watch for canvas dimension changes and mark as initialized
watch(
  [
    () => canvasDimensions.value.width,
    () => canvasDimensions.value.height,
    isComponentMounted,
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

// Debug watcher
watch(
  [
    shouldShowCanvas,
    isCanvasLoading,
    () => props.cards.length,
    isComponentMounted,
  ],
  ([showCanvas, loading, cardCount, componentMounted]) => {
    if (process.env.NODE_ENV === "development") {
      console.log("🎯 Canvas State:", {
        shouldShowCanvas: showCanvas,
        isCanvasLoading: loading,
        cardCount,
        dimensions: canvasDimensions.value,
        isCanvasInitialized: isCanvasInitialized.value,
        isComponentMounted: componentMounted,
        isCanvasReady: isCanvasReady.value,
        showFallback: props.showFallback,
        isLoading: props.isLoading,
      });
    }
  },
  { immediate: true }
);

watch(gridLayout, (layout) => {
  if (layout && process.env.NODE_ENV === "development") {
    console.log("🎯 Grid Layout Updated:", {
      dimensions: canvasDimensions.value,
      grid: `${layout.rows}x${layout.cols}`,
      cardSize: layout.cardDimensions,
      deviceType: responsiveCanvas.deviceInfo.value.type,
      shouldShowCanvas: shouldShowCanvas.value,
      canvasInitialized: isCanvasInitialized.value,
      canvasReady: isCanvasReady.value,
    });
  }
});
</script>
