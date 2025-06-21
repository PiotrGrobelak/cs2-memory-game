<template>
  <div
    ref="canvasContainer"
    class="game-canvas-container relative w-full h-full"
    :class="{ loading: isLoading }"
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

    <!-- Canvas will be inserted here by PixiJS -->
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  onMounted,
  onUnmounted,
  watch,
  nextTick,
  onBeforeUnmount,
} from "vue";
import type { GameCard } from "~/types/game";
import { useGameEngine } from "~/composables/engine/useGameEngine";
import { useCardRenderer } from "~/composables/engine/useCardRenderer";
import { useLayoutEngine } from "~/composables/engine/useLayoutEngine";
import { useGameInteractions } from "~/composables/engine/useGameInteractions";

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
}

interface Emits {
  (e: "card-clicked", cardId: string): void;
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  (e: "canvas-error", error: string): void;
  (e: "canvas-ready"): void;
  (e: "loading-state-changed", isLoading: boolean): void;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<Emits>();

// Refs
const canvasContainer = ref<HTMLDivElement>();
const isLoading = ref(false);
const error = ref<string | null>(null);

// Composables
const gameEngine = useGameEngine();
const cardRenderer = useCardRenderer();
const layoutEngine = useLayoutEngine();
const gameInteractions = useGameInteractions();

// Initialization
const initializeCanvas = async () => {
  if (!canvasContainer.value) return;

  try {
    isLoading.value = true;
    emit("loading-state-changed", true);
    error.value = null;

    // Initialize PixiJS engine
    const game = await gameEngine.initializeEngine({
      width: props.canvasWidth,
      height: props.canvasHeight,
      backgroundColor: 0x1a1a1a,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      powerPreference: "high-performance",
    });

    // Append canvas to container
    canvasContainer.value.appendChild(game.app.canvas);

    // Setup cards
    await setupCards();

    // Setup interactions
    setupInteractions();

    emit("canvas-ready");
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    error.value = errorMessage;
    emit("canvas-error", errorMessage);
  } finally {
    isLoading.value = false;
    emit("loading-state-changed", false);
  }
};

const setupCards = async () => {
  if (!gameEngine.pixiApp.value) return;

  // Clear any existing sprites and stop animations first
  cardRenderer.stopAllAnimations();

  // Clear the card container to remove old sprites
  if (gameEngine.pixiApp.value.cardContainer.children.length > 0) {
    gameEngine.pixiApp.value.cardContainer.removeChildren();
  }

  // Clear sprites from renderer cache
  cardRenderer.clearAllSprites();

  previousCardsStates.value.clear();

  // Calculate card positions
  const difficulty =
    props.cards.length <= 12
      ? "easy"
      : props.cards.length <= 24
        ? "medium"
        : "hard";

  const positions = layoutEngine.calculateCardPositions(
    props.cards,
    props.canvasWidth,
    props.canvasHeight,
    difficulty
  );

  // Create card sprites concurrently using Promise.all
  const spritePromises = props.cards.map(async (card, i) => {
    const position = positions[i];
    const sprite = await cardRenderer.createCard(card, position);
    return { sprite, card };
  });

  const spriteResults = await Promise.all(spritePromises);

  // Add sprites to container and setup interactions
  if (gameEngine.pixiApp.value) {
    spriteResults.forEach(({ sprite }) => {
      gameEngine.pixiApp.value!.cardContainer.addChild(sprite);
      gameInteractions.setupCardInteraction(sprite, handleCardClick);
    });

    // Initialize card interactions with current card states
    // gameInteractions.updateCards(props.cards);
  }
};

const setupInteractions = () => {
  if (!gameEngine.pixiApp.value) return;

  const canvas = gameEngine.pixiApp.value.app.canvas;

  // Mouse interactions
  canvas.addEventListener("mousemove", (event) => {
    gameInteractions.handleMouseMove(event, canvas, handleParallaxUpdate);
  });

  // Touch interactions
  canvas.addEventListener("touchmove", (event) => {
    gameInteractions.handleTouchMove(event, canvas, handleParallaxUpdate);
  });
};

const handleCardClick = (cardId: string) => {
  emit("card-clicked", cardId);
};

const handleParallaxUpdate = (x: number, y: number) => {
  // Apply parallax effect to all cards
  props.cards.forEach((card) => {
    cardRenderer.applyParallaxEffect(
      card.id,
      x,
      y,
      props.canvasWidth,
      props.canvasHeight
    );
  });
};

const retryInitialization = () => {
  error.value = null;
  nextTick(() => {
    initializeCanvas();
  });
};

const previousCardsStates = ref<Map<string, GameCard["state"]>>(new Map());

// Watchers
watch(
  () => props.cards,
  (newCards) => {
    // Update card states when cards change
    newCards.forEach((card) => {
      const previousState = previousCardsStates.value.get(card.id);
      if (previousState !== card.state) {
        cardRenderer.updateCardState(card.id, card.state);
      }
    });
    previousCardsStates.value = new Map(
      newCards.map((card) => [card.id, card.state])
    );

    // Update card interactivity based on game state
    gameInteractions.updateCards(newCards);
  },
  { deep: true }
);

watch(
  () => props.isInteractive,
  (interactive) => {
    console.log("🔄 GameCanvas: Setting interactive state to", interactive);
    gameInteractions.setInteractive(interactive);
  }
);

watch([() => props.canvasWidth, () => props.canvasHeight], () => {
  // Resize canvas when dimensions change
  if (gameEngine.pixiApp.value) {
    gameEngine.pixiApp.value.app.renderer.resize(
      props.canvasWidth,
      props.canvasHeight
    );
    setupCards(); // Recalculate card positions
  }
});

// Lifecycle
onMounted(() => {
  nextTick(() => {
    initializeCanvas();
  });
});

onBeforeUnmount(() => {
  console.log("🧹 GameCanvas: Starting cleanup before unmount");
  // Stop all animations before destroying the engine
  cardRenderer.stopAllAnimations();

  // Clear sprite references from interactions
  gameInteractions.clearSprites();

  // Give a small delay to ensure animations are stopped
  nextTick(() => {
    cardRenderer.clearAllSprites();
    gameEngine.destroyEngine();
  });
});

onUnmounted(() => {
  console.log("🧹 GameCanvas: Component unmounted");
});
</script>

<style scoped>
.game-canvas-container {
  min-height: 400px;
}

.game-canvas-container.loading {
  pointer-events: none;
}

.game-canvas-container canvas {
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
</style>
