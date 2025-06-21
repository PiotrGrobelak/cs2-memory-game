import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { GameOptions, DifficultyLevel, GameStats } from "~/types/game";

export const useGameCoreStore = defineStore("game-core", () => {
  // State
  const gameId = ref("");
  const seed = ref("");
  const difficulty = ref<DifficultyLevel>({
    name: "easy",
    cardCount: 12,
    gridSize: { rows: 3, cols: 4 },
  });
  const isPlaying = ref(false);
  const stats = ref<GameStats>({
    moves: 0,
    timeElapsed: 0,
    matchesFound: 0,
    totalPairs: 0,
    isComplete: false,
  });

  // Getters (computed)
  const isGameComplete = computed(() => stats.value.isComplete);

  const currentScore = computed(() => {
    const { moves, timeElapsed } = stats.value;
    if (!timeElapsed) return 0;

    // Score calculation: base score minus penalties for time and moves
    const baseScore = 10000;
    const timePenalty = Math.floor(timeElapsed / 1000) * 10;
    const movePenalty = moves * 50;

    return Math.max(0, baseScore - timePenalty - movePenalty);
  });

  const difficultySettings = computed(() => difficulty.value);

  // Actions
  const initializeGame = async (options: Partial<GameOptions> = {}) => {
    // Reset game state
    resetGameState();

    // Set difficulty
    const difficultyConfig = getDifficultyConfig(options.difficulty || "easy");
    difficulty.value = difficultyConfig;

    // Generate or use provided seed
    seed.value = options.seed || generateSeed();
    gameId.value = `game-${Date.now()}-${seed.value}`;

    // Initialize stats
    stats.value = {
      moves: 0,
      timeElapsed: 0,
      matchesFound: 0,
      totalPairs: difficultyConfig.cardCount / 2,
      isComplete: false,
    };
  };

  const startGame = () => {
    isPlaying.value = true;
  };

  const pauseGame = () => {
    isPlaying.value = false;
  };

  const resumeGame = () => {
    isPlaying.value = true;
  };

  const resetGameState = () => {
    gameId.value = "";
    seed.value = "";
    isPlaying.value = false;
    stats.value = {
      moves: 0,
      timeElapsed: 0,
      matchesFound: 0,
      totalPairs: 0,
      isComplete: false,
    };
  };

  const incrementMoves = () => {
    stats.value.moves++;
  };

  const incrementMatches = () => {
    stats.value.matchesFound++;
  };

  const completeGame = () => {
    pauseGame();
    stats.value.isComplete = true;
  };

  const updateTimeElapsed = (time: number) => {
    stats.value.timeElapsed = time;
  };

  const restoreStats = (savedStats: GameStats) => {
    stats.value = { ...savedStats };
  };

  // Helper functions
  const generateSeed = (): string => {
    // Generate a truly unique seed by combining multiple entropy sources
    const timestamp = Date.now().toString(36);
    const performance =
      typeof window !== "undefined" && window.performance
        ? window.performance.now().toString(36)
        : Math.random().toString(36);
    const random1 = Math.random().toString(36).substring(2);
    const random2 = Math.random().toString(36).substring(2);

    // Create a base seed from multiple entropy sources
    let baseSeed = `${timestamp}-${performance}-${random1}-${random2}`;

    // Ensure minimum length of 20 characters by adding more randomness if needed
    while (baseSeed.length < 20) {
      baseSeed += Math.random().toString(36).substring(2);
    }

    // Limit to reasonable length and remove any non-alphanumeric characters
    return baseSeed.replace(/[^a-z0-9]/g, "").substring(0, 32);
  };

  const getDifficultyConfig = (
    name: "easy" | "medium" | "hard"
  ): DifficultyLevel => {
    const configs = {
      easy: {
        name: "easy" as const,
        cardCount: 12 as const,
        gridSize: { rows: 3, cols: 4 },
      },
      medium: {
        name: "medium" as const,
        cardCount: 24 as const,
        gridSize: { rows: 4, cols: 6 },
      },
      hard: {
        name: "hard" as const,
        cardCount: 48 as const,
        gridSize: { rows: 6, cols: 8 },
      },
    };
    return configs[name];
  };

  return {
    // State
    gameId,
    seed,
    difficulty,
    isPlaying,
    stats,

    // Getters
    isGameComplete,
    currentScore,
    difficultySettings,

    // Actions
    initializeGame,
    startGame,
    pauseGame,
    resumeGame,
    resetGameState,
    incrementMoves,
    incrementMatches,
    completeGame,
    updateTimeElapsed,
    restoreStats,
  };
});
