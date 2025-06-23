<template>
  <div
    ref="canvasContainer"
    class="relative w-full h-full flex items-center justify-center rounded-xl overflow-hidden"
    :class="[{ 'opacity-80': isLoading }]"
  >
    <!-- Loading Overlay -->
    <div
      v-if="isLoading"
      class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10"
    >
      <div class="text-white text-center">
        <i class="pi pi-spin pi-spinner text-4xl mb-4" />
        <p>Loading game board...</p>
      </div>
    </div>

    <!-- Error Overlay -->
    <div
      v-if="error"
      class="absolute inset-0 bg-red-500 bg-opacity-20 flex items-center justify-center z-10"
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

    <!-- Responsive Canvas Loading Overlay -->
    <div
      v-if="props.isResizing || props.isOrientationLoading"
      class="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center z-20 backdrop-blur-sm"
    >
      <div class="text-white text-center">
        <i class="pi pi-spin pi-spinner text-3xl mb-2" />
        <p class="text-sm font-medium">
          {{
            props.isResizing
              ? "Redrawing board..."
              : props.isOrientationLoading
                ? "Adjusting to orientation..."
                : "Loading..."
          }}
        </p>
      </div>
    </div>

    <!-- Canvas will be inserted here by PixiJS -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import {
  Application,
  Graphics,
  Sprite,
  Container,
  type Texture,
} from "pixi.js";
import type { GameCard } from "~/types/game";
import { useTextureLoader } from "~/composables/engine/useTextureLoader";
import { useParallaxEffect } from "~/composables/engine/useParallaxEffect";
import { useAdaptiveGrid } from "~/composables/engine/useAdaptiveGrid";
import { useGameCardsStore } from "~/stores/game/cards";
import { useGameCoreStore } from "~/stores/game/core";

// Props
interface Props {
  cards: GameCard[];
  canvasWidth: number;
  canvasHeight: number;
  gameStatus:
    | "ready"
    | "playing"
    | "paused"
    | "completed"
    | "initializing"
    | "error";
  isInteractive: boolean;
  selectedCards: GameCard[];
  deviceType?: "mobile" | "tablet" | "desktop";
  isResizing?: boolean;
  isOrientationLoading?: boolean;
}

