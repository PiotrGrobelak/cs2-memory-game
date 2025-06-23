<template>
  <div
    ref="canvasContainer"
    class="relative w-full h-full flex items-center justify-center rounded-xl overflow-hidden"
    :class="[{ 'opacity-80': isLoading || isResizing }]"
  >
    <!-- Overlays -->
    <LoadingOverlay :is-visible="isLoading" />

    <ResizeOverlay :is-visible="isResizing && !isLoading" />

    <ResizeOverlay
      :is-visible="isOrientationChanging"
      message="Adjusting to orientation..."
    />

    <ErrorOverlay :error="error" @retry="retryInitialization" />

    <DebugOverlay
      :is-visible="isDev"
      :current-layout="currentLayout"
      :strategy-name="getCurrentStrategy?.name"
      :device-type="deviceType"
      :device-orientation="deviceOrientation"
      :canvas-width="canvasWidth"
      :canvas-height="canvasHeight"
      :card-count="cards.length"
    />

    <!-- Canvas will be inserted here by Pixi.js -->
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  onUnmounted,
  watch,
  computed,
  shallowRef,
  nextTick,
  defineAsyncComponent,
} from "vue";
import type { Container } from "pixi.js";
import type { GameCard, GameStatus } from "~/types/game";
import { usePixiResponsiveCanvas } from "~/composables/engine/usePixiResponsiveCanvas/usePixiResponsiveCanvas";
import { useTextureLoader } from "~/composables/engine/useTextureLoader";
import { useParallaxEffect } from "~/composables/engine/useParallaxEffect";
import { useCardRenderer } from "~/composables/engine/useCardRenderer";
import type { GridLayout } from "~/composables/engine/useAdaptiveGridLayout";

// Lazy-loaded overlay components for better performance
const LoadingOverlay = defineAsyncComponent(
  () => import("~/components/game/ui/overlays/LoadingOverlay.vue")
);
const ResizeOverlay = defineAsyncComponent(
  () => import("~/components/game/ui/overlays/ResizeOverlay.vue")
);
const ErrorOverlay = defineAsyncComponent(
  () => import("~/components/game/ui/overlays/ErrorOverlay.vue")
);
const DebugOverlay = defineAsyncComponent({
  loader: () => import("~/components/game/ui/overlays/DebugOverlay.vue"),
  loadingComponent: { template: "<div></div>" },
  delay: 200,
});

interface Props {
  cards: GameCard[];
  gameStatus: GameStatus;
  isInteractive: boolean;
  containerWidth: number;
  containerHeight: number;
}

interface Emits {
  (e: "card-clicked", cardId: string): void;
  (e: "canvas-error", error?: string): void;
  (e: "canvas-ready"): void;
  (e: "loading-state-changed", isLoading: boolean): void;
  (e: "layout-changed", layout: GridLayout): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Development mode check
const isDev = computed(() => process.env.NODE_ENV === "development");

const canvasContainer = shallowRef<HTMLDivElement>();
const error = ref<string | null>(null);
const cardSprites = shallowRef<Map<string, Container>>(new Map());
const cardCleanupFunctions = shallowRef<Map<string, () => void>>(new Map());
const isInitialized = ref(false);

const {
  initializePixiApp,
  renderCards: updateGrid,
  getCardsContainer,
  destroy: destroyPixi,
  containerWidth: canvasWidth,
  containerHeight: canvasHeight,
  initializeContainerDimensions,
  isReady,
  deviceType,
  deviceOrientation,
  isResizing,
  isLoading,
  isOrientationChanging,
  currentLayout,
  getCurrentStrategy,
} = usePixiResponsiveCanvas(canvasContainer, {
  enableAutoResize: true,
  resizeThrottleMs: 150,
  backgroundAlpha: 0,
  minWidth: 320,
  minHeight: 240,
});

const { getTexture, preloadCardTextures } = useTextureLoader();
const parallaxEffect = useParallaxEffect();
const { createCardContainer: createCard } = useCardRenderer(getTexture);

const initializeCanvas = async () => {
  if (!canvasContainer.value || !props.containerWidth || !props.containerHeight)
    return;

  try {
    error.value = null;
    emit("loading-state-changed", true);

    canvasHeight.value = props.containerHeight;
    canvasWidth.value = props.containerWidth;
    initializeContainerDimensions();

    await initializePixiApp();

    parallaxEffect.initializeParallax();

    await renderCards();

    isInitialized.value = true;
    emit("canvas-ready");

    if (isDev.value) {
      console.log("🚀 Optimized Pixi Canvas initialized successfully");
    }
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Failed to initialize canvas";
    error.value = errorMessage;
    emit("canvas-error", errorMessage);
    console.error("Canvas initialization error:", err);
  } finally {
    emit("loading-state-changed", false);
  }
};

const renderCards = async () => {
  if (!isReady.value || props.cards.length === 0) return;

  try {
    const cardsContainer = getCardsContainer();
    if (!cardsContainer) return;

    cleanupCardListeners();
    cardsContainer.removeChildren();
    cardSprites.value.clear();

    await preloadCardTextures(props.cards);

    const layout = updateGrid(props.cards);
    if (!layout) return;

    emit("layout-changed", layout);

    await Promise.all(
      props.cards.map(async (card, index) => {
        const cardPosition = layout.positions[index];
        if (!cardPosition) return;

        const cardContainer = await createCard(
          card,
          cardPosition,
          layout.cardDimensions.width,
          layout.cardDimensions.height,
          props.isInteractive,
          handleCardClick
        );
        if (cardContainer) {
          cardsContainer.addChild(cardContainer);
          cardSprites.value.set(card.id, cardContainer);

          // Setup parallax effect
          const parallaxDepth = 0.4 + Math.random() * 0.3;
          parallaxEffect.addParallaxTarget(
            card.id,
            cardContainer,
            parallaxDepth
          );

          // Setup event listeners
          const cleanupFn = parallaxEffect.setupCardEventListeners(
            card.id,
            cardContainer
          );
          if (cleanupFn) {
            cardCleanupFunctions.value.set(card.id, cleanupFn);
          }
        }
      })
    );

    if (isDev.value) {
      console.log("🎯 Optimized card rendering completed:", {
        cardCount: props.cards.length,
        layoutStrategy: getCurrentStrategy.value?.name,
        efficiency: Math.round(layout.efficiency * 100) + "%",
      });
    }
  } catch (err) {
    console.error("Error rendering cards:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Failed to render cards";
    error.value = errorMessage;
    emit("canvas-error", errorMessage);
  }
};

const handleCardClick = (cardId: string) => {
  if (
    !props.isInteractive ||
    props.gameStatus !== "playing" ||
    isResizing.value ||
    isOrientationChanging.value
  ) {
    return;
  }

  console.log(`🎯 Card clicked: ${cardId}`);
  emit("card-clicked", cardId);
};

const retryInitialization = async () => {
  error.value = null;
  await initializeCanvas();
};

const cleanupCardListeners = () => {
  cardCleanupFunctions.value.forEach((cleanup) => cleanup());
  cardCleanupFunctions.value.clear();
};

const cleanup = () => {
  cleanupCardListeners();
  destroyPixi();
  isInitialized.value = false;
};

watch(
  () => [props.containerWidth, props.containerHeight],
  async () => {
    await nextTick();
    await initializeCanvas();
  },
  { immediate: true }
);

watch(
  () => props.cards,
  async () => {
    if (isInitialized.value && isReady.value) {
      await renderCards();
    }
  },
  { deep: true }
);

onUnmounted(() => {
  cleanup();
});
</script>
