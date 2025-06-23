<template>
  <div
    ref="canvasContainer"
    class="relative w-full h-full flex items-center justify-center rounded-xl overflow-hidden"
    :class="[{ 'opacity-80': isLoading || isResizing }]"
  >
    <!-- Loading Overlay -->
    <div
      v-if="isLoading"
      class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10"
    >
      <div class="text-white text-center">
        <i class="pi pi-spin pi-spinner text-4xl mb-4" />
        <p>Initializing optimized canvas...</p>
      </div>
    </div>

    <!-- Resize Overlay -->
    <div
      v-if="isResizing && !isLoading"
      class="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center z-20 backdrop-blur-sm"
    >
      <div class="text-white text-center">
        <i class="pi pi-spin pi-spinner text-3xl mb-2" />
        <p class="text-sm font-medium">Optimizing layout...</p>
      </div>
    </div>

    <!-- Orientation Change Overlay -->
    <div
      v-if="isOrientationChanging"
      class="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center z-25 backdrop-blur-sm"
    >
      <div class="text-white text-center">
        <i class="pi pi-refresh text-3xl mb-2" />
        <p class="text-sm font-medium">Adjusting to orientation...</p>
      </div>
    </div>

    <!-- Error Overlay -->
    <div
      v-if="error"
      class="absolute inset-0 bg-red-500 bg-opacity-20 flex items-center justify-center z-30"
    >
      <div class="text-red-800 text-center bg-white p-4 rounded-lg">
        <i class="pi pi-exclamation-triangle text-2xl mb-2" />
        <p>{{ error }}</p>
        <button
          class="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          @click="retryInitialization"
        >
          Retry
        </button>
      </div>
    </div>

    <!-- Dev Debug Info -->
    <div
      v-if="isDev && currentLayout"
      class="absolute top-2 left-2 bg-black bg-opacity-80 text-white text-xs p-2 rounded z-40 opacity-64"
    >
      <div>Strategy: {{ getCurrentStrategy?.name || "Unknown" }}</div>
      <div>Device: {{ deviceType }} {{ deviceOrientation }}</div>
      <div>Canvas: {{ canvasWidth }}×{{ canvasHeight }}px</div>
      <div>Grid: {{ currentLayout.cols }}×{{ currentLayout.rows }}</div>
      <div>
        Card: {{ currentLayout.cardDimensions.width }}×{{
          currentLayout.cardDimensions.height
        }}px
      </div>
      <div>Efficiency: {{ Math.round(currentLayout.efficiency * 100) }}%</div>
      <div>Cards: {{ cards.length }}</div>
    </div>

    <!-- Canvas will be inserted here by Pixi.js -->
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, watch, computed, shallowRef, nextTick } from "vue";
import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import type { GameCard, GameStatus } from "~/types/game";
import { usePixiResponsiveCanvas } from "~/composables/engine/usePixiResponsiveCanvas/usePixiResponsiveCanvas";
import { useTextureLoader } from "~/composables/engine/useTextureLoader";
import { useParallaxEffect } from "~/composables/engine/useParallaxEffect";
import type { GridLayout } from "~/composables/engine/useAdaptiveGridLayout";
import { useGameCardsStore } from "~/stores/game/cards";
import { useGameCoreStore } from "~/stores/game/core";

interface Props {
  cards: GameCard[];
  gameStatus: GameStatus;
  isInteractive: boolean;
  selectedCards: GameCard[];
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

// Refs
const canvasContainer = shallowRef<HTMLDivElement>();
const error = ref<string | null>(null);
const cardSprites = shallowRef<Map<string, Container>>(new Map());
const cardCleanupFunctions = shallowRef<Map<string, () => void>>(new Map());
const isInitialized = ref(false);

// Initialize responsive Pixi canvas with container dimensions
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
  enableAutoResize: true, // Use Pixi's built-in responsive features
  resizeThrottleMs: 150,
  backgroundAlpha: 0,
  minWidth: 320,
  minHeight: 240,
});

