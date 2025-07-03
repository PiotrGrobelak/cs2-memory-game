<template>
  <div
    ref="canvasContainer"
    class="relative w-full h-full flex items-center justify-center rounded-xl overflow-hidden"
    :class="[{ 'opacity-80': isLoading }]"
  >
    <!-- Overlays -->
    <LoadingOverlay :is-visible="isLoading" />
    <ErrorOverlay :error="error" @retry="retry" />

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
  onMounted,
  onUnmounted,
  watch,
  computed,
  shallowRef,
  nextTick,
  defineAsyncComponent,
} from "vue";
import { Application, type Container } from "pixi.js";
import type { GameCard, GameStatus } from "~/types/game";
import { useDeviceDetection, useEngineCore } from "~/composables/engine";
import { useTextureLoader } from "~/composables/engine/canvas/useTextureLoader";
import { useParallaxEffect } from "~/composables/engine/canvas/useParallaxEffect";
import { useCardRenderer } from "~/composables/engine/canvas/useCardRenderer";

const LoadingOverlay = defineAsyncComponent(
  () => import("~/components/game/ui/overlays/LoadingOverlay.vue")
);
const ErrorOverlay = defineAsyncComponent(
  () => import("~/components/game/ui/overlays/ErrorOverlay.vue")
);
const DebugOverlay = defineAsyncComponent({
  loader: () => import("~/components/game/ui/overlays/DebugOverlay.vue"),
  loadingComponent: { template: "<div></div>" },
  delay: 500,
});

interface Props {
  cards: GameCard[];
  gameStatus: GameStatus;
  containerWidth: number;
  containerHeight: number;
}

interface Emits {
  (e: "card-clicked", cardId: string): void;
  (e: "canvas-error", error?: string): void;
  (e: "canvas-ready"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const isDev = computed(() => import.meta.env.DEV);

const canvasContainer = shallowRef<HTMLDivElement>();
const error = ref<string | null>(null);
const cardSprites = shallowRef<Map<string, Container>>(new Map());
const cardCleanupFunctions = shallowRef<Map<string, () => void>>(new Map());
const isInitialized = ref(false);
const pixiApp = shallowRef<Application | null>(null);

const devicePixelRatio = computed(() => window.devicePixelRatio || 1);
const resolution = computed(() => Math.min(devicePixelRatio.value, 3));

const {
  deviceType,
  deviceOrientation,
  deviceCapabilities,
  isMobile,
  isTouchDevice,
} = useDeviceDetection({
  containerWidth: props.containerWidth,
  containerHeight: props.containerHeight,
});

const engine = useEngineCore({
  enableAutoResize: true,
  resizeThrottleMs: 150,
  backgroundAlpha: 0,
  minWidth: 320,
  minHeight: 240,
  padding: 20,
  maintainAspectRatio: true,
  containerWidth: props.containerWidth,
  containerHeight: props.containerHeight,
  deviceCapabilities: deviceCapabilities.value,
  deviceType: deviceType.value,
  deviceOrientation: deviceOrientation.value,
  isMobile: isMobile.value,
  isTouchDevice: isTouchDevice.value,
});

const {
  containerDimensions,
  updateCanvasDimensions,
  initializeFromElement,
  initializePixiApp,
  isLoading,
  currentLayout,
  renderCards: engineRenderCards,
  getCardsContainer,
} = engine;

const canvasWidth = computed(() => containerDimensions.value.width);
const canvasHeight = computed(() => containerDimensions.value.height);
const isOrientationChanging = computed(() => false);
const isReady = computed(() => !!pixiApp.value);
const isInteractive = computed(() => props.gameStatus === "playing");

const { getTexture, preloadCardTextures } = useTextureLoader();
const parallaxEffect = useParallaxEffect({
  deviceType: deviceType.value,
  isTouchDevice: isTouchDevice.value,
});
const { createCardContainer: createCard } = useCardRenderer(getTexture, {
  deviceType: deviceType.value,
  deviceCapabilities: deviceCapabilities.value,
});

const createPixiApp = async (): Promise<Application> => {
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
    width: width * resolution.value,
    height: height * resolution.value,
    backgroundAlpha: 0,
    antialias: true,
    resolution: resolution.value,
    autoDensity: true,
    resizeTo: canvasContainer.value,
  });

  canvasContainer.value.appendChild(app.canvas);
  pixiApp.value = app;

  return app;
};

const init = async () => {
  if (
    !canvasContainer.value ||
    !props.containerWidth ||
    !props.containerHeight
  ) {
    return;
  }

  try {
    error.value = null;

    updateCanvasDimensions(props.containerWidth, props.containerHeight);
    initializeFromElement(canvasContainer.value);

    const app = await createPixiApp();

    initializePixiApp(app);

    parallaxEffect.initializeParallax();

    await renderCards();

    isInitialized.value = true;
    emit("canvas-ready");
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Failed to initialize canvas";
    error.value = errorMessage;
    emit("canvas-error", errorMessage);
    console.error("Canvas initialization error:", err);
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

    const layout = engineRenderCards(props.cards);

    if (!layout) return;

    await Promise.all(
      props.cards.map(async (card, index) => {
        const cardPosition = layout.positions[index];
        if (!cardPosition) return;

        const cardContainer = await createCard(
          card,
          cardPosition,
          layout.cardDimensions.width,
          layout.cardDimensions.height,
          isInteractive.value,
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
  } catch (err) {
    console.error("Error rendering cards:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Failed to render cards";
    error.value = errorMessage;
    emit("canvas-error", errorMessage);
  }
};

const handleCardClick = (cardId: string) => {
  if (!isInteractive.value || isOrientationChanging.value) {
    return;
  }
  emit("card-clicked", cardId);
};

const retry = async () => {
  error.value = null;
  await init();
};

const cleanupCardListeners = () => {
  cardCleanupFunctions.value.forEach((cleanup) => cleanup());
  cardCleanupFunctions.value.clear();
};

const cleanup = () => {
  cleanupCardListeners();
  engine.destroy();
  isInitialized.value = false;
};

onMounted(async () => {
  await nextTick();
  await init();
});

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
