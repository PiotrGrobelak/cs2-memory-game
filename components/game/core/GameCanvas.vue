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
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import { Application, Graphics, Sprite, type Texture } from "pixi.js";
import type { GameCard } from "~/types/game";
import { useTextureLoader } from "~/composables/engine/useTextureLoader";
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
const pixiApp = ref<Application | null>(null);

// Composables & Stores
const { getTexture, preloadCardTextures } = useTextureLoader();
const cardsStore = useGameCardsStore();
const coreStore = useGameCoreStore();

// Methods
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

    // Create PixiJS application - direct implementation like WeaponGrid
    pixiApp.value = new Application();
    await pixiApp.value.init({
      width: props.canvasWidth,
      height: props.canvasHeight,
      backgroundColor: 0x1a1a2e,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
    });

    // Append canvas to container
    canvasContainer.value.appendChild(pixiApp.value.canvas);

    // Render cards directly
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

  try {
    // Clear existing content
    pixiApp.value.stage.removeChildren();

    // Preload all card textures
    await preloadCardTextures(props.cards);

    // Calculate grid layout based on difficulty
    const gridSize = coreStore.difficultySettings.gridSize;
    const cellWidth = props.canvasWidth / gridSize.cols;
    const cellHeight = props.canvasHeight / gridSize.rows;

    const cardWidth = cellWidth * 0.85; // 85% of cell width for padding
    const cardHeight = cellHeight * 0.85; // 85% of cell height for padding

    // Render each card
    props.cards.forEach((card, index) => {
      const row = Math.floor(index / gridSize.cols);
      const col = index % gridSize.cols;

      const position = {
        x: col * cellWidth + cellWidth * 0.5,
        y: row * cellHeight + cellHeight * 0.5,
      };

      // Create card sprite based on state
      if (card.state === "hidden") {
        // Create card back (hidden state)
        const cardBack = new Graphics()
          .roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12)
          .fill({
            color: 0x4f46e5, // Blue color for card back
            alpha: 0.9,
          })
          .stroke({
            color: 0x3730a3, // Darker blue border
            width: 3,
          });

        cardBack.position.set(position.x, position.y);
        cardBack.interactive = props.isInteractive;
        cardBack.cursor = "pointer";

        // Add click handler - call store action
        cardBack.on("click", () => handleCardClick(card.id));
        cardBack.on("tap", () => handleCardClick(card.id));

        // Add hover effects
        if (props.isInteractive) {
          cardBack.on("mouseover", () => {
            cardBack.alpha = 0.7;
          });
          cardBack.on("mouseout", () => {
            cardBack.alpha = 0.9;
          });
        }

        pixiApp.value!.stage.addChild(cardBack);

        // Add question mark indicator
        const questionMark = new Graphics()
          .roundRect(-3, -15, 6, 20, 3)
          .fill(0xffffff)
          .roundRect(-3, 8, 6, 6, 3)
          .fill(0xffffff);

        questionMark.position.set(position.x, position.y);
        pixiApp.value!.stage.addChild(questionMark);
      } else if (card.state === "revealed" || card.state === "matched") {
        // Create card front (revealed/matched state)
        const rarityColor = getRarityColorHex(
          card.cs2Item?.rarity || "consumer"
        );
        const isMatched = card.state === "matched";

        // Create card background
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

        cardFront.position.set(position.x, position.y);
        pixiApp.value!.stage.addChild(cardFront);

        // Create weapon image if available
        if (card.cs2Item?.imageUrl) {
          const texture = getTexture(card.cs2Item.imageUrl) as Texture;
          if (texture) {
            const weaponSprite = new Sprite(texture);

            // Calculate scale to fit within card
            const maxWidth = cardWidth * 0.7;
            const maxHeight = cardHeight * 0.6;
            const scaleX = maxWidth / texture.width;
            const scaleY = maxHeight / texture.height;
            const scale = Math.min(scaleX, scaleY, 1);

            weaponSprite.scale.set(scale);
            weaponSprite.anchor.set(0.5);
            weaponSprite.position.set(position.x, position.y - 5);

            // Add matched effect
            if (isMatched) {
              weaponSprite.alpha = 0.8;
            }

            pixiApp.value!.stage.addChild(weaponSprite);

            // Add glow effect for matched cards
            if (isMatched) {
              const glowRadius =
                Math.max(weaponSprite.width, weaponSprite.height) * 0.4;
              const glowFilter = new Graphics().circle(0, 0, glowRadius).fill({
                color: 0x22c55e, // Green glow for matched
                alpha: 0.15,
              });

              glowFilter.position.set(position.x, position.y - 5);
              pixiApp.value!.stage.addChildAt(
                glowFilter,
                pixiApp.value!.stage.children.length - 1
              );
            }
          }
        }
      }
    });

    console.log(
      `Rendered ${props.cards.length} cards in ${gridSize.rows}x${gridSize.cols} grid`
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
  if (!props.isInteractive) return;

  console.log(`🎯 Card clicked: ${cardId}`);

  // Call store action for game logic
  const success = cardsStore.selectCard(cardId);

  if (success) {
    // Emit for parent component coordination
    emit("card-clicked", cardId);

    // Check for match after selection
    if (cardsStore.selectedCards.length === 2) {
      const isMatch = cardsStore.checkForMatch();

      // Always increment moves count
      coreStore.incrementMoves();

      if (isMatch) {
        // Increment matches in core store
        coreStore.incrementMatches();

        // Check if game is complete (all pairs matched)
        const totalMatched = cardsStore.matchedCards.length / 2; // Each pair = 2 cards
        const totalPairs = coreStore.stats.totalPairs;

        console.log(
          `🎯 Game progress: ${totalMatched}/${totalPairs} pairs matched`
        );

        if (totalMatched >= totalPairs) {
          console.log(`🎉 All pairs matched! Completing game.`);
          coreStore.completeGame();
        }
      }
    }
  }
};

const retryInitialization = async () => {
  await initializePixi();
};

const cleanup = () => {
  if (pixiApp.value) {
    pixiApp.value.destroy(true);
    pixiApp.value = null;
  }
};

// Watch for card changes and re-render
watch(
  () => props.cards,
  async () => {
    if (pixiApp.value && props.cards.length > 0) {
      await renderCards();
    }
  },
  { deep: true }
);

// Watch for game status changes
watch(
  () => props.gameStatus,
  async (newStatus) => {
    if (pixiApp.value && newStatus === "playing") {
      await renderCards();
    }
  }
);

// Lifecycle
onMounted(async () => {
  await nextTick();
  if (props.cards.length > 0) {
    await initializePixi();
  }
});

onUnmounted(() => {
  cleanup();
});

// Expose methods
defineExpose({
  retryInitialization,
  cleanup,
});
</script>

<style scoped>
.game-canvas-container {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.game-canvas-container.loading {
  opacity: 0.8;
}
</style>
