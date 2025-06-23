/**
 * useGameControlV2 - Simplified game orchestrator based on working GameInterface.vue logic
 *
 * This composable provides a clean, simplified API for game management:
 * - Direct store integration without complex orchestration
 * - Canvas and fallback UI state management
 * - Simplified game initialization and controls
 * - Dialog state management
 * - Game sharing functionality
 * - Timer synchronization with game stats
 *
 * Key improvements over useGameController:
 * - Simplified initialization without complex error handling
 * - Direct store usage pattern like successful GameInterface.vue
 * - Canvas state management included
 * - Integrated dialog management
 * - Cleaner separation of concerns
 */
import { ref, computed, watch, nextTick, onUnmounted } from "vue";
import type { GameOptions, GameResult } from "~/types/game";
import { useToast } from "primevue/usetoast";

// Stores - Direct usage like GameInterface.vue
import { useGameUIStore } from "~/stores/game/ui";
import { useGameCoreStore } from "~/stores/game/core";
import { useGameCardsStore } from "~/stores/game/cards";
import { useGameTimerStore } from "~/stores/game/timer";

// Data composables
import { useCS2Data } from "~/composables/data/useCS2Data";
import { useGamePersistence } from "~/composables/data/useGamePersistence";

export interface GameControlV2State {
  isLoading: boolean;
  showFallbackUI: boolean;
  seedHistory: string[];
  autoSaveEnabled: boolean;
  lastAutoSave: number | null;
  hasUnfinishedGame: boolean;
}

