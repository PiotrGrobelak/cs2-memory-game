<template>
  <div ref="containerRef" class="game-canvas-container">
    <canvas
      ref="canvasElement"
      :width="layout.canvasSize.width"
      :height="layout.canvasSize.height"
      class="game-canvas"
      @click="interactions.handleClick"
      @touchstart="interactions.handleTouchStart"
      @touchend="interactions.handleTouchEnd"
    />
    <div v-if="!isInitialized" class="canvas-loading">Initializing game...</div>

    <!-- Debug Information -->
    <div v-if="debugMode && isInitialized" class="debug-overlay">
      <div class="debug-panel">
        <h4>Performance Metrics</h4>
        <div>FPS: {{ metrics.canvas.fps }}</div>
        <div>Objects: {{ renderState.objectCount }}</div>
        <div>Memory: {{ metrics.canvas.memoryUsage }}MB</div>
        <div>Device: {{ layout.deviceType }}</div>
        <div>
          Canvas: {{ layout.canvasSize.width }}×{{ layout.canvasSize.height }}
        </div>
        <div>
          Cards: {{ layout.cardSize.width }}×{{ layout.cardSize.height }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  useTemplateRef,
  onMounted,
  onUnmounted,
  watch,
} from "vue";
import { useCanvasManager } from "~/composables/engine/useCanvasManager";
import { useLayoutEngine } from "~/composables/engine/useLayoutEngine";
import { useRenderPipeline } from "~/composables/engine/useRenderPipeline";
import { useCanvasInteractions } from "~/composables/engine/useCanvasInteractions";
import { useAnimationTimeline } from "~/composables/engine/useAnimationTimeline";
import { usePerformanceOptimizer } from "~/composables/engine/usePerformanceOptimizer";
import { useStoreSync } from "~/composables/sync/useStoreSync";
import { useGameCoreStore } from "~/stores/game/core";
import { useGameCardsStore } from "~/stores/game/cards";
import { useGame } from "~/composables/core/useGame";

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

// New architecture composables
const canvasManager = useCanvasManager({
  enableHighDPI: true,
  targetFPS: 60,
  enablePerformanceMonitoring: props.debugMode,
});

const layoutEngine = useLayoutEngine();

const renderPipeline = useRenderPipeline();

const interactions = useCanvasInteractions({
  tapThreshold: 200,
  longPressThreshold: 500,
  panThreshold: 10,
});

// New advanced systems (Steps 7-9)
const animationTimeline = useAnimationTimeline();

const performanceOptimizer = usePerformanceOptimizer({
  targetFPS: 60,
  maxMemoryMB: 100,
  maxTextureMemoryMB: 50,
});

const storeSync = useStoreSync({
  enableBidirectional: true,
  conflictResolution: "canvas",
  enableTransactions: true,
});

// Stores - use unified game API to avoid conflicts
const game = useGame();
const gameStore = useGameCoreStore();
const cardsStore = useGameCardsStore();

// State
const isInitialized = ref(false);
const parallaxOffset = ref({ x: 0, y: 0 });
const animatingCards = ref(new Set<string>()); // Track cards currently animating

// Add debouncing for card setup
let cardSetupTimeoutId: number | null = null;
let lastSetupCardIds: string = "";

// Computed properties
const layout = computed(() => layoutEngine.currentLayout.value);
const metrics = computed(() => ({
  canvas: canvasManager.metrics,
  render: renderPipeline.state,
  performance: performanceOptimizer.metrics,
  timeline: animationTimeline.state,
  sync: storeSync.state,
}));
const renderState = computed(() => renderPipeline.state);

// Lifecycle management
onMounted(async () => {
  await initializeCanvas();
});

onUnmounted(() => {
  cleanup();
});

// Watch for container size changes
watch(
  () => layoutEngine.containerSize,
  (newSize, oldSize) => {
    if (isInitialized.value && hasSignificantSizeChange(newSize, oldSize)) {
      console.log("Container size changed, recalculating layout:", newSize);
      handleLayoutChange();
    }
  },
  { deep: true }
);

