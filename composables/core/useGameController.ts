/**
 * useGameController - Main orchestrator composable for the CS2 Memory Game
 *
 * This composable serves as the central controller that coordinates all game systems:
 * - Manages game initialization sequence with proper error handling
 * - Orchestrates interactions between game engine, persistence, seed system, and CS2 data
 * - Handles game state management including save/load/restart operations
 * - Provides auto-save functionality and game session management
 * - Controls game flow from initialization through completion
 *
 * Key responsibilities:
 * - Initialize all subsystems in correct order
 * - Manage game options and seed-based gameplay
 * - Handle persistence operations for game state and history
 * - Coordinate new game creation and existing game restoration
 * - Provide unified interface for game lifecycle management
 */
import { ref, computed, watch, nextTick } from "vue";
import type { GameState, GameOptions, GameResult } from "~/types/game";

// Import all the composables we need to orchestrate
import { useGame } from "~/composables/core/useGame";
import { useCS2Data } from "~/composables/data/useCS2Data";
import { useSeedSystem } from "~/composables/data/useSeedSystem";
import { useGamePersistence } from "~/composables/data/useGamePersistence";
import { useGameCoreStore } from "~/stores/game/core";
import { useGameCardsStore } from "~/stores/game/cards";

export interface GameControllerState {
  isInitializing: boolean;
  initializationStep: string;
  error: string | null;
  lastAutoSave: number | null;
  hasUnsavedChanges: boolean;
}

