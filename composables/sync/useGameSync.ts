/**
 * useGameSync - Real-time synchronization between game state and canvas rendering
 *
 * This composable bridges the gap between Pinia stores and canvas rendering:
 * - Watches for changes in game state and card states
 * - Batches and debounces state changes for optimal performance
 * - Synchronizes visual updates with game logic updates
 * - Manages animation triggers and visual feedback
 * - Handles immediate UI updates for responsive user interaction
 * - Provides performance monitoring and optimization
 *
 * Key features:
 * - Event-driven architecture with batched processing
 * - Configurable batching and debouncing for performance tuning
 * - Automatic detection of card state changes (position, flip state, etc.)
 * - Visual feedback for card selection and matching
 * - Performance metrics tracking for optimization
 * - Graceful handling of rapid state changes during gameplay
 */
import { ref, watch, nextTick } from "vue";
import { useGameCoreStore } from "~/stores/game/core";
import { useGameCardsStore } from "~/stores/game/cards";
import { useCanvasLayout } from "~/composables/engine/useCanvasLayout";
import { useGameEngine } from "~/composables/engine/useGameEngine";
import type { GameCard, GameStats } from "~/types/game";

// Synchronization event types
interface SyncEvent {
  type:
    | "card_state_change"
    | "game_complete"
    | "move_increment"
    | "match_found";
  data: {
    card?: GameCard;
    index?: number;
    stats?: GameStats;
    moves?: number;
    cardIds?: string[];
  };
  timestamp: number;
}

// Sync configuration
interface SyncConfig {
  enableBatching: boolean;
  batchDelay: number;
  maxBatchSize: number;
  enableDebouncing: boolean;
  debounceDelay: number;
}

// Performance tracking for sync operations
interface SyncStats {
  eventsProcessed: number;
  batchesExecuted: number;
  averageProcessingTime: number;
  lastSyncTime: number;
  queueSize: number;
}

