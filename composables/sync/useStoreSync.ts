/**
 * useStoreSync - Advanced store synchronization system
 *
 * This composable provides sophisticated state synchronization:
 * - Bidirectional sync between canvas and Pinia stores
 * - Conflict resolution and state consistency management
 * - Performance-optimized batch updates
 * - Event-driven state change propagation
 * - Selective sync with field-level granularity
 * - State rollback and transaction management
 *
 * Key features:
 * - Real-time store synchronization
 * - Smart conflict detection and resolution
 * - Performance-optimized batch processing
 * - Event filtering and debouncing
 * - State validation and integrity checks
 * - Transaction-based state updates
 */
import { reactive, readonly, watch, nextTick } from "vue";
import { useGameCoreStore } from "~/stores/game/core";
import { useGameCardsStore } from "~/stores/game/cards";

// Sync configuration interface
interface SyncConfig {
  enableBidirectional: boolean;
  batchUpdateDelay: number;
  conflictResolution: "canvas" | "store" | "manual";
  enableTransactions: boolean;
  enableValidation: boolean;
  debounceInterval: number;
}

// Sync field configuration
interface FieldSyncConfig {
  enabled: boolean;
  priority: number;
  validator?: (value: unknown) => boolean;
  transformer?: (value: unknown) => unknown;
  conflictResolver?: (canvasValue: unknown, storeValue: unknown) => unknown;
}

// Sync state interface
interface SyncState {
  isInitialized: boolean;
  isSyncing: boolean;
  lastSyncTime: number;
  conflictCount: number;
  updateCount: number;
  errorCount: number;
  transactionDepth: number;
}

// Change event interface
interface ChangeEvent {
  source: "canvas" | "store";
  field: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
  priority: number;
}

// Sync transaction interface
interface SyncTransaction {
  id: string;
  changes: ChangeEvent[];
  startTime: number;
  status: "pending" | "committing" | "committed" | "rolled_back";
}

// Conflict interface
interface SyncConflict {
  field: string;
  canvasValue: unknown;
  storeValue: unknown;
  timestamp: number;
  resolution?: "canvas" | "store" | "manual";
  resolved: boolean;
}

// Default configuration
const DEFAULT_CONFIG: SyncConfig = {
  enableBidirectional: true,
  batchUpdateDelay: 16, // ~60fps
  conflictResolution: "canvas", // Canvas takes priority by default
  enableTransactions: true,
  enableValidation: true,
  debounceInterval: 50,
};

// Field sync configurations
const FIELD_SYNC_CONFIGS: Record<string, FieldSyncConfig> = {
  // Game core fields
  isPlaying: {
    enabled: true,
    priority: 1,
    validator: (value) => typeof value === "boolean",
  },
  score: {
    enabled: false, // Computed property - cannot be directly synchronized
    priority: 2,
    validator: (value) => typeof value === "number" && value >= 0,
  },
  moves: {
    enabled: false, // Managed by game actions - cannot be directly synchronized
    priority: 2,
    validator: (value) => typeof value === "number" && value >= 0,
  },
  matches: {
    enabled: false, // Managed by game actions - cannot be directly synchronized
    priority: 2,
    validator: (value) => typeof value === "number" && value >= 0,
  },
  timeElapsed: {
    enabled: true,
    priority: 3,
    validator: (value) => typeof value === "number" && value >= 0,
  },
  difficulty: {
    enabled: false, // Requires game reinitialization - cannot be directly synchronized
    priority: 1,
    validator: (value): value is Record<string, unknown> =>
      value != null &&
      typeof value === "object" &&
      typeof (value as Record<string, unknown>).name === "string",
  },

  // Card fields
  cards: {
    enabled: false, // Managed by cards store - cannot be directly synchronized
    priority: 1,
    validator: (value) => Array.isArray(value),
  },
  selectedCards: {
    enabled: true, // This can be synchronized as it's directly settable
    priority: 1,
    validator: (value) => Array.isArray(value) && value.length <= 2,
  },
  matchedCards: {
    enabled: false, // Computed property - cannot be directly synchronized
    priority: 2,
    validator: (value) => Array.isArray(value),
  },
  revealedCards: {
    enabled: false, // Computed property - cannot be directly synchronized
    priority: 2,
    validator: (value) => Array.isArray(value),
  },
};