interface Emits {
  (e: "card-clicked", cardId: string): void;
  (e: "canvas-error", error?: string): void;
  (e: "canvas-ready"): void;
  (e: "loading-state-changed", isLoading: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Refs
const canvasContainer = ref<HTMLDivElement>();
const isLoading = ref(false);
const error = ref<string | null>(null);
const pixiApp = shallowRef<Application | null>(null);
const cardSprites = shallowRef<Map<string, Container>>(new Map());
const cardCleanupFunctions = shallowRef<Map<string, () => void>>(new Map());

const { getTexture, preloadCardTextures } = useTextureLoader();
const parallaxEffect = useParallaxEffect();

const adaptiveGrid = computed(() => {
  return useAdaptiveGrid({
    aspectRatio: 0.75,
    spacing: 8,
    paddingRatio: 0.02,
  });
});

const cardsStore = useGameCardsStore();
const coreStore = useGameCoreStore();

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

const initializePixi = async () => {
  if (!canvasContainer.value) return;

  try {
    isLoading.value = true;
    emit("loading-state-changed", true);
    error.value = null;

    const devicePixelRatio = window.devicePixelRatio || 1;

    pixiApp.value = new Application();
    await pixiApp.value.init({
      width: props.canvasWidth,
      height: props.canvasHeight,
      backgroundAlpha: 0,
      antialias: true,
      resolution: devicePixelRatio,
    });

    canvasContainer.value.appendChild(pixiApp.value.canvas);

    pixiApp.value.canvas.style.width = `${props.canvasWidth}px`;
    pixiApp.value.canvas.style.height = `${props.canvasHeight}px`;

    parallaxEffect.initializeParallax();

    await renderCards();

    emit("canvas-ready");
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Failed to initialize canvas";
    error.value = errorMessage;
    emit("canvas-error", errorMessage);
    console.error("Pixi initialization error:", err);
  } finally {
    isLoading.value = false;
    emit("loading-state-changed", false);
  }
};

const renderCards = async () => {
  if (!pixiApp.value || props.cards.length === 0) return;

  if (props.canvasWidth <= 0 || props.canvasHeight <= 0) {
    console.warn("⚠️ Cannot render cards with invalid canvas dimensions:", {
      width: props.canvasWidth,
      height: props.canvasHeight,
    });
    return;
  }

  try {
    pixiApp.value.stage.removeChildren();
    cleanupCardListeners();
    cardSprites.value.clear();

    await preloadCardTextures(props.cards);

    const gridLayout = adaptiveGrid.value.generateCardLayout(
      props.cards,
      props.canvasWidth,
      props.canvasHeight,
      props.deviceType || "desktop"
    );

    props.cards.forEach((card, index) => {
      const cardPosition = gridLayout.positions[index];
      if (!cardPosition) return;

      const position = {
        x: cardPosition.x,
        y: cardPosition.y,
      };

      const cardContainer = new Container();
      cardContainer.position.set(position.x, position.y);

      const cardWidth = gridLayout.cardDimensions.width;
      const cardHeight = gridLayout.cardDimensions.height;

      if (card.state === "hidden") {
        const cardElements = createHiddenCard(card, cardWidth, cardHeight);
        cardElements.forEach((element) => cardContainer.addChild(element));
      } else if (card.state === "revealed" || card.state === "matched") {
        const cardElements = createRevealedCard(card, cardWidth, cardHeight);
        cardElements.forEach((element) => cardContainer.addChild(element));
      }

      pixiApp.value!.stage.addChild(cardContainer);
      cardSprites.value.set(card.id, cardContainer);

      const parallaxDepth = 0.4 + Math.random() * 0.3;
      parallaxEffect.addParallaxTarget(card.id, cardContainer, parallaxDepth);

      const cleanupFn = parallaxEffect.setupCardEventListeners(
        card.id,
        cardContainer
      );
      if (cleanupFn) {
        cardCleanupFunctions.value.set(card.id, cleanupFn);
      }
    });

    console.log(
      `🎯 Rendered ${props.cards.length} cards in ${gridLayout.rows}x${gridLayout.cols} adaptive grid with individual parallax effects`
    );
  } catch (err) {
    console.error("Error rendering cards:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Failed to render cards";
    error.value = errorMessage;
    emit("canvas-error", errorMessage);
  }
};

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
    cardBack.on("mouseover", () => {
      cardBack.alpha = 0.7;
    });
    cardBack.on("mouseout", () => {
      cardBack.alpha = 0.9;
    });
  }

  elements.push(cardBack);

  const questionMark = new Graphics()
    .roundRect(-3, -15, 6, 20, 3)
    .fill(0xffffff)
    .roundRect(-3, 8, 6, 6, 3)
    .fill(0xffffff);

  elements.push(questionMark);

  return elements;
};

const createRevealedCard = (
  card: GameCard,
  cardWidth: number,
  cardHeight: number
): Container[] => {
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

  if (card.cs2Item?.imageUrl) {
    const texture = getTexture(card.cs2Item.imageUrl) as Texture;
    if (texture) {
      const weaponSprite = new Sprite(texture);

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

      if (isMatched) {
        const glowRadius =
          Math.max(weaponSprite.width, weaponSprite.height) * 0.4;
        const glowFilter = new Graphics().circle(0, 0, glowRadius).fill({
          color: 0x22c55e, // Green glow for matched
          alpha: 0.15,
        });

        glowFilter.position.set(0, -5);
        elements.unshift(glowFilter);
      }
    }
  }

  return elements;
};

const handleCardClick = (cardId: string) => {
  if (!props.isInteractive || props.isResizing || props.isOrientationLoading)
    return;

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

const cleanupCardListeners = () => {
  cardCleanupFunctions.value.forEach((cleanupFn) => {
    cleanupFn();
  });
  cardCleanupFunctions.value.clear();
};

const retryInitialization = async () => {
  await initializePixi();
};

const cleanup = () => {
  cleanupCardListeners();

  parallaxEffect.cleanup();

  if (pixiApp.value) {
    pixiApp.value.destroy(true);
    pixiApp.value = null;
  }

  cardSprites.value.clear();
};

watch(
  () => props.cards,
  async () => {
    if (pixiApp.value && props.cards.length > 0) {
      await renderCards();
    }
  },
  { deep: true }
);

watch(
  () => props.gameStatus,
  async (newStatus) => {
    if (pixiApp.value && newStatus === "playing") {
      await renderCards();
    }
  }
);

watch(
  () => [props.canvasWidth, props.canvasHeight, props.deviceType],
  async () => {
    if (pixiApp.value && pixiApp.value.renderer && props.cards.length > 0) {
      console.log("🔄 Canvas dimensions changed, re-rendering cards...");

      if (props.canvasWidth <= 0 || props.canvasHeight <= 0) {
        console.warn("⚠️ Invalid canvas dimensions, skipping render");
        return;
      }

      pixiApp.value.renderer.resize(props.canvasWidth, props.canvasHeight);

      await nextTick();

      await renderCards();
    }
  },
  { deep: true }
);

watch(
  () => props.deviceType,
  async (newDeviceType, oldDeviceType) => {
    if (newDeviceType !== oldDeviceType && pixiApp.value) {
      console.log(
        `📱 Device type changed from ${oldDeviceType} to ${newDeviceType} - re-rendering cards`
      );
      await renderCards();
    }
  }
);

onMounted(async () => {
  await initializePixi();
});

onUnmounted(() => {
  cleanup();
});

defineExpose({
  retryInitialization,
  cleanup,
});
</script>