export const useGameController = () => {
  // Initialize all systems
  const game = useGame();
  const cs2Data = useCS2Data();
  const seedSystem = useSeedSystem();
  const persistence = useGamePersistence();
  const coreStore = useGameCoreStore();
  const cardsStore = useGameCardsStore();

  // Controller state
  const state = ref<GameControllerState>({
    isInitializing: false,
    initializationStep: "",
    error: null,
    lastAutoSave: null,
    hasUnsavedChanges: false,
  });

  // Computed properties
  const isReady = computed(() => {
    return (
      !state.value.isInitializing &&
      cs2Data.hasItems.value &&
      seedSystem.isValidSeed.value
    );
  });

  const gameProgress = computed(() => {
    if (!game.stats.value) return 0;
    const { matchesFound, totalPairs } = game.stats.value;
    return totalPairs > 0 ? (matchesFound / totalPairs) * 100 : 0;
  });

  const gameStatus = computed(() => {
    if (state.value.isInitializing) return "initializing";
    if (!isReady.value) return "loading";
    if (game.isGameComplete.value) return "completed";
    if (game.isPlaying.value) return "playing";
    return "ready";
  });

  // Auto-save functionality
  const shouldAutoSave = computed(() => {
    return game.isPlaying.value && state.value.hasUnsavedChanges;
  });

  // Actions
  const initializeGame = async (
    options: Partial<GameOptions> = {}
  ): Promise<boolean> => {
    state.value.isInitializing = true;
    state.value.error = null;

    try {
      // Step 1: Initialize seed system
      state.value.initializationStep = "Initializing seed system...";
      seedSystem.initialize();

      // Step 2: Load CS2 data
      state.value.initializationStep = "Loading CS2 items...";
      await cs2Data.initializeData(100); // Load enough items for any difficulty

      if (!cs2Data.hasItems.value) {
        throw new Error("Failed to load CS2 items data");
      }

      // Step 3: Load saved options
      state.value.initializationStep = "Loading game options...";
      const savedOptions = await persistence.loadGameOptions();
      const finalOptions: GameOptions = {
        difficulty: "easy",
        enableSound: true,
        enableParallax: true,
        ...savedOptions,
        ...options,
      };

      // Step 4: Check for existing game state
      state.value.initializationStep = "Checking for saved game...";
      const savedGameState = await persistence.loadGameState();

      if (savedGameState && !options.seed) {
        // Continue existing game
        state.value.initializationStep = "Restoring saved game...";
        await restoreGameState(savedGameState);
      } else {
        // Start new game
        state.value.initializationStep = "Starting new game...";
        await startNewGame(finalOptions);
      }

      // Step 5: Save current options
      await persistence.saveGameOptions(finalOptions);

      state.value.initializationStep = "Ready!";
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown initialization error";
      state.value.error = errorMessage;
      console.error("Game controller initialization failed:", error);
      return false;
    } finally {
      state.value.isInitializing = false;
    }
  };

  const startNewGame = async (options: GameOptions): Promise<void> => {
    // Set seed if provided, otherwise use current one
    if (options.seed) {
      const seedSet = seedSystem.setCustomSeed(options.seed);
      if (!seedSet) {
        throw new Error("Invalid seed provided");
      }
    }

    // Get CS2 items for the game using the current seed
    const requiredItemCount = getDifficultyItemCount(options.difficulty);

    const gameItems = cs2Data.getItemsForGame(
      requiredItemCount,
      seedSystem.state.value.currentSeed
    );

    if (gameItems.length < requiredItemCount) {
      throw new Error(
        `Not enough CS2 items available. Required: ${requiredItemCount}, Available: ${gameItems.length}`
      );
    }

    // Initialize the game with these items
    await game.initializeNewGame(options);

    // Set the CS2 items in the cards store
    cardsStore.setCS2Items(gameItems);

    // Clear any previous save
    await persistence.deleteGameState();
    state.value.hasUnsavedChanges = false;
  };

  const restoreGameState = async (gameState: GameState): Promise<void> => {
    // Validate game state
    if (!gameState.seed) {
      console.warn("GameState has no seed, generating a new one");
      seedSystem.setRandomSeed();
    } else {
      // Restore seed
      const success = seedSystem.setSeed(gameState.seed, true);
      if (!success) {
        console.warn("Failed to set saved seed, generating a new one");
        seedSystem.setRandomSeed();
      }
    }

    // Restore game state
    await game.initializeNewGame({
      difficulty: gameState.difficulty.name,
      seed: seedSystem.state.value.currentSeed, // Use current seed instead of gameState.seed
    });

    // Restore cards and game progress
    cardsStore.restoreState(gameState.cards);
    coreStore.restoreStats(gameState.stats);

    if (gameState.isPlaying) {
      game.resumeGame();
    }

    state.value.hasUnsavedChanges = false;
  };

  const saveGame = async (): Promise<boolean> => {
    try {
      const currentGameState: GameState = {
        id: game.gameId.value,
        seed: game.seed.value,
        difficulty: game.difficulty.value,
        cards: game.cards.value,
        stats: game.stats.value,
        startTime: Date.now() - game.timeElapsed.value * 1000,
        isPlaying: game.isPlaying.value,
        selectedCards: game.selectedCards.value,
        gameHistory: [], // This will be loaded separately
      };

      const success = await persistence.saveGameState(currentGameState);
      if (success) {
        state.value.hasUnsavedChanges = false;
        state.value.lastAutoSave = Date.now();
      }
      return success;
    } catch (error) {
      console.error("Failed to save game:", error);
      return false;
    }
  };

  const completeGame = async (): Promise<void> => {
    // Complete the game
    game.completeGame();

    // Create game result for history
    const gameResult: GameResult = {
      id: game.gameId.value,
      seed: game.seed.value,
      difficulty: game.difficulty.value.name,
      moves: game.stats.value.moves,
      timeElapsed: game.timeElapsed.value,
      completedAt: new Date(),
      score: game.currentScore.value,
    };

    // Save to history
    await persistence.saveGameResult(gameResult);

    // Clear current game state
    await persistence.deleteGameState();
    state.value.hasUnsavedChanges = false;
  };

  const restartGame = async (): Promise<void> => {
    const currentOptions: GameOptions = {
      difficulty: game.difficulty.value.name,
      seed: game.seed.value,
      enableSound: true,
      enableParallax: true,
    };

    await startNewGame(currentOptions);
  };

  const newGameWithSeed = async (
    seed: string,
    difficulty?: GameOptions["difficulty"]
  ): Promise<boolean> => {
    try {
      const options: GameOptions = {
        difficulty: difficulty || "easy",
        seed,
        enableSound: true,
        enableParallax: true,
      };

      await startNewGame(options);
      return true;
    } catch (error) {
      console.error("Failed to start new game with seed:", error);
      return false;
    }
  };

  const shareCurrentGame = (): string => {
    if (!seedSystem.canShareSeed.value) {
      throw new Error("Current seed cannot be shared");
    }
    return seedSystem.generateShareUrl();
  };

  const clearAllData = async (): Promise<boolean> => {
    try {
      await persistence.clearAllData();
      cs2Data.clearCache();
      seedSystem.clearHistory();
      state.value.hasUnsavedChanges = false;
      state.value.lastAutoSave = null;
      return true;
    } catch (error) {
      console.error("Failed to clear all data:", error);
      return false;
    }
  };

  // Helper functions
  const getDifficultyItemCount = (
    difficulty: GameOptions["difficulty"]
  ): number => {
    switch (difficulty) {
      case "easy":
        return 6; // 12 cards / 2 (pairs)
      case "medium":
        return 12; // 24 cards / 2 (pairs)
      case "hard":
        return 24; // 48 cards / 2 (pairs)
      default:
        return 6;
    }
  };

  // Auto-save watcher
  watch(shouldAutoSave, async (should) => {
    if (should) {
      const timeSinceLastSave = state.value.lastAutoSave
        ? Date.now() - state.value.lastAutoSave
        : Infinity;

      // Auto-save every 30 seconds during gameplay
      if (timeSinceLastSave > 30000) {
        await saveGame();
      }
    }
  });

  // Watch for game state changes to mark as unsaved
  watch(
    [
      () => game.stats.value.moves,
      () => game.selectedCards.value.length,
      () => game.stats.value.matchesFound,
    ],
    () => {
      if (game.isPlaying.value) {
        state.value.hasUnsavedChanges = true;
      }
    }
  );

  // Watch for game completion
  watch(
    () => game.isGameComplete.value,
    async (isComplete) => {
      if (isComplete) {
        await nextTick();
        await completeGame();
      }
    }
  );

  return {
    // State
    state: readonly(state),

    // Computed
    isReady,
    gameProgress,
    gameStatus,
    shouldAutoSave,

    // Game state from orchestrated systems
    game,
    cs2Data,
    seedSystem,
    persistence,

    // Actions
    initializeGame,
    startNewGame,
    restoreGameState,
    saveGame,
    completeGame,
    restartGame,
    newGameWithSeed,
    shareCurrentGame,
    clearAllData,

    // Helpers
    getDifficultyItemCount,
  };
};