export const useStoreSync = (config: Partial<SyncConfig> = {}) => {
  // Merge configuration
  const syncConfig = { ...DEFAULT_CONFIG, ...config };

  // Get store instances
  const gameStore = useGameCoreStore();
  const cardsStore = useGameCardsStore();

  // Sync state
  const state = reactive<SyncState>({
    isInitialized: false,
    isSyncing: false,
    lastSyncTime: 0,
    conflictCount: 0,
    updateCount: 0,
    errorCount: 0,
    transactionDepth: 0,
  });

  // Change queue for batch processing
  const changeQueue = reactive<ChangeEvent[]>([]);

  // Active transactions
  const activeTransactions = reactive<Map<string, SyncTransaction>>(new Map());

  // Conflicts awaiting resolution
  const pendingConflicts = reactive<SyncConflict[]>([]);

  // Canvas state cache for comparison
  const canvasStateCache = reactive<Record<string, unknown>>({});

  // Store state cache for comparison
  const storeStateCache = reactive<Record<string, unknown>>({});

  // Debounce timers
  const debounceTimers = new Map<string, number>();

  // Batch update timer
  let batchUpdateTimer: number | null = null;

  /**
   * Initialize store synchronization
   */
  const initialize = (): void => {
    if (state.isInitialized) {
      console.warn("Store sync already initialized");
      return;
    }

    // Initialize state caches
    updateStoreCaches();

    // Setup store watchers
    setupStoreWatchers();

    state.isInitialized = true;
    console.log("Store synchronization initialized", {
      bidirectional: syncConfig.enableBidirectional,
      conflictResolution: syncConfig.conflictResolution,
      transactions: syncConfig.enableTransactions,
    });
  };

  /**
   * Update internal state caches
   */
  const updateStoreCaches = (): void => {
    // Game core store cache
    storeStateCache.isPlaying = gameStore.isPlaying;
    storeStateCache.score = gameStore.currentScore; // Use computed score
    storeStateCache.moves = gameStore.stats.moves; // Access via stats
    storeStateCache.matches = gameStore.stats.matchesFound; // Use matchesFound instead of matches
    storeStateCache.timeElapsed = gameStore.stats.timeElapsed; // Access via stats
    storeStateCache.difficulty = gameStore.difficulty;

    // Cards store cache
    storeStateCache.cards = [...cardsStore.cards];
    storeStateCache.selectedCards = [...cardsStore.selectedCards];
    storeStateCache.matchedCards = [...cardsStore.matchedCards];
    storeStateCache.revealedCards = [...cardsStore.revealedCards]; // Use revealedCards instead of flippedCards
  };

  /**
   * Setup store watchers for bidirectional sync
   */
  const setupStoreWatchers = (): void => {
    if (!syncConfig.enableBidirectional) return;

    // Watch game core store changes
    watch(
      () => gameStore.isPlaying,
      (newValue, oldValue) => {
        handleStoreChange("isPlaying", oldValue, newValue);
      }
    );

    watch(
      () => gameStore.currentScore,
      (newValue, oldValue) => {
        handleStoreChange("score", oldValue, newValue);
      }
    );

    watch(
      () => gameStore.stats.moves,
      (newValue, oldValue) => {
        handleStoreChange("moves", oldValue, newValue);
      }
    );

    watch(
      () => gameStore.stats.matchesFound,
      (newValue, oldValue) => {
        handleStoreChange("matches", oldValue, newValue);
      }
    );

    watch(
      () => gameStore.stats.timeElapsed,
      (newValue, oldValue) => {
        handleStoreChange("timeElapsed", oldValue, newValue);
      }
    );

    watch(
      () => gameStore.difficulty,
      (newValue, oldValue) => {
        handleStoreChange("difficulty", oldValue, newValue);
      },
      { deep: true }
    );

    // Watch cards store changes
    watch(
      () => cardsStore.cards,
      (newValue, oldValue) => {
        handleStoreChange("cards", oldValue, newValue);
      },
      { deep: true }
    );

    watch(
      () => cardsStore.selectedCards,
      (newValue, oldValue) => {
        handleStoreChange("selectedCards", oldValue, newValue);
      },
      { deep: true }
    );

    watch(
      () => cardsStore.matchedCards,
      (newValue, oldValue) => {
        handleStoreChange("matchedCards", oldValue, newValue);
      },
      { deep: true }
    );

    watch(
      () => cardsStore.revealedCards,
      (newValue, oldValue) => {
        handleStoreChange("revealedCards", oldValue, newValue);
      },
      { deep: true }
    );
  };

  /**
   * Handle store changes
   */
  const handleStoreChange = (
    field: string,
    oldValue: unknown,
    newValue: unknown
  ): void => {
    if (state.isSyncing) return; // Prevent sync loops

    const fieldConfig = FIELD_SYNC_CONFIGS[field];
    if (!fieldConfig?.enabled) return;

    // Debounce rapid changes
    if (debounceTimers.has(field)) {
      clearTimeout(debounceTimers.get(field));
    }

    const timer = setTimeout(() => {
      queueChange("store", field, oldValue, newValue, fieldConfig.priority);
      debounceTimers.delete(field);
    }, syncConfig.debounceInterval) as unknown as number;

    debounceTimers.set(field, timer);
  };

  /**
   * Sync canvas state to stores
   */
  const syncCanvasToStore = (canvasState: Record<string, unknown>): void => {
    if (!state.isInitialized) return;

    state.isSyncing = true;

    try {
      const changes: ChangeEvent[] = [];

      // Compare canvas state with cached state
      for (const [field, newValue] of Object.entries(canvasState)) {
        const fieldConfig = FIELD_SYNC_CONFIGS[field];
        if (!fieldConfig?.enabled) continue;

        const oldValue = canvasStateCache[field];

        if (!deepEqual(oldValue, newValue)) {
          changes.push({
            source: "canvas",
            field,
            oldValue,
            newValue,
            timestamp: performance.now(),
            priority: fieldConfig.priority,
          });

          canvasStateCache[field] = deepClone(newValue);
        }
      }

      // Process changes
      if (changes.length > 0) {
        if (syncConfig.enableTransactions) {
          processChangesWithTransaction(changes);
        } else {
          processChangesDirectly(changes);
        }
      }
    } catch (error) {
      console.error("Error syncing canvas to store:", error);
      state.errorCount++;
    } finally {
      state.isSyncing = false;
      state.lastSyncTime = performance.now();
    }
  };

  /**
   * Queue change for batch processing
   */
  const queueChange = (
    source: "canvas" | "store",
    field: string,
    oldValue: unknown,
    newValue: unknown,
    priority: number
  ): void => {
    const change: ChangeEvent = {
      source,
      field,
      oldValue,
      newValue,
      timestamp: performance.now(),
      priority,
    };

    changeQueue.push(change);

    // Schedule batch processing
    if (!batchUpdateTimer) {
      batchUpdateTimer = setTimeout(() => {
        processBatchedChanges();
        batchUpdateTimer = null;
      }, syncConfig.batchUpdateDelay) as unknown as number;
    }
  };

  /**
   * Process batched changes
   */
  const processBatchedChanges = async (): Promise<void> => {
    if (changeQueue.length === 0) return;

    // Sort changes by priority
    const sortedChanges = [...changeQueue].sort(
      (a, b) => a.priority - b.priority
    );
    changeQueue.length = 0;

    if (syncConfig.enableTransactions) {
      await processChangesWithTransaction(sortedChanges);
    } else {
      await processChangesDirectly(sortedChanges);
    }
  };

  /**
   * Process changes with transaction support
   */
  const processChangesWithTransaction = async (
    changes: ChangeEvent[]
  ): Promise<void> => {
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const transaction: SyncTransaction = {
      id: transactionId,
      changes: [...changes],
      startTime: performance.now(),
      status: "pending",
    };

    activeTransactions.set(transactionId, transaction);
    state.transactionDepth++;

    try {
      transaction.status = "committing";

      for (const change of changes) {
        await processChange(change);
      }

      transaction.status = "committed";
      console.debug(
        `Transaction ${transactionId} committed with ${changes.length} changes`
      );
    } catch (error) {
      transaction.status = "rolled_back";
      console.error(`Transaction ${transactionId} failed:`, error);

      // Attempt rollback
      await rollbackTransaction(transaction);
      throw error;
    } finally {
      activeTransactions.delete(transactionId);
      state.transactionDepth--;
    }
  };

  /**
   * Process changes directly without transactions
   */
  const processChangesDirectly = async (
    changes: ChangeEvent[]
  ): Promise<void> => {
    for (const change of changes) {
      try {
        await processChange(change);
      } catch (error) {
        console.error(
          `Error processing change for field "${change.field}":`,
          error
        );
        state.errorCount++;
      }
    }
  };

  /**
   * Process individual change
   */
  const processChange = async (change: ChangeEvent): Promise<void> => {
    const fieldConfig = FIELD_SYNC_CONFIGS[change.field];

    // Validate value if validator is configured
    if (syncConfig.enableValidation && fieldConfig.validator) {
      if (!fieldConfig.validator(change.newValue)) {
        throw new Error(`Validation failed for field "${change.field}"`);
      }
    }

    // Transform value if transformer is configured
    let finalValue = change.newValue;
    if (fieldConfig.transformer) {
      finalValue = fieldConfig.transformer(change.newValue);
    }

    // Check for conflicts
    const conflict = detectConflict(change.field, finalValue);
    if (conflict) {
      await handleConflict(conflict);
      return;
    }

    // Apply change to appropriate store
    if (change.source === "canvas") {
      await applyCanvasChangeToStore(change.field, finalValue);
    } else {
      await applyStoreChangeToCanvas(change.field, finalValue);
    }

    state.updateCount++;
  };

  /**
   * Detect synchronization conflicts
   */
  const detectConflict = (
    field: string,
    newValue: unknown
  ): SyncConflict | null => {
    const currentStoreValue = getStoreValue(field);
    const currentCanvasValue = canvasStateCache[field];

    // Check if there's a conflict (both canvas and store have different values)
    if (
      !deepEqual(currentStoreValue, currentCanvasValue) &&
      !deepEqual(currentStoreValue, newValue) &&
      !deepEqual(currentCanvasValue, newValue)
    ) {
      return {
        field,
        canvasValue: currentCanvasValue,
        storeValue: currentStoreValue,
        timestamp: performance.now(),
        resolved: false,
      };
    }

    return null;
  };

  /**
   * Handle synchronization conflict
   */
  const handleConflict = async (conflict: SyncConflict): Promise<void> => {
    state.conflictCount++;

    const fieldConfig = FIELD_SYNC_CONFIGS[conflict.field];
    let resolvedValue: unknown;

    // Use custom conflict resolver if available
    if (fieldConfig.conflictResolver) {
      resolvedValue = fieldConfig.conflictResolver(
        conflict.canvasValue,
        conflict.storeValue
      );
      conflict.resolution = "manual";
    } else {
      // Use configured resolution strategy
      switch (syncConfig.conflictResolution) {
        case "canvas":
          resolvedValue = conflict.canvasValue;
          conflict.resolution = "canvas";
          break;
        case "store":
          resolvedValue = conflict.storeValue;
          conflict.resolution = "store";
          break;
        case "manual":
          // Add to pending conflicts for manual resolution
          pendingConflicts.push(conflict);
          console.warn(
            `Conflict detected for field "${conflict.field}" - manual resolution required`
          );
          return;
      }
    }

    // Apply resolved value
    await applyResolvedValue(conflict.field, resolvedValue);
    conflict.resolved = true;

    console.debug(
      `Conflict resolved for field "${conflict.field}" using ${conflict.resolution} value`
    );
  };

  /**
   * Apply resolved conflict value
   */
  const applyResolvedValue = async (
    field: string,
    value: unknown
  ): Promise<void> => {
    // Update both canvas cache and store
    canvasStateCache[field] = deepClone(value);
    await applyCanvasChangeToStore(field, value);
  };

  /**
   * Apply canvas change to store
   */
  const applyCanvasChangeToStore = async (
    field: string,
    value: unknown
  ): Promise<void> => {
    state.isSyncing = true;

    try {
      switch (field) {
        case "isPlaying":
          if (value) {
            gameStore.startGame();
          } else {
            gameStore.pauseGame();
          }
          break;
        case "score":
          // Score is computed, cannot be directly set
          console.warn("Score is computed and cannot be directly synchronized");
          break;
        case "moves": {
          // Use the proper method to update moves
          // Since we need to set a specific value, we need to reset and increment
          const currentMoves = gameStore.stats.moves;
          const targetMoves = value as number;
          if (targetMoves !== currentMoves) {
            console.warn(
              "Direct moves synchronization not fully supported - moves are managed by game actions"
            );
          }
          break;
        }
        case "matches": {
          // Use the proper method to update matches
          // Since we need to set a specific value, we need to reset and increment
          const currentMatches = gameStore.stats.matchesFound;
          const targetMatches = value as number;
          if (targetMatches !== currentMatches) {
            console.warn(
              "Direct matches synchronization not fully supported - matches are managed by game actions"
            );
          }
          break;
        }
        case "timeElapsed":
          gameStore.updateTimeElapsed(value as number);
          break;
        case "difficulty":
          // Cannot directly set difficulty, would need to reinitialize game
          console.warn("Difficulty changes require game reinitialization");
          break;
        case "cards":
          // Cannot directly set cards, they are managed by the cards store
          console.warn("Cards cannot be directly synchronized");
          break;
        case "selectedCards":
          cardsStore.selectedCards.length = 0;
          cardsStore.selectedCards.push(...(value as string[]));
          break;
        case "matchedCards":
          // matchedCards is computed, cannot be directly set
          console.warn(
            "Matched cards are computed and cannot be directly synchronized"
          );
          break;
        case "revealedCards":
          // revealedCards is computed, cannot be directly set
          console.warn(
            "Revealed cards are computed and cannot be directly synchronized"
          );
          break;
        default:
          console.warn(`Unknown field for store update: ${field}`);
      }

      // Update store cache
      storeStateCache[field] = deepClone(value);

      await nextTick(); // Ensure reactivity updates
    } finally {
      state.isSyncing = false;
    }
  };

  /**
   * Apply store change to canvas (placeholder for canvas callback)
   */
  const applyStoreChangeToCanvas = async (
    field: string,
    value: unknown
  ): Promise<void> => {
    // This would be handled by canvas-specific callbacks
    // The canvas system would register callbacks for store changes
    canvasStateCache[field] = deepClone(value);
  };

  /**
   * Get current store value for field
   */
  const getStoreValue = (field: string): unknown => {
    switch (field) {
      case "isPlaying":
        return gameStore.isPlaying;
      case "score":
        return gameStore.currentScore;
      case "moves":
        return gameStore.stats.moves;
      case "matches":
        return gameStore.stats.matchesFound;
      case "timeElapsed":
        return gameStore.stats.timeElapsed;
      case "difficulty":
        return gameStore.difficulty;
      case "cards":
        return cardsStore.cards;
      case "selectedCards":
        return cardsStore.selectedCards;
      case "matchedCards":
        return cardsStore.matchedCards;
      case "revealedCards":
        return cardsStore.revealedCards;
      default:
        return undefined;
    }
  };

  /**
   * Rollback transaction
   */
  const rollbackTransaction = async (
    transaction: SyncTransaction
  ): Promise<void> => {
    console.warn(`Rolling back transaction ${transaction.id}`);

    // Restore previous values (simplified rollback)
    for (const change of transaction.changes.reverse()) {
      try {
        if (change.source === "canvas") {
          await applyCanvasChangeToStore(change.field, change.oldValue);
        }
      } catch (error) {
        console.error(
          `Error during rollback for field "${change.field}":`,
          error
        );
      }
    }
  };

  /**
   * Manually resolve conflict
   */
  const resolveConflict = async (
    conflictIndex: number,
    useCanvasValue: boolean
  ): Promise<void> => {
    const conflict = pendingConflicts[conflictIndex];
    if (!conflict) return;

    const resolvedValue = useCanvasValue
      ? conflict.canvasValue
      : conflict.storeValue;
    conflict.resolution = useCanvasValue ? "canvas" : "store";

    await applyResolvedValue(conflict.field, resolvedValue);
    conflict.resolved = true;

    // Remove from pending conflicts
    pendingConflicts.splice(conflictIndex, 1);
  };

  /**
   * Deep equality check
   */
  const deepEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === "object") {
      if (Array.isArray(a) !== Array.isArray(b)) return false;

      if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
          if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
      }

      const objA = a as Record<string, unknown>;
      const objB = b as Record<string, unknown>;
      const keysA = Object.keys(objA);
      const keysB = Object.keys(objB);

      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!deepEqual(objA[key], objB[key])) return false;
      }

      return true;
    }

    return false;
  };

  /**
   * Deep clone value
   */
  const deepClone = (value: unknown): unknown => {
    if (value === null || typeof value !== "object") return value;
    if (value instanceof Date) return new Date(value);
    if (Array.isArray(value)) return value.map(deepClone);

    const cloned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      cloned[key] = deepClone(val);
    }
    return cloned;
  };

  /**
   * Get synchronization stats
   */
  const getSyncStats = () => ({
    state: readonly(state),
    pendingConflicts: readonly(pendingConflicts),
    activeTransactions: activeTransactions.size,
    queuedChanges: changeQueue.length,
    fieldConfigs: readonly(FIELD_SYNC_CONFIGS),
  });

  /**
   * Force sync all fields
   */
  const forceSyncAll = (): void => {
    updateStoreCaches();
    console.log("Forced sync of all fields completed");
  };

  /**
   * Cleanup synchronization
   */
  const cleanup = (): void => {
    // Clear timers
    debounceTimers.forEach((timer) => clearTimeout(timer));
    debounceTimers.clear();

    if (batchUpdateTimer) {
      clearTimeout(batchUpdateTimer);
      batchUpdateTimer = null;
    }

    // Clear state
    changeQueue.length = 0;
    activeTransactions.clear();
    pendingConflicts.length = 0;

    state.isInitialized = false;
    console.log("Store synchronization cleaned up");
  };

  return {
    // State
    state: readonly(state),
    pendingConflicts: readonly(pendingConflicts),

    // Lifecycle
    initialize,
    cleanup,

    // Synchronization
    syncCanvasToStore,
    forceSyncAll,

    // Conflict resolution
    resolveConflict,

    // Analytics
    getSyncStats,
  };
};
