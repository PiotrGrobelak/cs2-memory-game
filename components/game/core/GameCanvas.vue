<template>
  <div ref="containerRef" class="game-canvas-container">
    <canvas
      ref="canvasElement"
      :width="canvasSize.width"
      :height="canvasSize.height"
      class="game-canvas"
      @click="handleCanvasClick"
      @mousemove="handleMouseMove"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd"
    />
    <div v-if="!isInitialized" class="canvas-loading">Initializing game...</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, useTemplateRef, onMounted, onUnmounted } from "vue";
import { useGameEngine } from "~/composables/engine/useGameEngine";
import { useCanvasLayout } from "~/composables/engine/useCanvasLayout";
import { useGameCoreStore } from "~/stores/game/core";
import { useGameCardsStore } from "~/stores/game/cards";
import { useGameSync } from "~/composables/sync/useGameSync";
import type { CanvasRenderer } from "~/services/CanvasRenderer";

// Props
interface Props {
  enableParallax?: boolean;
  enableSound?: boolean;
  debugMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  enableParallax: true,
  enableSound: true,
  debugMode: false,
});

// Template refs
const canvasElement = useTemplateRef<HTMLCanvasElement>("canvasElement");
const containerRef = useTemplateRef<HTMLDivElement>("containerRef");

// Composables and stores
const gameEngine = useGameEngine();
const canvasLayout = useCanvasLayout();
const gameStore = useGameCoreStore();
const cardsStore = useGameCardsStore();
const gameSync = useGameSync(gameEngine);

// State
const isInitialized = ref(false);
const canvasRenderer = ref<CanvasRenderer | null>(null);

// Computed properties
const canvasSize = computed(() => canvasLayout.canvasSize.value);

// Event handlers - simplified direct implementation
function handleCanvasClick(event: MouseEvent) {
  if (!isInitialized.value || !canvasElement.value) return;

  const rect = canvasElement.value.getBoundingClientRect();
  const scaleX = canvasElement.value.width / rect.width;
  const scaleY = canvasElement.value.height / rect.height;

  const canvasX = (event.clientX - rect.left) * scaleX;
  const canvasY = (event.clientY - rect.top) * scaleY;

  // Find clicked card and handle selection
  const clickedCardId = gameEngine.getCardAtPosition(canvasX, canvasY);
  if (clickedCardId) {
    handleCardClick(clickedCardId);
  }
}

function handleMouseMove(event: MouseEvent) {
  if (!props.enableParallax || !canvasElement.value) return;

  const rect = canvasElement.value.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  const normalizedCoords = {
    x: (event.clientX - rect.left - centerX) / centerX,
    y: (event.clientY - rect.top - centerY) / centerY,
  };

  gameEngine.setParallaxOffset(normalizedCoords);
}

function handleTouchStart(event: TouchEvent) {
  event.preventDefault();
  if (event.touches.length === 1) {
    const touch = event.touches[0];
    const mouseEvent = new MouseEvent("click", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    handleCanvasClick(mouseEvent);
  }
}

function handleTouchEnd(event: TouchEvent) {
  event.preventDefault();
}

function handleCardClick(cardId: string) {
  if (!gameStore.isPlaying) {
    gameStore.startGame();
  }

  const success = cardsStore.selectCard(cardId);
  if (success) {
    gameStore.incrementMoves();

    // Check for match after a brief delay to allow animation
    setTimeout(() => {
      const isMatch = cardsStore.checkForMatch();
      if (isMatch) {
        gameStore.incrementMatches();

        // Check if game is complete
        if (cardsStore.matchedCards.length === cardsStore.cards.length) {
          gameStore.completeGame();
        }
      }
    }, 300);
  }
}

// Canvas initialization
async function initializeCanvas() {
  if (!canvasElement.value || !containerRef.value) {
    console.error("Canvas element not found");
    return;
  }

  try {
    // Update container size for layout calculations first
    const rect = containerRef.value.getBoundingClientRect();
    canvasLayout.updateContainerSize(rect.width, rect.height);

    // Initialize canvas layout with current difficulty
    if (gameStore.difficulty) {
      canvasLayout.calculateLayout(gameStore.difficulty);
      console.log("Canvas layout calculated:", {
        difficulty: gameStore.difficulty.name,
        canvasSize: canvasLayout.canvasSize.value,
        cardSize: canvasLayout.cardSize.value,
      });
    }

    // Initialize game engine with calculated canvas size
    await gameEngine.init(canvasElement.value);

    // Set up canvas objects for cards
    setupCardObjects();

    // Start the game engine
    gameEngine.start();

    // Initialize game sync
    gameSync.initializeSync();

    isInitialized.value = true;
    console.log("Game canvas initialized successfully");
  } catch (error) {
    console.error("Failed to initialize game canvas:", error);
  }
}

// Setup canvas objects for cards
function setupCardObjects() {
  const cards = cardsStore.cards;

  cards.forEach((card, index) => {
    const position = canvasLayout.getCardPosition(index);
    const size = canvasLayout.cardSize.value;

    const canvasObject = {
      id: card.id,
      type: "card" as const,
      position,
      size,
      visible: true,
      zIndex: 1,
      data: {
        card,
        parallaxOffset: { x: 0, y: 0 },
      },
    };

    gameEngine.addCanvasObject(card.id, canvasObject);
  });

  console.log(`Set up ${cards.length} card objects for rendering`);
}

// Initialize canvas layout on mount
onMounted(() => {
  initializeCanvas();
});

// Cleanup on unmount
onUnmounted(() => {
  if (gameEngine.state.isRunning) {
    gameEngine.stop();
    console.log("Game engine stopped on component unmount");
  }
});

// Expose canvas methods for parent components
defineExpose({
  getCanvasElement: () => canvasElement.value,
  getRenderer: () => canvasRenderer.value,
  isInitialized: () => isInitialized.value,
  getCanvasSize: () => canvasSize.value,
});
</script>

<style scoped>
.game-canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  border-radius: 12px;
  overflow: hidden;
}

.game-canvas {
  display: block;
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  touch-action: none;
}

.canvas-loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #ffffff;
  font-size: 18px;
  font-weight: 500;
  text-align: center;
  z-index: 10;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .game-canvas-container {
    border-radius: 8px;
  }

  .game-canvas {
    border-radius: 4px;
  }

  .canvas-loading {
    font-size: 16px;
  }
}

@media (max-width: 480px) {
  .game-canvas-container {
    border-radius: 4px;
  }

  .canvas-loading {
    font-size: 14px;
  }
}
</style>