// Watch for cards to be generated
watch(
  () => game.cards.value.length,
  (newLength, oldLength) => {
    if (isInitialized.value && newLength > 0 && newLength !== oldLength) {
      console.log(
        `Cards updated: ${oldLength || 0} -> ${newLength}, scheduling card setup...`
      );

      // Debounce card setup to prevent excessive re-rendering
      if (cardSetupTimeoutId) {
        clearTimeout(cardSetupTimeoutId);
      }

      cardSetupTimeoutId = setTimeout(() => {
        setupCardRenderObjects();
        cardSetupTimeoutId = null;
      }, 100) as unknown as number; // Small delay to batch multiple updates
    }
  }
);

// Watch for difficulty changes
watch(
  () => game.difficulty.value,
  (newDifficulty) => {
    if (isInitialized.value && newDifficulty) {
      console.log(
        "Difficulty changed, recalculating layout:",
        newDifficulty.name
      );
      layoutEngine.calculateLayout(newDifficulty);

      // Debounce this too
      if (cardSetupTimeoutId) {
        clearTimeout(cardSetupTimeoutId);
      }

      cardSetupTimeoutId = setTimeout(() => {
        setupCardRenderObjects();
        cardSetupTimeoutId = null;
      }, 100) as unknown as number;
    }
  }
);

/**
 * Enhanced canvas initialization with advanced systems
 */
async function initializeCanvas(): Promise<void> {
  if (!canvasElement.value || !containerRef.value) {
    console.error("Canvas element not found");
    return;
  }

  try {
    console.log("Starting enhanced canvas initialization...");

    // Initialize performance optimizer first
    performanceOptimizer.initialize();

    // Initialize store synchronization
    storeSync.initialize();

    // Initialize animation timeline
    animationTimeline.initialize();

    // Initialize layout engine first
    layoutEngine.initialize(containerRef.value);

    // Calculate initial layout if difficulty is available
    if (game.difficulty.value) {
      layoutEngine.calculateLayout(game.difficulty.value);
    }

    // Initialize canvas manager
    await canvasManager.initialize(canvasElement.value);

    // Initialize render pipeline
    const context = canvasManager.context.value;
    if (context && context instanceof CanvasRenderingContext2D) {
      renderPipeline.initialize(context);
    }

    // Initialize interactions
    interactions.initialize(canvasElement.value, layoutEngine);

    // Setup enhanced event callbacks
    setupEnhancedEventCallbacks();

    // Setup enhanced watchers
    setupEnhancedWatchers();

    // Setup enhanced render callback
    setupEnhancedRenderCallback();

    // Setup enhanced update callback
    setupEnhancedUpdateCallback();

    // Create background render object
    setupBackgroundRenderObject();

    // Setup card objects if cards are already available
    if (game.cards.value.length > 0) {
      setupCardRenderObjects();
    }

    // Setup performance monitoring
    setupPerformanceMonitoring();

    // Start all systems
    canvasManager.start();
    animationTimeline.play();

    isInitialized.value = true;
    console.log("Enhanced canvas initialized successfully");
  } catch (error) {
    console.error("Failed to initialize enhanced canvas:", error);
  }
}

/**
 * Setup enhanced event callbacks with animation timeline integration
 */
