/**
 * useGame - Unified game API composable for the CS2 Memory Game
 *
 * This composable provides a simplified, unified interface to the game's core functionality:
 * - Orchestrates interactions between multiple Pinia stores (core, cards, timer)
 * - Provides high-level game actions (start, pause, restart, card selection)
 * - Exposes reactive game state through store composition
 * - Handles game lifecycle management and state transitions
 * - Simplifies component integration by abstracting store complexity
 * - Maintains consistency between related game systems
 *
 * Key features:
 * - Single point of access for all game operations
 * - Reactive state composition from multiple stores
 * - Coordinated actions across game subsystems
 * - Game progress tracking and completion detection
 * - Helper functions for common game state queries
 * - Clean separation between game logic and UI components
 */
import { storeToRefs } from "pinia";
import { useGameCoreStore } from "~/stores/game/core";
import { useGameCardsStore } from "~/stores/game/cards";
import { useGameTimerStore } from "~/stores/game/timer";
import { useGameSounds } from "~/composables/audio/useGameSounds";
import type { GameOptions } from "~/types/game";

/**
 * Main game composable that orchestrates all game stores
 * Provides a unified API for components to interact with the game
 */
export const useGame = () => {
  // Initialize stores
  const coreStore = useGameCoreStore();
  const cardsStore = useGameCardsStore();
  const timerStore = useGameTimerStore();

  // Initialize audio
  const gameSounds = useGameSounds();

  // Extract reactive refs from stores
  const {
    gameId,
    seed,
    difficulty,
    isPlaying,
    stats,
    isGameComplete,
    currentScore,
    difficultySettings,
  } = storeToRefs(coreStore);

  const {
    cards,
    selectedCards,
    revealedCards,
    matchedCards,
    hiddenCards,
    selectedCardsData,
  } = storeToRefs(cardsStore);

  const {
    timeElapsed,
    isRunning: timerIsRunning,
    formattedTime,
    timeInSeconds,
  } = storeToRefs(timerStore);

  // Orchestrated actions
  const initializeNewGame = async (options: Partial<GameOptions> = {}) => {
    // Initialize core game state
    await coreStore.initializeGame(options);

    // Generate cards with the new difficulty and seed (now async)
    await cardsStore.generateCards(
      coreStore.difficultySettings,
      coreStore.seed
    );

    // Reset timer
    timerStore.resetTimer();
  };

  const startGame = () => {
    coreStore.startGame();
    timerStore.startTimer();
  };

  const pauseGame = () => {
    coreStore.pauseGame();
    timerStore.pauseTimer();
  };

  const resumeGame = () => {
    coreStore.resumeGame();
    timerStore.resumeTimer();
  };

  const selectCard = (cardId: string) => {
    if (!isPlaying.value) return false;

    // Select the card
    const cardSelected = cardsStore.selectCard(cardId);
    if (!cardSelected) return false;

    // Play card flip sound
    gameSounds.playCardFlip();

    // Increment moves in core store
    coreStore.incrementMoves();

    // Check for matches when two cards are selected
    if (selectedCards.value.length === 2) {
      const isMatch = cardsStore.checkForMatch();

      if (isMatch) {
        // Play match sound
        gameSounds.playMatch();

        coreStore.incrementMatches();

        // Check if game is complete
        if (stats.value.matchesFound === stats.value.totalPairs) {
          completeGame();
        }
      }
    }

    return true;
  };

  const completeGame = () => {
    // Update core store with final timer value
    coreStore.updateTimeElapsed(timerStore.getCurrentElapsedTime());

    // Complete the game
    coreStore.completeGame();
    timerStore.stopTimer();
  };

  const resetGame = () => {
    coreStore.resetGameState();
    cardsStore.resetCards();
    timerStore.resetTimer();
  };

  const restartGame = async () => {
    const currentOptions: Partial<GameOptions> = {
      difficulty: difficulty.value.name,
      seed: seed.value,
    };

    await initializeNewGame(currentOptions);
  };

  // Game state helpers
  const canSelectCard = (cardId: string): boolean => {
    if (!isPlaying.value) return false;
    if (selectedCards.value.length >= 2) return false;

    const card = cards.value.find((c) => c.id === cardId);
    return card ? card.state === "hidden" : false;
  };

  const getGameProgress = () => ({
    matchesFound: stats.value.matchesFound,
    totalPairs: stats.value.totalPairs,
    progressPercentage:
      stats.value.totalPairs > 0
        ? Math.round((stats.value.matchesFound / stats.value.totalPairs) * 100)
        : 0,
  });

  return {
    // State from stores
    gameId,
    seed,
    difficulty,
    isPlaying,
    stats,
    cards,
    selectedCards,
    timeElapsed,
    formattedTime,

    // Computed getters
    isGameComplete,
    currentScore,
    difficultySettings,
    revealedCards,
    matchedCards,
    hiddenCards,
    selectedCardsData,
    timeInSeconds,
    timerIsRunning,

    // Audio
    gameSounds,

    // Orchestrated actions
    initializeNewGame,
    startGame,
    pauseGame,
    resumeGame,
    selectCard,
    resetGame,
    restartGame,
    completeGame,

    // Helper functions
    canSelectCard,
    getGameProgress,
  };
};