// Texture loader and parallax effect
const { getTexture, preloadCardTextures } = useTextureLoader();
const parallaxEffect = useParallaxEffect();

// Store instances
const cardsStore = useGameCardsStore();
const coreStore = useGameCoreStore();

watch(
  () => [props.containerWidth, props.containerHeight],
  () => {
    console.log("🔍 containerWidth", props.containerWidth);
    console.log("🔍 containerHeight", props.containerHeight);

    if (props.containerWidth && props.containerHeight) {
      canvasHeight.value = props.containerHeight;
      canvasWidth.value = props.containerWidth;

      // Also initialize container dimensions to ensure adaptive grid is updated
      initializeContainerDimensions();
    }
  },
  { immediate: true }
);

// Card rendering utilities
const getRarityColorHex = (rarity: string): number => {
  const colors: Record<string, number> = {
    consumer: 0xb0c3d9,
    industrial: 0x5e98d9,
    milSpec: 0x4b69ff,
    restricted: 0x8847ff,
    classified: 0xd32ce6,
    covert: 0xeb4b4b,
    contraband: 0xe4ae39,
  };
  return colors[rarity] || colors.consumer;
};

// Initialize Pixi application
const initializeCanvas = async () => {
  if (!canvasContainer.value) return;

  try {
    error.value = null;
    emit("loading-state-changed", true);

    // Initialize Pixi app with responsive features
    const app = await initializePixiApp();

    // Initialize parallax effect
    parallaxEffect.initializeParallax();

    // Render initial cards
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

// Render cards with optimized approach
const renderCards = async () => {
  if (!isReady.value || props.cards.length === 0) return;

  try {
    const cardsContainer = getCardsContainer();
    if (!cardsContainer) return;

    // Clear previous cards
    cleanupCardListeners();
    cardsContainer.removeChildren();
    cardSprites.value.clear();

    // Preload textures
    await preloadCardTextures(props.cards);

    // Update grid layout using Pixi's responsive system
    const layout = updateGrid(props.cards);
    if (!layout) return;

    // Emit layout change
    emit("layout-changed", layout);

    // Render each card
    await Promise.all(
      props.cards.map(async (card, index) => {
        const cardPosition = layout.positions[index];
        if (!cardPosition) return;

        const cardContainer = await createCardContainer(
          card,
          cardPosition,
          layout
        );
        if (cardContainer) {
          cardsContainer.addChild(cardContainer);
          cardSprites.value.set(card.id, cardContainer);
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

// Create optimized card container
const createCardContainer = async (
  card: GameCard,
  position: { x: number; y: number },
  layout: GridLayout
): Promise<Container | null> => {
  try {
    const cardContainer = new Container();
    cardContainer.position.set(position.x, position.y);

    const { width: cardWidth, height: cardHeight } = layout.cardDimensions;

    // Create card elements based on state
    if (card.state === "hidden") {
      const elements = createHiddenCard(card, cardWidth, cardHeight);
      elements.forEach((element) => cardContainer.addChild(element));
    } else if (card.state === "revealed" || card.state === "matched") {
      const elements = await createRevealedCard(card, cardWidth, cardHeight);
      elements.forEach((element) => cardContainer.addChild(element));
    }

    // Setup parallax effect
    const parallaxDepth = 0.4 + Math.random() * 0.3;
    parallaxEffect.addParallaxTarget(card.id, cardContainer, parallaxDepth);

    // Setup event listeners
    const cleanupFn = parallaxEffect.setupCardEventListeners(
      card.id,
      cardContainer
    );
    if (cleanupFn) {
      cardCleanupFunctions.value.set(card.id, cleanupFn);
    }

    return cardContainer;
  } catch (err) {
    console.error(`Error creating card container for ${card.id}:`, err);
    return null;
  }
};

// Create hidden card elements
const createHiddenCard = (
  card: GameCard,
  cardWidth: number,
  cardHeight: number
): Container[] => {
  const elements: Container[] = [];

  const cardBack = new Graphics()
    .roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12)
    .fill({
      color: 0x4f46e5,
      alpha: 0.9,
    })
    .stroke({
      color: 0x3730a3,
      width: 3,
    });

  cardBack.interactive = props.isInteractive;
  cardBack.cursor = "pointer";

  cardBack.on("click", () => handleCardClick(card.id));
  cardBack.on("tap", () => handleCardClick(card.id));

  if (props.isInteractive) {
    cardBack.on("pointerover", () => {
      cardBack.alpha = 0.7;
    });
    cardBack.on("pointerout", () => {
      cardBack.alpha = 0.9;
    });
    cardBack.on("pointerdown", () => {
      cardBack.alpha = 0.6;
    });
    cardBack.on("pointerup", () => {
      cardBack.alpha = 0.7;
    });
  }

  elements.push(cardBack);

  // Question mark indicator
  const questionMark = new Graphics()
    .roundRect(-3, -15, 6, 20, 3)
    .fill(0xffffff)
    .roundRect(-3, 8, 6, 6, 3)
    .fill(0xffffff);

  elements.push(questionMark);

  return elements;
};

// Create revealed card elements
const createRevealedCard = async (
  card: GameCard,
  cardWidth: number,
  cardHeight: number
): Promise<Container[]> => {
  const elements: Container[] = [];

  const rarityColor = getRarityColorHex(card.cs2Item?.rarity || "consumer");
  const isMatched = card.state === "matched";

  const cardFront = new Graphics()
    .roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12)
    .fill({
      color: rarityColor,
      alpha: isMatched ? 0.25 : 0.15,
    })
    .stroke({
      color: rarityColor,
      width: isMatched ? 4 : 2,
    });

  elements.push(cardFront);

  // Add weapon image if available
  if (card.cs2Item?.imageUrl) {
    try {
      const texture = (await getTexture(card.cs2Item.imageUrl)) as Texture;
      if (texture && texture.width && texture.height) {
        const weaponSprite = new Sprite(texture);

        // Scale sprite to fit card like in original
        const maxWidth = cardWidth * 0.7;
        const maxHeight = cardHeight * 0.6;
        const scaleX = maxWidth / texture.width;
        const scaleY = maxHeight / texture.height;
        const scale = Math.min(scaleX, scaleY, 1);

        weaponSprite.scale.set(scale);
        weaponSprite.anchor.set(0.5);
        weaponSprite.position.set(0, -5);

        if (isMatched) {
          weaponSprite.alpha = 0.8;
        }

        elements.push(weaponSprite);

        // Add glow effect for matched cards
        if (isMatched) {
          const glowRadius =
            Math.max(weaponSprite.width, weaponSprite.height) * 0.4;
          const glowFilter = new Graphics().circle(0, 0, glowRadius).fill({
            color: 0x22c55e, // Green glow for matched
            alpha: 0.15,
          });

          glowFilter.position.set(0, -5);
          elements.unshift(glowFilter); // Add glow behind the sprite
        }
      }
    } catch (err) {
      console.warn(`Failed to load texture for card ${card.id}:`, err);
    }
  }

  return elements;
};

// Event handlers
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

  const success = cardsStore.selectCard(cardId);

  if (success) {
    emit("card-clicked", cardId);

    if (cardsStore.selectedCards.length === 2) {
      const isMatch = cardsStore.checkForMatch();

      coreStore.incrementMoves();

      if (isMatch) {
        coreStore.incrementMatches();

        const totalMatched = cardsStore.matchedCards.length / 2;
        const totalPairs = coreStore.stats.totalPairs;

        if (totalMatched >= totalPairs) {
          coreStore.completeGame();
        }
      }
    }
  }
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

watchEffect(async () => {
  if (props.containerWidth && props.containerHeight) {
    await nextTick();
    await initializeCanvas();
  }
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

<style scoped>
/* Optional: Add any specific styling if needed */
</style>