function setupEnhancedEventCallbacks(): void {
  // Card click/tap handling with advanced animations
  interactions.addInteractionCallback("click", (event) => {
    if (event.cardIndex !== null) {
      const card = game.cards.value[event.cardIndex];

      // DEBUG: Show the mismatch problem
      console.log("🐛 CLICK DEBUG:", {
        clickedPosition: event.cardIndex,
        cardAtThatIndex: card?.id,
        cardAtThatIndexPairId: card?.pairId,
        canvasPosition: { x: event.canvasX, y: event.canvasY },
        allCardsInOrder: game.cards.value.map((c, i) => ({
          index: i,
          id: c.id,
          pairId: c.pairId,
        })),
      });

      if (card) {
        handleEnhancedCardClick(card.id);
      }
    }
  });

  interactions.addInteractionCallback("touch", (event) => {
    if (event.cardIndex !== null) {
      const card = game.cards.value[event.cardIndex];
      if (card) {
        handleEnhancedCardClick(card.id);
      }
    }
  });

  // Enhanced hover effects with simplified detection
  interactions.addInteractionCallback("hover", (event) => {
    // Only handle parallax effect, no card hover effects
    if (props.enableParallax && canvasElement.value) {
      // Apply simple parallax effect to background based on canvas position
      updateSimpleParallaxOffset(event.canvasX, event.canvasY);
    }

    // Do not apply any hover effects to cards - cards remain unchanged
  });

  // Enhanced gesture handling for parallax with performance optimization
  interactions.addInteractionCallback("gesture", (event) => {
    if (props.enableParallax && event.gesture?.type === "pan") {
      updateSimpleParallaxOffset(event.canvasX, event.canvasY);
    }
  });

  // Keyboard navigation
  interactions.addInteractionCallback("keyboard", (event) => {
    handleKeyboardNavigation(event.originalEvent as KeyboardEvent);
  });
}

/**
 * Setup enhanced render callback with performance optimization
 */
function setupEnhancedRenderCallback(): void {
  console.log("🔧 Setting up render callback");

  canvasManager.addRenderCallback(() => {
    console.log("🔄 Render callback called");

    // Update performance metrics
    performanceOptimizer.updateMetrics(performance.now());

    // Render with performance monitoring
    const renderStart = performance.now();
    renderPipeline.render();
    const renderTime = performance.now() - renderStart;

    // Track render performance
    if (renderTime > 16) {
      // More than one frame at 60fps
      console.debug(`Slow render detected: ${renderTime.toFixed(2)}ms`);
    }
  });

  console.log("✅ Render callback setup complete");
}

/**
 * Setup enhanced update callback with animation timeline
 */
function setupEnhancedUpdateCallback(): void {
  canvasManager.addUpdateCallback((_deltaTime: number) => {
    // Update animation timeline
    const animationUpdates = animationTimeline.update(performance.now());

    // Apply animation updates to render objects
    let hasUpdates = false;
    for (const [targetId, properties] of animationUpdates.entries()) {
      renderPipeline.updateRenderObject(targetId, {
        position: { x: properties.x || 0, y: properties.y || 0 },
        rotation: properties.rotation || 0,
        scale: { x: properties.scaleX || 1, y: properties.scaleY || 1 },
        opacity: properties.opacity !== undefined ? properties.opacity : 1,
      });
      hasUpdates = true;
    }

    // Sync canvas state to stores (only sync writable properties)
    const canvasState = {
      isPlaying: gameStore.isPlaying,
      selectedCards: cardsStore.selectedCards,
      // Note: Remove computed/readonly properties to prevent sync warnings:
      // - cards: managed by cards store, not directly settable
      // - matchedCards: computed property
      // - revealedCards: computed property
      // - score: computed property
      // - moves/matches: managed by game actions
    };

    storeSync.syncCanvasToStore(canvasState);

    return hasUpdates || updateCardStates();
  });
}

/**
 * Create background render object
 */
function setupBackgroundRenderObject(): void {
  const currentLayout = layout.value;
  const background = {
    id: "background",
    type: "background" as const,
    position: { x: 0, y: 0 },
    size: currentLayout.canvasSize,
    zIndex: 0,
    visible: true,
    opacity: 1,
    rotation: 0,
    scale: { x: 1, y: 1 },
    animationState: "idle" as const,
    animationProgress: 0,
    data: {
      pattern: "gradient",
      color: "#1a1a2e",
      opacity: 1,
    },
  };

  renderPipeline.addRenderObject(background);
}