export const useGameController = () => {
  // Initialize composables
  const toast = useToast();
  const { initializeData } = useCS2Data();
  const {
    loadGameHistory,
    saveGameState,
    loadGameState,
    deleteGameState,
    saveGameResult,
  } = useGamePersistence();

  // Initialize stores
  const uiStore = useGameUIStore();
  const coreStore = useGameCoreStore();
  const cardsStore = useGameCardsStore();
  const timerStore = useGameTimerStore();

  // Local state
  const state = ref<GameControlV2State>({
    isLoading: false,
    showFallbackUI: false,
    seedHistory: [],
    autoSaveEnabled: true,
    lastAutoSave: null,
    hasUnfinishedGame: false,
  });

  // Build complete game state for persistence - declare early for lifecycle hooks
  const buildCurrentGameState = () => {
    return {
      id: `${coreStore.seed}-${coreStore.difficulty.name}`,
      seed: coreStore.seed,
      difficulty: coreStore.difficulty,
      cards: cardsStore.cards,
      stats: {
        ...coreStore.stats,
        timeElapsed: timerStore.timeElapsed, // Use actual timer value
      },
      startTime: timerStore.startTime,
      isPlaying: coreStore.isPlaying,
      selectedCards: cardsStore.selectedCards,
      gameHistory: [],
    };
  };

  // Auto-save functionality for US-013 - declare early for lifecycle hooks
  const autoSaveGameState = async () => {
    console.log("🔄 Auto-saving game state");
    if (!state.value.autoSaveEnabled || state.value.isLoading) return;

    // Only save if game is active and has content
    if (cardsStore.cards.length === 0) return;

    try {
      const gameState = buildCurrentGameState();
      const success = await saveGameState(gameState);

      if (success) {
        state.value.lastAutoSave = Date.now();
        console.log("🎮 Game state auto-saved");
      }
    } catch (error) {
      console.error("❌ Auto-save failed:", error);
    }
  };

  // Setup lifecycle hooks immediately (before any await operations)
  // Auto-save when component unmounts if game is active
  onUnmounted(async () => {
    if (coreStore.isPlaying && cardsStore.cards.length > 0) {
      console.log("🔄 Component unmounting - auto-saving active game");
      await autoSaveGameState();
      console.log("💾 Game state saved before component unmount");
    }
  });

  // Auto-save before page unload (when user closes tab/window)
  if (typeof window !== "undefined") {
    const handleBeforeUnload = async () => {
      if (coreStore.isPlaying && cardsStore.cards.length > 0) {
        console.log("🚪 Page unloading - auto-saving active game");
        await autoSaveGameState();
        console.log("💾 Game state saved before page unload");
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Clean up event listener on unmount
    onUnmounted(() => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    });
  }

  // Difficulty configurations
  const difficulties = computed(() => [
    {
      name: "easy" as const,
      label: "Easy",
      cardCount: 12,
      gridSize: { rows: 3, cols: 4 },
    },
    {
      name: "medium" as const,
      label: "Medium",
      cardCount: 18,
      gridSize: { rows: 3, cols: 6 },
    },
    {
      name: "hard" as const,
      label: "Hard",
      cardCount: 24,
      gridSize: { rows: 4, cols: 6 },
    },
  ]);

  // Computed properties - Direct from stores
  const gameStatus = computed(() => {
    if (state.value.isLoading) return "initializing";
    if (!coreStore.isPlaying && cardsStore.cards.length === 0) return "ready";
    if (coreStore.isPlaying) return "playing";
    if (coreStore.isPaused && cardsStore.cards.length > 0) return "paused";
    if (coreStore.isGameComplete) return "completed";
    return "ready";
  });

  const gameProgress = computed(() => {
    if (cardsStore.cards.length === 0) return 0;
    const totalPairs = coreStore.stats.totalPairs;
    const matchedPairs = coreStore.stats.matchesFound;
    return totalPairs > 0 ? (matchedPairs / totalPairs) * 100 : 0;
  });

  const canShare = computed(() => cardsStore.cards.length > 0);

  const isGameReady = computed(
    () => !state.value.isLoading && cardsStore.cards.length > 0
  );

  // New computed - check if there's an active game that can be resumed
  const canResumeGame = computed(() => {
    return state.value.hasUnfinishedGame && !state.value.isLoading;
  });

  // Seed validator
  const seedValidator = (seed: string) => {
    if (!seed.trim()) {
      return { isValid: false, error: "Seed cannot be empty" };
    }
    if (seed.length < 3) {
      return { isValid: false, error: "Seed must be at least 3 characters" };
    }
    if (seed.length > 50) {
      return { isValid: false, error: "Seed must be less than 50 characters" };
    }
    return { isValid: true, error: null };
  };

  // Restore game state from persistence
  const restoreGameState = async (): Promise<boolean> => {
    try {
      state.value.isLoading = true;

      const savedState = await loadGameState();
      if (!savedState) {
        console.log("🔄 No saved game state found");
        state.value.isLoading = false;
        return false;
      }

      console.log("🔄 Restoring game state...", savedState);

      // Restore core state
      coreStore.seed = savedState.seed;
      coreStore.difficulty = savedState.difficulty;
      coreStore.isPlaying = savedState.isPlaying;

      // If the saved game wasn't playing, it should be in paused state
      if (
        !savedState.isPlaying &&
        savedState.cards &&
        savedState.cards.length > 0
      ) {
        coreStore.isPaused = true;
      }

      coreStore.restoreStats(savedState.stats);

      // Restore cards state
      console.log("🔄 Restoring cards...", {
        savedCardsCount: savedState.cards?.length || 0,
        currentCardsCount: cardsStore.cards.length,
      });

      cardsStore.restoreState(savedState.cards);

      console.log("🔄 Cards restored", {
        restoredCardsCount: cardsStore.cards.length,
        firstCard: cardsStore.cards[0]?.id || "none",
      });

      // Restore timer state - critical for US-013
      timerStore.restoreTimer(savedState.stats.timeElapsed);

      // Initialize CS2 data if needed
      await initializeData(100);

      // Don't clear hasUnfinishedGame here - let the UI handle the state properly
      console.log("✅ Game state restored successfully");

      toast.add({
        severity: "info",
        summary: "Game Resumed",
        detail: "Your previous game has been restored",
        life: 3000,
      });

      return true;
    } catch (error) {
      console.error("❌ Failed to restore game state:", error);
      // Clear corrupted save data
      await deleteGameState();
      state.value.hasUnfinishedGame = false;

      toast.add({
        severity: "warn",
        summary: "Resume Failed",
        detail: "Could not restore previous game",
        life: 3000,
      });

      return false;
    } finally {
      state.value.isLoading = false;
    }
  };

  // Check for unfinished games on initialization
  const checkForUnfinishedGame = async () => {
    try {
      const savedState = await loadGameState();
      // A game is considered unfinished if:
      // 1. It was playing (isPlaying: true)
      // 2. It was paused (isPaused: true)
      // 3. It has cards and is not completed
      state.value.hasUnfinishedGame = !!(
        savedState &&
        (savedState.isPlaying ||
          (savedState.cards &&
            savedState.cards.length > 0 &&
            !savedState.stats.isComplete))
      );

      if (state.value.hasUnfinishedGame) {
        console.log("🎮 Unfinished game found, seed:", savedState?.seed);
        console.log(
          "🎮 Game state - isPlaying:",
          savedState?.isPlaying,
          "cards:",
          savedState?.cards?.length
        );
      }
    } catch (error) {
      console.error("❌ Error checking for unfinished game:", error);
      state.value.hasUnfinishedGame = false;
    }
  };

  // Resume unfinished game
  const resumeUnfinishedGame = async (): Promise<boolean> => {
    if (!state.value.hasUnfinishedGame) return false;

    const success = await restoreGameState();
    if (success) {
      // Wait for next tick to ensure proper DOM updates before canvas rendering
      await nextTick();

      // Give additional time for canvas dimensions to be calculated properly
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Clear the unfinished game flag after successful restoration
      state.value.hasUnfinishedGame = false;

      // If the game was paused, resume it
      if (coreStore.isPaused) {
        coreStore.resumeGame();
        timerStore.startTimer();
        console.log("⏰ Timer resumed from paused state");
      } else if (coreStore.isPlaying) {
        // Restart timer if game was playing
        timerStore.startTimer();
        console.log("⏰ Timer resumed from playing state");
      }
    }

    return success;
  };

  // Clear unfinished game data
  const clearUnfinishedGame = async () => {
    try {
      await deleteGameState();
      state.value.hasUnfinishedGame = false;
      console.log("🗑️ Unfinished game data cleared");
    } catch (error) {
      console.error("❌ Failed to clear unfinished game:", error);
    }
  };

  // Game initialization - Simplified like GameInterface.vue
  const initializeGame = async (options: Partial<GameOptions> = {}) => {
    try {
      state.value.isLoading = true;

      // Reset timer first
      timerStore.resetTimer();

      // Initialize core game settings
      await coreStore.initializeGame(options);

      // Load CS2 data - simple like weapon.vue
      const difficulty = coreStore.difficulty;
      await initializeData(100); // Load 100 items like analysis suggests

      // Generate cards with Pinia store
      await cardsStore.generateCards(difficulty, coreStore.seed);

      // Clear any existing save data for fresh start
      await deleteGameState();
      state.value.hasUnfinishedGame = false;

      console.log(
        `🎮 Game initialized: ${difficulty.name} mode with ${cardsStore.cards.length} cards`
      );
    } catch (error) {
      console.error("Failed to initialize game:", error);
      toast.add({
        severity: "error",
        summary: "Initialization Failed",
        detail: "Could not load game data",
        life: 5000,
      });
      throw error;
    } finally {
      state.value.isLoading = false;
    }
  };

  // Game actions - Simplified
  const startNewGame = async (options: Partial<GameOptions> = {}) => {
    await initializeGame(options);
    coreStore.startGame();
    timerStore.startTimer();

    // Perform initial auto-save
    await autoSaveGameState();

    console.log("🕐 Timer started, isRunning:", timerStore.isRunning);
  };

  const pauseGame = async () => {
    coreStore.pauseGame();
    timerStore.pauseTimer();

    // Auto-save when pausing
    await autoSaveGameState();
  };

  const resumeGame = async () => {
    coreStore.resumeGame();
    timerStore.startTimer();

    // Auto-save when resuming
    await autoSaveGameState();
  };

  const playAgain = async () => {
    const currentDifficulty = coreStore.difficulty.name;
    await startNewGame({ difficulty: currentDifficulty });
  };

  const restartGame = async () => {
    const currentOptions = {
      difficulty: coreStore.difficulty.name,
      seed: coreStore.seed,
    };
    await startNewGame(currentOptions);
  };

  // Canvas management
  const handleCanvasReady = () => {
    console.log("✅ Game canvas ready");
    state.value.showFallbackUI = false;
  };

  const handleCanvasError = (error?: string) => {
    console.error("❌ Canvas error:", error);
    state.value.showFallbackUI = true;
    toast.add({
      severity: "warn",
      summary: "Rendering Issue",
      detail: "Switched to fallback interface",
      life: 3000,
    });
  };

  // Enhanced card interaction with auto-save
  const handleCardClick = async (cardId: string) => {
    if (gameStatus.value !== "playing") return;
    console.log(`🎯 Card clicked: ${cardId}`);

    // Auto-save after each move (with debouncing)
    setTimeout(async () => {
      await autoSaveGameState();
    }, 500);
  };

  // Game sharing
  const shareGame = async () => {
    try {
      const shareUrl = `${window.location.origin}${window.location.pathname}?seed=${coreStore.seed}&difficulty=${coreStore.difficulty.name}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.add({
        severity: "success",
        summary: "Shared!",
        detail: "Game URL copied to clipboard",
        life: 3000,
      });
    } catch (error) {
      console.error("Failed to share game:", error);
      toast.add({
        severity: "error",
        summary: "Share Failed",
        detail: "Could not copy URL to clipboard",
        life: 3000,
      });
    }
  };

  // Dialog management
  const openDialog = (dialogName: "newGame" | "settings") => {
    uiStore.openDialog(dialogName);
  };

  const closeDialog = (dialogName: "newGame" | "settings") => {
    uiStore.closeDialog(dialogName);
  };

  // Settings handler
  const handleSettingsApply = async (settings: {
    enableSound: boolean;
    enableParallax: boolean;
  }) => {
    try {
      uiStore.updateUIOption("enableSound", settings.enableSound);
      uiStore.updateUIOption("enableParallax", settings.enableParallax);

      closeDialog("settings");
      toast.add({
        severity: "success",
        summary: "Settings Applied",
        detail: "New game started with updated settings",
        life: 3000,
      });
    } catch (error) {
      console.error("Failed to apply settings:", error);
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "Failed to apply settings",
        life: 3000,
      });
    }
  };

  // New game handler
  const handleNewGameStart = async (options: {
    difficulty: "easy" | "medium" | "hard";
    seed?: string;
  }) => {
    try {
      await startNewGame(options);
      closeDialog("newGame");
      toast.add({
        severity: "success",
        summary: "New Game Started",
        detail: `Started ${options.difficulty} difficulty game`,
        life: 3000,
      });
    } catch (error) {
      console.error("Failed to start new game:", error);
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "Failed to start new game",
        life: 3000,
      });
    }
  };

  // Seed history management
  const loadSeedHistory = async () => {
    try {
      const history = await loadGameHistory();
      state.value.seedHistory = [
        ...new Set(history.map((h: GameResult) => h.seed).filter(Boolean)),
      ].slice(0, 10); // Last 10 unique seeds
    } catch (error) {
      console.error("Failed to load seed history:", error);
      state.value.seedHistory = [];
    }
  };

  // Enhanced initialization with unfinished game check
  const initialize = async () => {
    await nextTick();
    await loadSeedHistory();
    await checkForUnfinishedGame();

    // Don't auto-start game, let user decide
    if (state.value.hasUnfinishedGame) {
      console.log("🎮 Found unfinished game - user can choose to resume");
    }
  };

  // Setup watchers with auto-save integration
  const setupWatchers = () => {
    // Watch for game completion
    watch(
      () => coreStore.isGameComplete,
      async (isComplete) => {
        if (isComplete) {
          const score = coreStore.currentScore;
          const timeElapsed = coreStore.stats.timeElapsed;
          const moves = coreStore.stats.moves;

          const minutes = Math.floor(timeElapsed / 60);
          const seconds = Math.floor(timeElapsed % 60);
          const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

          toast.add({
            severity: "success",
            summary: "🎉 Congratulations!",
            detail: `Game completed in ${formattedTime} with ${moves} moves. Score: ${score.toLocaleString()}`,
            life: 5000,
          });

          timerStore.stopTimer();

          // Save completed game to history collection (US-014)
          try {
            const gameResult = {
              id: `${coreStore.seed}-${coreStore.difficulty.name}-${Date.now()}`,
              seed: coreStore.seed,
              difficulty: coreStore.difficulty.name,
              moves: moves,
              timeElapsed: timeElapsed,
              completedAt: new Date(),
              score: score,
            };

            const saveSuccess = await saveGameResult(gameResult);
            if (saveSuccess) {
              console.log("✅ Game result saved to history");
            } else {
              console.warn("⚠️ Failed to save game result to history");
            }
          } catch (error) {
            console.error("❌ Error saving game result:", error);
          }

          // Clear saved game state on completion
          await deleteGameState();
          state.value.hasUnfinishedGame = false;
        }
      }
    );

    // Sync timer store with core store stats
    watch(
      () => timerStore.timeElapsed,
      (newTimeElapsed) => {
        coreStore.updateTimeElapsed(newTimeElapsed);
      }
    );

    // Auto-save on significant game state changes
    watch(
      () => [coreStore.stats.moves, cardsStore.matchedCards.length],
      async () => {
        if (coreStore.isPlaying) {
          await autoSaveGameState();
        }
      },
      { deep: true }
    );

    // Auto-save periodically during active gameplay (every 30 seconds)
    watch(
      () => timerStore.isRunning,
      (isRunning) => {
        if (isRunning) {
          const interval = setInterval(async () => {
            if (timerStore.isRunning && coreStore.isPlaying) {
              await autoSaveGameState();
            } else {
              clearInterval(interval);
            }
          }, 30000); // 30 seconds
        }
      }
    );
  };

  return {
    // State
    state,

    // Computed
    gameStatus,
    gameProgress,
    canShare,
    isGameReady,
    difficulties,
    canResumeGame,

    // Store references
    uiStore,
    coreStore,
    cardsStore,
    timerStore,

    // Game actions
    initializeGame,
    startNewGame,
    pauseGame,
    resumeGame,
    playAgain,
    restartGame,

    // US-013 - Resume interrupted game functionality
    restoreGameState,
    resumeUnfinishedGame,
    clearUnfinishedGame,
    autoSaveGameState,

    // Canvas management
    handleCanvasReady,
    handleCanvasError,
    handleCardClick,

    // Sharing
    shareGame,

    // Dialog management
    openDialog,
    closeDialog,

    // Dialog handlers
    handleSettingsApply,
    handleNewGameStart,

    // Utilities
    seedValidator,
    loadSeedHistory,
    initialize,
    setupWatchers,
  };
};
