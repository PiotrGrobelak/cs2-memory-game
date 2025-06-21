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
import { useGameTimerStore } from "~/stores/game/timer";

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
  const timerStore = useGameTimerStore();
  // Controller state
  const state = ref<GameControllerState>({
    isInitializing: false,
    initializationStep: "",
    error: null,
    lastAutoSave: null,
    hasUnsavedChanges: false,
  });

  // Track saved game state for UI decisions
  const savedGameInfo = ref<{
    exists: boolean;
    wasPlaying: boolean;
    difficulty: string;
    progress: number;
  }>({
    exists: false,
    wasPlaying: false,
    difficulty: "",
    progress: 0,
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
    if (state.value.error) return "error";
    if (game.isGameComplete.value) return "completed";
    if (game.isPlaying.value) return "playing";
    return "ready";
  });

  const canContinueSavedGame = computed(() => {
    return savedGameInfo.value.exists && gameStatus.value === "ready";
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
      state.value.initializationStep = "Initializing seed system...";

      seedSystem.initialize();
      timerStore.resetTimer();
      state.value.initializationStep = "Loading CS2 items...";

      await cs2Data.initializeData(100);

      if (!cs2Data.hasItems.value) {
        throw new Error("Failed to load CS2 items data");
      }

      state.value.initializationStep = "Loading game options...";

      const savedOptions = await persistence.loadGameOptions();

      const finalOptions: GameOptions = {
        difficulty: "easy",
        enableSound: true,
        enableParallax: true,
        ...savedOptions,
        ...options,
      };

      state.value.initializationStep = "Checking for saved game...";
      const savedGameState = await persistence.loadGameState();

      if (savedGameState && !options.seed) {
        // Update saved game info for UI
        savedGameInfo.value = {
          exists: true,
          wasPlaying: savedGameState.isPlaying,
          difficulty: savedGameState.difficulty.name,
          progress:
            (savedGameState.stats.matchesFound /
              savedGameState.stats.totalPairs) *
            100,
        };

        // Restore existing game but don't auto-start it
        state.value.initializationStep = "Restoring saved game...";
        await restoreGameStateWithoutAutoStart(savedGameState);
      } else {
        // No saved game exists
        savedGameInfo.value = {
          exists: false,
          wasPlaying: false,
          difficulty: "",
          progress: 0,
        };

        // Prepare new game but don't auto-start it
        state.value.initializationStep = "Preparing new game...";
        await prepareNewGame(finalOptions);
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

  const prepareNewGame = async (options: GameOptions): Promise<void> => {
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

    // Initialize the game with these items but don't start it
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

  const restoreGameStateWithoutAutoStart = async (
    gameState: GameState
  ): Promise<void> => {
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

    // Don't auto-resume the game, let the user decide
    // Note: Game will be in 'ready' state and user can click "Continue Game" or "Start Game"

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

  const continueSavedGame = async (): Promise<boolean> => {
    try {
      if (!canContinueSavedGame.value) {
        throw new Error("No saved game available to continue");
      }

      // Load the saved game state
      const savedGameState = await persistence.loadGameState();
      if (!savedGameState) {
        throw new Error("Saved game state not found");
      }

      // If the saved game was in playing state, resume it
      if (savedGameState.isPlaying) {
        game.resumeGame();
      } else {
        // If it was paused, just start the game
        game.startGame();
      }

      return true;
    } catch (error) {
      console.error("Failed to continue saved game:", error);
      return false;
    }
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
    canContinueSavedGame,

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
    continueSavedGame,
    newGameWithSeed,
    shareCurrentGame,
    clearAllData,

    // Helpers
    getDifficultyItemCount,
  };
};