/**
 * Enhanced card click handling with simplified animation
 */
function handleEnhancedCardClick(cardId: string): void {
  console.log("Card clicked:", cardId);

  // Prevent multiple clicks on the same card while animating
  if (animatingCards.value.has(cardId)) {
    console.log("⏸️ Card animation already in progress:", cardId);
    return;
  }

  if (!game.isPlaying.value) {
    game.startGame();
  }

  const card = game.cards.value.find((c) => c.id === cardId);
  if (!card || card.state !== "hidden") {
    console.log("Card not clickable:", card?.state);
    return;
  }

  console.log("Starting simple card flip animation for:", cardId);

  // Mark card as animating
  animatingCards.value.add(cardId);

  // Get the card's render object to ensure we maintain its position
  const cardRenderObject = renderPipeline.getRenderObject(cardId);
  if (!cardRenderObject) {
    console.error("Card render object not found:", cardId);
    animatingCards.value.delete(cardId); // Remove from animating set
    return;
  }

  // Store the original position and scale to prevent drift
  const originalPosition = { ...cardRenderObject.position };
  const originalScale = { ...cardRenderObject.scale };

  // Start simple flip animation by updating the card's data to show it's flipping
  renderPipeline.updateRenderObject(cardId, {
    visible: true,
    opacity: 1,
    position: originalPosition, // Maintain original position
    scale: originalScale, // Maintain original scale
    data: {
      ...(cardRenderObject.data || {}),
      isFlipping: true,
      flipDirection: "front", // Start flipping to front
    },
  });

  // Simulate flip animation with a simple timeout
  // This uses the existing card renderer's flip logic
  let flipProgress = 0;
  const flipDuration = 300; // ms
  const flipStartTime = performance.now();

  const animateFlip = () => {
    const currentTime = performance.now();
    const elapsed = currentTime - flipStartTime;
    flipProgress = Math.min(elapsed / flipDuration, 1);

    // Update animation progress
    renderPipeline.updateRenderObject(cardId, {
      visible: true,
      opacity: 1,
      position: originalPosition,
      scale: originalScale,
      animationProgress: flipProgress,
      data: {
        ...(cardRenderObject.data || {}),
        isFlipping: true,
        flipDirection: "front",
      },
    });

    if (flipProgress < 1) {
      requestAnimationFrame(animateFlip);
    } else {
      // Animation complete
      console.log("Simple flip animation completed for:", cardId);
      animatingCards.value.delete(cardId); // Remove from animating set
      completeCardFlip(cardId, originalPosition, originalScale);
    }
  };

  // Start the animation
  requestAnimationFrame(animateFlip);
}

/**
 * Complete card flip and update game state
 */
function completeCardFlip(
  cardId: string,
  originalPosition: { x: number; y: number },
  originalScale: { x: number; y: number }
): void {
  // Use unified game API instead of direct store access
  if (!game.isPlaying.value) {
    game.startGame();
  }

  const success = game.selectCard(cardId);
  if (!success) {
    console.log("Card selection failed for:", cardId);
    return;
  }

  // Get the updated card from store (with new state)
  const updatedCard = game.cards.value.find((c) => c.id === cardId);
  if (!updatedCard) {
    console.error("Updated card not found:", cardId);
    return;
  }

  console.log("Card state after selection:", updatedCard.state);

  // Update the card to show it's revealed with the correct state
  renderPipeline.updateRenderObject(cardId, {
    visible: true,
    opacity: 1,
    position: originalPosition, // Maintain original position
    scale: originalScale, // Maintain original scale
    animationProgress: 1, // Animation complete
    data: {
      card: updatedCard, // Use the updated card with new state
      isFlipping: false, // No longer flipping
      flipDirection: updatedCard.state === "hidden" ? "back" : "front", // Correct direction based on state
      hoverIntensity: 0,
      matchGlow: 0,
    },
  });

  console.log("Card updated after flip:", cardId, updatedCard.state);

  // Check if we now have 2 revealed cards and need to handle match checking timing
  const revealedCards = game.revealedCards.value;
  console.log("Current revealed cards after selection:", revealedCards.length);

  // If we have 2 revealed cards, the useGame.selectCard should have already called checkForMatch
  // But we need to handle the visual timing for non-matches (hiding cards after delay)
  if (revealedCards.length === 0 && game.selectedCards.value.length === 0) {
    // This means checkForMatch was called and cards were either matched or are about to be hidden
    // For non-matches, we need to visually show them for a moment before hiding
    console.log("Match checking completed - monitoring for state changes");
  }
}

