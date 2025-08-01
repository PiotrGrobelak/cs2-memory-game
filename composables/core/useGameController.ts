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

import { useGameUIStore } from "~/stores/game/ui";
import { useGameCoreStore } from "~/stores/game/core";
import { useGameCardsStore } from "~/stores/game/cards";
import { useGameTimerStore } from "~/stores/game/timer";

import { useCS2Data } from "~/composables/data/useCS2Data";
import { useGamePersistence } from "~/composables/data/useGamePersistence";

import { useGameSounds } from "~/composables/audio/useGameSounds";
import { useTimeFormatting } from "~/composables/utils/useTimeFormatting";

export interface GameControlV2State {
  isLoading: boolean;
  showFallbackUI: boolean;
  seedHistory: string[];
  autoSaveEnabled: boolean;
  lastAutoSave: number | null;
  hasUnfinishedGame: boolean;
}

export const useGameController = () => {
  const toast = useToast();
  const { initializeData } = useCS2Data();
  const {
    loadGameHistory,
    saveGameState,
    loadGameState,
    deleteGameState,
    saveGameResult,
  } = useGamePersistence();
  const gameSounds = useGameSounds();
  const { formatGameTime } = useTimeFormatting();

  const uiStore = useGameUIStore();
  const coreStore = useGameCoreStore();
  const cardsStore = useGameCardsStore();
  const timerStore = useGameTimerStore();

  const state = ref<GameControlV2State>({
    isLoading: false,
    showFallbackUI: false,
    seedHistory: [],
    autoSaveEnabled: true,
    lastAutoSave: null,
    hasUnfinishedGame: false,
  });

  // Canvas management - moved from CanvasContainer
  const canvasKey = ref(`canvas-${Date.now()}`);

  const buildCurrentGameState = () => {
    return {
      id: `${coreStore.seed}-${coreStore.difficulty.name}`,
      seed: coreStore.seed,
      difficulty: coreStore.difficulty,
      cards: cardsStore.cards,
      stats: {
        ...coreStore.stats,
        timeElapsed: Math.floor(timerStore.timeElapsed / 1000), // Convert to seconds
      },
      startTime: timerStore.startTime,
      isPlaying: coreStore.isPlaying,
      selectedCards: cardsStore.selectedCards,
      gameHistory: [],
    };
  };

  const autoSaveGameState = async () => {
    if (!state.value.autoSaveEnabled || state.value.isLoading) return;

    if (cardsStore.cards.length === 0) return;

    try {
      const gameState = buildCurrentGameState();
      const success = await saveGameState(gameState);

      if (success) {
        state.value.lastAutoSave = Date.now();
      }
    } catch (error) {
      console.error("❌ Auto-save failed:", error);
    }
  };

  // Setup lifecycle hooks immediately (before any await operations)
  // Auto-save when component unmounts if game is active
  onUnmounted(async () => {
    if (coreStore.isPlaying && cardsStore.cards.length > 0) {
      await autoSaveGameState();
    }
  });

  // Auto-save before page unload (when user closes tab/window)
  if (typeof window !== "undefined") {
    const handleBeforeUnload = async () => {
      if (coreStore.isPlaying && cardsStore.cards.length > 0) {
        await autoSaveGameState();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Clean up event listener on unmount
    onUnmounted(() => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    });
  }

  // TODO - one source of truth for difficulties!
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
    () => !state.value.isLoading && cardsStore.cards.length > 0,
  );

  const canResumeGame = computed(() => {
    return state.value.hasUnfinishedGame && !state.value.isLoading;
  });

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

  const restoreGameState = async (): Promise<boolean> => {
    try {
      state.value.isLoading = true;

      const savedState = await loadGameState();
      if (!savedState) {
        state.value.isLoading = false;
        return false;
      }

      coreStore.seed = savedState.seed;
      coreStore.difficulty = savedState.difficulty;
      coreStore.isPlaying = savedState.isPlaying;

      if (
        !savedState.isPlaying &&
        savedState.cards &&
        savedState.cards.length > 0
      ) {
        coreStore.isPaused = true;
      }

      coreStore.restoreStats(savedState.stats);

      cardsStore.restoreState(savedState.cards);

      timerStore.restoreTimer(savedState.stats.timeElapsed);

      await initializeData(100);

      toast.add({
        severity: "info",
        summary: "Game Resumed",
        detail: "Your previous game has been restored",
        life: 3000,
      });

      return true;
    } catch (error) {
      console.error("❌ Failed to restore game state:", error);
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
    } catch (error) {
      console.error("❌ Error checking for unfinished game:", error);
      state.value.hasUnfinishedGame = false;
    }
  };

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
      } else if (coreStore.isPlaying) {
        // Restart timer if game was playing
        timerStore.startTimer();
      }
    }

    return success;
  };

  const clearUnfinishedGame = async () => {
    try {
      await deleteGameState();
      state.value.hasUnfinishedGame = false;
    } catch (error) {
      console.error("❌ Failed to clear unfinished game:", error);
    }
  };

  const initializeGame = async (options: Partial<GameOptions> = {}) => {
    try {
      state.value.isLoading = true;

      timerStore.resetTimer();

      await coreStore.initializeGame(options);

      const difficulty = coreStore.difficulty;
      await initializeData(100);

      await cardsStore.generateCards(difficulty, coreStore.seed);

      await deleteGameState();
      state.value.hasUnfinishedGame = false;
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

  const startNewGame = async (options: Partial<GameOptions> = {}) => {
    await initializeGame(options);
    coreStore.startGame();
    timerStore.startTimer();

    await autoSaveGameState();
  };

  const pauseGame = async () => {
    coreStore.pauseGame();
    timerStore.pauseTimer();

    await autoSaveGameState();
  };

  const resumeGame = async () => {
    coreStore.resumeGame();
    timerStore.startTimer();

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

  const handleCanvasReady = () => {
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

  const handleCardClick = async (cardId: string) => {
    if (gameStatus.value !== "playing") return;

    const success = cardsStore.selectCard(cardId);

    if (success) {
      gameSounds.playCardFlip();

      if (cardsStore.selectedCards.length === 2) {
        const isMatch = cardsStore.checkForMatch();
        coreStore.incrementMoves();

        if (isMatch) {
          gameSounds.playMatch();

          coreStore.incrementMatches();

          const totalMatched = cardsStore.matchedCards.length / 2;
          const totalPairs = coreStore.stats.totalPairs;

          if (totalMatched >= totalPairs) {
            coreStore.completeGame();
          }
        }
      }
    }

    setTimeout(async () => {
      await autoSaveGameState();
    }, 500);
  };

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

  const openDialog = (dialogName: "newGame" | "settings") => {
    uiStore.openDialog(dialogName);
  };

  const closeDialog = (dialogName: "newGame" | "settings") => {
    uiStore.closeDialog(dialogName);
  };

  const resetCanvas = () => {
    canvasKey.value = `canvas-${Date.now()}`;
  };

  const handleSettingsApply = async (settings: {
    enableSound: boolean;
    enableParallax: boolean;
    volume?: number;
  }) => {
    try {
      uiStore.updateUIOption("enableSound", settings.enableSound);
      uiStore.updateUIOption("enableParallax", settings.enableParallax);

      if (settings.volume !== undefined) {
        uiStore.updateUIOption("volume", settings.volume);
      }

      closeDialog("settings");
      toast.add({
        severity: "success",
        summary: "Settings Applied",
        detail: "Settings updated successfully",
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

  const initialize = async () => {
    await nextTick();
    await loadSeedHistory();
    await checkForUnfinishedGame();
  };

  const setupWatchers = () => {
    watch(
      () => coreStore.isGameComplete,
      async (isComplete) => {
        if (isComplete) {
          const score = coreStore.currentScore;
          const timeElapsed = coreStore.stats.timeElapsed;
          const moves = coreStore.stats.moves;

          // timeElapsed is in seconds, convert to ms for formatGameTime
          const formattedTime = formatGameTime(timeElapsed * 1000);

          toast.add({
            severity: "success",
            summary: "🎉 Congratulations!",
            detail: `Game completed in ${formattedTime} with ${moves} moves. Score: ${score.toLocaleString()}`,
            life: 5000,
          });

          timerStore.stopTimer();

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
            if (!saveSuccess) {
              console.warn("⚠️ Failed to save game result to history");
            }
          } catch (error) {
            console.error("❌ Error saving game result:", error);
          }

          await deleteGameState();
          state.value.hasUnfinishedGame = false;
        }
      },
    );

    watch(
      () => timerStore.timeElapsed,
      (newTimeElapsed) => {
        const timeInSeconds = Math.floor(newTimeElapsed / 1000);
        coreStore.updateTimeElapsed(timeInSeconds);
      },
    );

    watch(
      () => [coreStore.stats.moves, cardsStore.matchedCards.length],
      async () => {
        if (coreStore.isPlaying) {
          await autoSaveGameState();
        }
      },
      { deep: true },
    );

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
      },
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

    restoreGameState,
    resumeUnfinishedGame,
    clearUnfinishedGame,
    autoSaveGameState,

    // Canvas management
    handleCanvasReady,
    handleCanvasError,
    handleCardClick,
    canvasKey: readonly(canvasKey),
    resetCanvas,

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
