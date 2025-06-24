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
import { Application, type Container } from "pixi.js";
import type { GameCard, GameStatus } from "~/types/game";
import { useEngineCore } from "~/composables/engine";
import { useTextureLoader } from "~/composables/engine/canvas/useTextureLoader";
import { useParallaxEffect } from "~/composables/engine/canvas/useParallaxEffect";
import { useCardRenderer } from "~/composables/engine/canvas/useCardRenderer";
import type { GridLayout } from "~/composables/engine/layout/adaptiveGridLayout";

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
const pixiApp = shallowRef<Application | null>(null);

// Initialize engine for device detection and state management
const baseEngine = useEngineCore({
  enableAutoResize: true,
  resizeThrottleMs: 150,
  backgroundAlpha: 0,
  minWidth: 320,
  minHeight: 240,
  padding: 20,
  maintainAspectRatio: true,
});

// Engine with pixi app (will be set after initialization)
let renderEngine: ReturnType<typeof useEngineCore> | null = null;

// Extract properties from base engine
const {
  deviceType,
  deviceOrientation,
  containerDimensions,
  updateCanvasDimensions,
  initializeFromElement,
  isLoading,
  isResizing,
  currentLayout,
} = baseEngine;

// Computed properties for backward compatibility
const canvasWidth = computed(() => containerDimensions.value.width);
const canvasHeight = computed(() => containerDimensions.value.height);
const isOrientationChanging = computed(() => false);
const isReady = computed(() => !!pixiApp.value && !!renderEngine);

const { getTexture, preloadCardTextures } = useTextureLoader();
const parallaxEffect = useParallaxEffect();
const { createCardContainer: createCard } = useCardRenderer(getTexture);

const initializeCanvas = async () => {
  if (!canvasContainer.value || !props.containerWidth || !props.containerHeight)
    return;

  try {
    error.value = null;
    emit("loading-state-changed", true);

    // Update canvas dimensions using the base engine
    updateCanvasDimensions(props.containerWidth, props.containerHeight);
    initializeFromElement(canvasContainer.value);

    const app = await initializePixiApp();

    // Create render engine with pixi app
    renderEngine = useEngineCore(
      {
        enableAutoResize: true,
        resizeThrottleMs: 150,
        backgroundAlpha: 0,
        minWidth: 320,
        minHeight: 240,
        padding: 20,
        maintainAspectRatio: true,
      },
      app
    );

    // Update render engine with current container dimensions
    renderEngine.updateCanvasDimensions(
      props.containerWidth,
      props.containerHeight
    );
    renderEngine.initializeFromElement(canvasContainer.value);

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

const initializePixiApp = async (): Promise<Application> => {
  if (!canvasContainer.value) {
    throw new Error("Canvas container not available");
  }

  const { width, height } = containerDimensions.value;

  if (width === 0 || height === 0) {
    throw new Error(
      "Container dimensions not available. Please ensure the container has proper width and height."
    );
  }

  const app = new Application();

  await app.init({
    width,
    height,
    backgroundAlpha: 0,
    antialias: true,
    resolution: 1,
    resizeTo: canvasContainer.value,
  });

  canvasContainer.value.appendChild(app.canvas);
  pixiApp.value = app;

  return app;
};

const renderCards = async () => {
  if (!isReady.value || props.cards.length === 0 || !renderEngine) return;

  try {
    const cardsContainer = renderEngine.getCardsContainer();
    if (!cardsContainer) return;

    cleanupCardListeners();
    cardsContainer.removeChildren();
    cardSprites.value.clear();

    await preloadCardTextures(props.cards);

    const layout = renderEngine.renderCards(props.cards);
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

          const parallaxDepth = 0.4 + Math.random() * 0.3;
          parallaxEffect.addParallaxTarget(
            card.id,
            cardContainer,
            parallaxDepth
          );

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
        deviceType: deviceType.value,
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
  baseEngine.destroy();
  if (renderEngine) {
    renderEngine.destroy();
  }
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