/**
 * Setup performance monitoring
 */
function setupPerformanceMonitoring(): void {
  // Monitor performance and adjust quality if needed
  console.log("Performance monitoring started");

  // Handle performance alerts with more intelligent responses
  watch(
    () => performanceOptimizer.criticalAlerts.value,
    (alerts) => {
      if (alerts.length > 0) {
        console.warn("Critical performance alerts:", alerts);

        // Automatically reduce quality if performance is poor
        const latestAlert = alerts[alerts.length - 1];
        if (
          latestAlert.type === "fps" &&
          latestAlert.value &&
          latestAlert.value < 30
        ) {
          console.log("Automatically reducing quality due to low FPS");
          // Disable parallax and reduce animation quality
          handleLowPerformance();
        }
      }
    },
    { deep: true }
  );

  // Watch for performance improvements to re-enable features
  watch(
    () => performanceOptimizer.isPerformanceGood.value,
    (isGood, wasGood) => {
      if (isGood && !wasGood) {
        console.log("Performance improved, re-enabling features");
        handlePerformanceImproved();
      }
    }
  );
}

/**
 * Handle low performance by reducing quality
 */
function handleLowPerformance(): void {
  // Log the performance degradation
  console.log("Reducing quality due to performance issues");

  // Note: We can't directly change target FPS at runtime, but we can:
  // 1. Reduce animation complexity
  // 2. Skip non-essential animations
  // 3. Reduce update frequency for non-critical systems

  // This flag can be used by the animation system to reduce complexity
  if (props.enableParallax) {
    console.log("Disabling parallax due to performance");
  }
}

/**
 * Handle performance improvements by re-enabling features
 */
function handlePerformanceImproved(): void {
  // Log the performance improvement
  console.log("Performance improved, features can be restored");
}

/**
 * Update card states (called from update callback)
 */
function updateCardStates(): boolean {
  // This could update animations, hover effects, etc.
  // Return true if any changes were made
  return false;
}

/**
 * Simple parallax effect with canvas coordinates
 */
function updateSimpleParallaxOffset(canvasX: number, canvasY: number): void {
  if (!canvasElement.value) return;

  const currentLayout = layout.value;
  const centerX = currentLayout.canvasSize.width / 2;
  const centerY = currentLayout.canvasSize.height / 2;

  // Calculate offset based on distance from center
  const offsetX = ((canvasX - centerX) / centerX) * 20; // Increased multiplier for more visible effect
  const offsetY = ((canvasY - centerY) / centerY) * 20;

  // Update background position directly
  renderPipeline.updateRenderObject("background", {
    position: {
      x: offsetX,
      y: offsetY,
    },
  });

  // Update parallax state
  parallaxOffset.value = {
    x: offsetX / 20, // Normalize for state
    y: offsetY / 20,
  };
}

/**
 * Handle keyboard navigation
 */
function handleKeyboardNavigation(event: KeyboardEvent): void {
  // Implement keyboard navigation between cards
  console.log("Keyboard navigation:", event.key);
}

/**
 * Handle layout changes
 */