export const useGameSync = (gameEngine?: ReturnType<typeof useGameEngine>) => {
  // Store references
  const gameStore = useGameCoreStore();
  const cardsStore = useGameCardsStore();

  // Composable references
  const canvasLayout = useCanvasLayout();

  // Use provided gameEngine or create a new one (fallback)
  const engine = gameEngine || useGameEngine();

  // Sync configuration
  const config = ref<SyncConfig>({
    enableBatching: true,
    batchDelay: 16, // ~60fps
    maxBatchSize: 50,
    enableDebouncing: true,
    debounceDelay: 100,
  });

  // Event queue for batching
  const eventQueue = ref<SyncEvent[]>([]);
  const isProcessing = ref(false);

  // Performance tracking
  const syncStats = ref<SyncStats>({
    eventsProcessed: 0,
    batchesExecuted: 0,
    averageProcessingTime: 0,
    lastSyncTime: 0,
    queueSize: 0,
  });

  // Timers for batching and debouncing
  let batchTimer: NodeJS.Timeout | null = null;
  let debounceTimer: NodeJS.Timeout | null = null;

  // State synchronization flags
  const syncFlags = ref({
    cardsNeedSync: false,
    gameStateNeedSync: false,
    layoutNeedSync: false,
  });

  /**
   * Initialize synchronization watchers
   */
  const initializeSync = (): void => {
    // Watch card state changes
    watch(
      () => cardsStore.cards,
      (newCards, oldCards) => {
        if (!oldCards || newCards.length !== oldCards.length) {
          // Complete card refresh needed
          scheduleCardRefresh();
        } else {
          // Check for individual card changes
          detectCardChanges(newCards, oldCards);
        }
      },
      { deep: true, immediate: true }
    );

    // Watch game state changes
    watch(
      () => gameStore.stats,
      (newStats) => {
        queueSyncEvent({
          type: "game_complete",
          data: { stats: newStats },
          timestamp: performance.now(),
        });
      },
      { deep: true }
    );

    // Watch selected cards for immediate feedback
    watch(
      () => cardsStore.selectedCards,
      (newSelected, oldSelected) => {
        if (newSelected.length !== oldSelected.length) {
          handleSelectedCardsChange(newSelected, oldSelected);
        }
      }
    );

    // Watch layout changes
    watch(
      () => canvasLayout.canvasSize,
      () => {
        syncFlags.value.layoutNeedSync = true;
        scheduleLayoutSync();
      },
      { deep: true }
    );
  };

  /**
   * Detect changes in individual cards
   */
  const detectCardChanges = (
    newCards: GameCard[],
    oldCards: GameCard[]
  ): void => {
    for (let i = 0; i < newCards.length; i++) {
      const newCard = newCards[i];
      const oldCard = oldCards[i];

      if (!oldCard || hasCardChanged(newCard, oldCard)) {
        queueSyncEvent({
          type: "card_state_change",
          data: { card: newCard, index: i },
          timestamp: performance.now(),
        });
      }
    }
  };

  /**
   * Check if card has changed
   */
  const hasCardChanged = (newCard: GameCard, oldCard: GameCard): boolean => {
    return (
      newCard.state !== oldCard.state ||
      newCard.position.x !== oldCard.position.x ||
      newCard.position.y !== oldCard.position.y ||
      newCard.cs2Item.id !== oldCard.cs2Item.id
    );
  };

  /**
   * Handle selected cards change for immediate visual feedback
   */
  const handleSelectedCardsChange = (
    newSelected: string[],
    oldSelected: string[]
  ): void => {
    // Cards that were deselected
    const deselected = oldSelected.filter((id) => !newSelected.includes(id));
    // Cards that were newly selected
    const selected = newSelected.filter((id) => !oldSelected.includes(id));

    // Immediate update for better UX
    for (const cardId of deselected) {
      updateCardVisualState(cardId, { scale: 1, rotation: 0 });
    }

    for (const cardId of selected) {
      updateCardVisualState(cardId, { scale: 1.05, rotation: 2 });
      startCardFlipAnimation(cardId);
    }
  };

  /**
   * Queue sync event for batch processing
   */
  const queueSyncEvent = (event: SyncEvent): void => {
    eventQueue.value.push(event);
    syncStats.value.queueSize = eventQueue.value.length;

    if (config.value.enableBatching) {
      scheduleBatchProcessing();
    } else {
      processEventQueue();
    }
  };

  /**
   * Schedule batch processing with timer
   */
  const scheduleBatchProcessing = (): void => {
    if (batchTimer) return;

    batchTimer = setTimeout(() => {
      processEventQueue();
      batchTimer = null;
    }, config.value.batchDelay);
  };

  /**
   * Process all queued events
   */
  const processEventQueue = async (): Promise<void> => {
    if (isProcessing.value || eventQueue.value.length === 0) return;

    isProcessing.value = true;
    const startTime = performance.now();

    try {
      // Process events in batches
      const batchSize = Math.min(
        eventQueue.value.length,
        config.value.maxBatchSize
      );
      const batch = eventQueue.value.splice(0, batchSize);

      await processBatch(batch);

      syncStats.value.batchesExecuted++;
      syncStats.value.eventsProcessed += batch.length;

      const processingTime = performance.now() - startTime;
      syncStats.value.averageProcessingTime =
        (syncStats.value.averageProcessingTime + processingTime) / 2;
      syncStats.value.lastSyncTime = performance.now();
    } catch (error) {
      console.error("Error processing sync event queue:", error);
    } finally {
      isProcessing.value = false;
      syncStats.value.queueSize = eventQueue.value.length;

      // Process remaining events if queue is not empty
      if (eventQueue.value.length > 0) {
        await nextTick();
        processEventQueue();
      }
    }
  };

  /**
   * Process a batch of sync events
   */
  const processBatch = async (events: SyncEvent[]): Promise<void> => {
    // Group events by type for efficient processing
    const eventGroups = events.reduce(
      (groups, event) => {
        if (!groups[event.type]) groups[event.type] = [];
        groups[event.type].push(event);
        return groups;
      },
      {} as Record<string, SyncEvent[]>
    );

    // Process each event type
    for (const [eventType, eventGroup] of Object.entries(eventGroups)) {
      switch (eventType) {
        case "card_state_change":
          await processCardStateChanges(eventGroup);
          break;
        case "game_complete":
          await processGameStateChanges(eventGroup);
          break;
        case "move_increment":
          await processMoveIncrements(eventGroup);
          break;
        case "match_found":
          await processMatchEvents(eventGroup);
          break;
      }
    }
  };

  /**
   * Process card state change events
   */
  const processCardStateChanges = async (
    events: SyncEvent[]
  ): Promise<void> => {
    for (const event of events) {
      const { card, index } = event.data;
      if (card && index !== undefined) {
        await syncCardToCanvas(card, index);
      }
    }
  };

  /**
   * Sync individual card to canvas
   */
  const syncCardToCanvas = async (
    card: GameCard,
    index: number
  ): Promise<void> => {
    // Calculate position based on layout
    const position = canvasLayout.getCardPosition(index);

    // Create canvas object for the card
    const cardObject = {
      id: card.id,
      type: "card" as const,
      position: position,
      size: {
        width: canvasLayout.cardSize.value.width,
        height: canvasLayout.cardSize.value.height,
      },
      visible: true,
      zIndex: 1,
      data: {
        card: card,
        parallaxOffset: { x: 0, y: 0 },
      },
    };

    // Add object to game engine
    engine.addCanvasObject(card.id, cardObject);

    // Update card render data for animations
    engine.updateCardRenderData(card.id, {
      card: card,
      animationProgress: 0,
      isFlipping: card.state === "revealed",
      flipDirection: card.state === "revealed" ? "front" : "back",
      parallaxOffset: { x: 0, y: 0 },
    });
  };

  /**
   * Update card visual state
   */
  const updateCardVisualState = (
    cardId: string,
    stateUpdates:
      | Record<string, unknown>
      | {
          scale?: number;
          rotation?: number;
          opacity?: number;
          flipProgress?: number;
          isFlipping?: boolean;
          flipDirection?: "front" | "back";
          parallaxOffset?: { x: number; y: number };
        }
  ): void => {
    // Update card render data in game engine
    engine.updateCardRenderData(cardId, stateUpdates);
  };

  /**
   * Start flip animation for card
   */
  const startCardFlipAnimation = (cardId: string): void => {
    // Trigger flip animation through game engine
    engine.updateCardRenderData(cardId, {
      isFlipping: true,
      flipDirection: "front",
      animationProgress: 0,
    });
  };

  /**
   * Process game state change events
   */
  const processGameStateChanges = async (
    events: SyncEvent[]
  ): Promise<void> => {
    // Take the most recent game state
    const latestEvent = events[events.length - 1];
    const { stats } = latestEvent.data;

    // Update any game-wide visual effects
    if (stats?.isComplete) {
      await triggerGameCompleteEffects();
    }
  };

  /**
   * Process move increment events
   */
  const processMoveIncrements = async (events: SyncEvent[]): Promise<void> => {
    // Batch move increments and update UI accordingly
    const _totalMoves = events.reduce(
      (sum, event) => sum + (event.data.moves || 1),
      0
    );
    // TODO: Use totalMoves for UI updates when implemented
  };

  /**
   * Process match found events
   */
  const processMatchEvents = async (events: SyncEvent[]): Promise<void> => {
    for (const event of events) {
      const { cardIds } = event.data;
      if (cardIds) {
        await triggerMatchEffect(cardIds);
      }
    }
  };

  /**
   * Trigger visual effects for game completion
   */
  const triggerGameCompleteEffects = async (): Promise<void> => {
    // Add sparkle effects around all matched cards
    for (const card of cardsStore.matchedCards) {
      const effectObject = {
        id: `sparkle-${card.id}`,
        type: "effect" as const,
        position: { x: card.position.x, y: card.position.y },
        size: { width: 50, height: 50 },
        visible: true,
        zIndex: 10,
        data: {
          type: "sparkle",
          progress: 0,
        },
      };
      engine.addCanvasObject(`sparkle-${card.id}`, effectObject);
    }
  };

  /**
   * Trigger match effect for specific cards
   */
  const triggerMatchEffect = async (cardIds: string[]): Promise<void> => {
    for (const cardId of cardIds) {
      const effectObject = {
        id: `match-${cardId}`,
        type: "effect" as const,
        position: { x: 0, y: 0 }, // Will be set based on card position
        size: { width: 50, height: 50 },
        visible: true,
        zIndex: 5,
        data: {
          type: "pulse",
          progress: 0,
        },
      };
      engine.addCanvasObject(`match-${cardId}`, effectObject);
    }
  };

  /**
   * Schedule complete card refresh
   */
  const scheduleCardRefresh = (): void => {
    if (config.value.enableDebouncing) {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        refreshAllCards();
        debounceTimer = null;
      }, config.value.debounceDelay);
    } else {
      refreshAllCards();
    }
  };

  /**
   * Refresh all cards in canvas
   */
  const refreshAllCards = async (): Promise<void> => {
    // Clear existing card objects by removing them individually
    for (const card of cardsStore.cards) {
      engine.removeCanvasObject(card.id);
    }

    // Recreate all card objects
    for (let i = 0; i < cardsStore.cards.length; i++) {
      const card = cardsStore.cards[i];
      await syncCardToCanvas(card, i);
    }
  };

  /**
   * Schedule layout synchronization
   */
  const scheduleLayoutSync = (): void => {
    // Update positions of all active cards when layout changes
    nextTick(() => {
      for (let i = 0; i < cardsStore.cards.length; i++) {
        const card = cardsStore.cards[i];
        const position = canvasLayout.getCardPosition(i);

        queueSyncEvent({
          type: "card_state_change",
          data: { card: { ...card, position }, index: i },
          timestamp: performance.now(),
        });
      }
      syncFlags.value.layoutNeedSync = false;
    });
  };

  /**
   * Force immediate synchronization
   */
  const forceSyncNow = async (): Promise<void> => {
    // Clear any pending timers
    if (batchTimer) {
      clearTimeout(batchTimer);
      batchTimer = null;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    // Process all pending events immediately
    await processEventQueue();

    // Force refresh if needed
    if (syncFlags.value.cardsNeedSync) {
      await refreshAllCards();
      syncFlags.value.cardsNeedSync = false;
    }

    console.log("Forced synchronization completed");
  };

  /**
   * Get synchronization statistics
   */
  const getSyncStats = () => ({
    ...syncStats.value,
    queueSize: eventQueue.value.length,
    isProcessing: isProcessing.value,
    syncFlags: { ...syncFlags.value },
    config: { ...config.value },
  });

  /**
   * Update sync configuration
   */
  const updateSyncConfig = (newConfig: Partial<SyncConfig>): void => {
    Object.assign(config.value, newConfig);
    console.log("Sync configuration updated:", config.value);
  };

  /**
   * Clean up resources
   */
  const cleanup = (): void => {
    if (batchTimer) {
      clearTimeout(batchTimer);
      batchTimer = null;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    eventQueue.value = [];
    isProcessing.value = false;

    console.log("Game sync cleanup completed");
  };

  return {
    // Core functionality
    initializeSync,
    queueSyncEvent,
    forceSyncNow,

    // State management
    syncFlags,
    config,

    // Statistics and monitoring
    getSyncStats,
    syncStats,

    // Configuration
    updateSyncConfig,

    // Lifecycle
    cleanup,

    // Manual sync operations
    refreshAllCards,
    scheduleCardRefresh,
    scheduleLayoutSync,
  };
};