function handleLayoutChange(): void {
  if (!game.difficulty.value) return;

  // Recalculate layout
  layoutEngine.recalculateLayout();

  // Update render pipeline viewport
  renderPipeline.updateViewport(
    layout.value.canvasSize.width,
    layout.value.canvasSize.height
  );

  // Update background size
  renderPipeline.updateRenderObject("background", {
    size: layout.value.canvasSize,
  });

  // Reposition all cards
  setupCardRenderObjects();

  // Mark for re-render
  renderPipeline.markDirty();
}

/**
 * Check if size change is significant
 */
function hasSignificantSizeChange(
  newSize: { width: number; height: number },
  oldSize: { width: number; height: number }
): boolean {
  const threshold = 50;
  return (
    Math.abs(newSize.width - oldSize.width) > threshold ||
    Math.abs(newSize.height - oldSize.height) > threshold
  );
}

/**
 * Setup card render objects
 */
function setupCardRenderObjects(): void {
  console.log(`🎯 setupCardRenderObjects called`, {
    cardsLength: game.cards.value.length,
    hasLayout: !!layout.value.cardSize,
    layoutCardSize: layout.value.cardSize,
    renderPipelineObjects: renderPipeline.state.objectCount,
    isInitialized: isInitialized.value,
  });

  // Only proceed if we have cards and layout is available
  if (!game.cards.value.length || !layout.value.cardSize) {
    console.log("❌ Skipping card setup - no cards or layout not ready");
    return;
  }

  // Check if cards have already been setup with current configuration
  const currentCardIds = game.cards.value
    .map((card) => card.id)
    .sort()
    .join(",");

  if (currentCardIds === lastSetupCardIds) {
    console.log("⏭️ Cards already properly setup, skipping re-setup");
    // Force re-setup if render pipeline has no objects
    if (renderPipeline.state.objectCount === 0) {
      console.log("🔄 Forcing re-setup due to empty render pipeline");
      lastSetupCardIds = ""; // Reset to force re-setup
    } else {
      return;
    }
  }

  console.log(`🧹 Clearing ${game.cards.value.length} existing card objects`);

  // Clear existing card objects efficiently
  const existingCardIds = game.cards.value.map((card) => card.id);
  existingCardIds.forEach((cardId) => {
    renderPipeline.removeRenderObject(cardId);
  });

  console.log(`🎨 Creating ${game.cards.value.length} new card objects`);

  // Create new card objects
  game.cards.value.forEach((card, index) => {
    const position = layoutEngine.getCardPosition(index);

    const cardObject = {
      id: card.id,
      type: "card" as const,
      position,
      size: layout.value.cardSize,
      zIndex: 100 + index,
      visible: true,
      opacity: 1,
      rotation: 0,
      scale: { x: 1, y: 1 },
      animationState: "idle" as const,
      animationProgress: 0,
      data: {
        card,
        isFlipping: false,
        flipDirection: "back" as const,
        hoverIntensity: 0,
        matchGlow: card.state === "matched" ? 1 : 0,
      },
    };

    console.log(`🃏 Creating card object for ${card.id}`, {
      cardState: card.state,
      position,
      size: layout.value.cardSize,
      zIndex: cardObject.zIndex,
    });

    renderPipeline.addRenderObject(cardObject);
  });

  // Remember this setup
  lastSetupCardIds = currentCardIds;

  console.log(
    `✅ Setup complete - ${game.cards.value.length} card render objects created`
  );
}

/**
 * Enhanced cleanup with all systems
 */
function cleanup(): void {
  // Clear any pending timeouts
  if (cardSetupTimeoutId) {
    clearTimeout(cardSetupTimeoutId);
    cardSetupTimeoutId = null;
  }

  // Stop and cleanup all systems in reverse order
  animationTimeline.stop();
  performanceOptimizer.cleanup();
  storeSync.cleanup();

  canvasManager.cleanup();
  layoutEngine.cleanup();
  renderPipeline.cleanup();
  interactions.cleanup();
  animationTimeline.cleanup();

  isInitialized.value = false;
  console.log("Enhanced canvas systems cleaned up");
}

// Enhanced expose methods with new systems
defineExpose({
  getCanvasElement: () => canvasElement.value,
  isInitialized: () => isInitialized.value,
  getCanvasSize: () => layout.value.canvasSize,
  toggleDebugMode: () => renderPipeline.toggleDebugMode(),
  getMetrics: () => ({
    canvas: canvasManager.metrics,
    render: renderState.value,
    layout: layoutEngine.getLayoutInfo(),
    interactions: interactions.getStats(),
    performance: performanceOptimizer.getPerformanceSummary(),
    animations: animationTimeline.getStats(),
    sync: storeSync.getSyncStats(),
  }),
  getPerformanceRecommendations: () =>
    performanceOptimizer.getOptimizationRecommendations(),
  forceSync: () => storeSync.forceSyncAll(),
  createCustomAnimation: (
    id: string,
    targetId: string,
    properties: Record<string, { from: number; to: number }>,
    options: {
      duration: number;
      delay?: number;
      easing?: string;
      repeat?: number;
      yoyo?: boolean;
      priority?: number;
    }
  ) => {
    animationTimeline.addAnimation(id, targetId, properties, options);
    animationTimeline.startAnimation(id);
  },
});

/**
 * Setup enhanced watchers and event handlers
 */
function setupEnhancedWatchers(): void {
  // Watch for individual card state changes and update render objects accordingly
  watch(
    () => game.cards.value.map((card) => ({ id: card.id, state: card.state })),
    (newCardStates, oldCardStates) => {
      if (!oldCardStates) return; // Skip initial load

      // Check for cards that changed state
      newCardStates.forEach((newCard, index) => {
        const oldCard = oldCardStates[index];
        if (oldCard && newCard.state !== oldCard.state) {
          console.log(
            `Card ${newCard.id} state changed from ${oldCard.state} to ${newCard.state}`
          );

          // Update the render object for this card
          const updatedCard = game.cards.value.find((c) => c.id === newCard.id);
          const renderObject = renderPipeline.getRenderObject(newCard.id);

          if (updatedCard && renderObject) {
            renderPipeline.updateRenderObject(newCard.id, {
              data: {
                card: updatedCard,
                isFlipping: false,
                flipDirection:
                  updatedCard.state === "hidden" ? "back" : "front",
                hoverIntensity: 0,
                matchGlow: updatedCard.state === "matched" ? 1 : 0,
              },
            });
          }
        }
      });
    },
    { deep: true }
  );

  // Watch for playing state changes
  watch(
    () => game.isPlaying.value,
    (newState, oldState) => {
      console.log(`Game playing state changed: ${oldState} -> ${newState}`);

      if (newState && !oldState) {
        // Game started
        console.log("Game started - ensuring cards are set up");
        setupCardRenderObjects();
      }
    }
  );

  console.log("Enhanced watchers setup complete");
}
</script>

<style scoped>
.game-canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: block;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  border-radius: 12px;
  overflow: hidden;
}

.game-canvas {
  display: block;
  width: 100%;
  height: 100%;
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

.debug-overlay {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 100;
}

.debug-panel {
  background: rgba(0, 0, 0, 0.8);
  color: #00ff00;
  padding: 12px;
  border-radius: 6px;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.4;
  min-width: 200px;
}

.debug-panel h4 {
  margin: 0 0 8px 0;
  color: #ffffff;
  font-size: 14px;
}

.debug-panel div {
  margin: 2px 0;
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

  .debug-panel {
    font-size: 10px;
    padding: 8px;
    min-width: 150px;
  }
}

@media (max-width: 480px) {
  .game-canvas-container {
    border-radius: 4px;
  }

  .canvas-loading {
    font-size: 14px;
  }

  .debug-panel {
    font-size: 9px;
    padding: 6px;
    min-width: 120px;
  }
}
</style>
