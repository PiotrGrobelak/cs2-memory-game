import { defineStore } from "pinia";
import type {
  GameState,
  GameCard,
  GameOptions,
  GameResult,
  DifficultyLevel,
} from "~/types/game";

export const useGameStore = defineStore("game", {
  state: (): GameState => ({
    id: "",
    seed: "",
    difficulty: {
      name: "easy",
      cardCount: 12,
      gridSize: { rows: 3, cols: 4 },
    },
    cards: [],
    stats: {
      moves: 0,
      timeElapsed: 0,
      matchesFound: 0,
      totalPairs: 0,
      isComplete: false,
    },
    startTime: null,
    isPlaying: false,
    selectedCards: [],
    gameHistory: [],
  }),

  getters: {
    /**
     * Get the current game score based on time and moves
     */
    currentScore(): number {
      const { moves, timeElapsed } = this.stats;
      if (!timeElapsed) return 0;

      // Score calculation: base score minus penalties for time and moves
      const baseScore = 10000;
      const timePenalty = Math.floor(timeElapsed / 1000) * 10;
      const movePenalty = moves * 50;

      return Math.max(0, baseScore - timePenalty - movePenalty);
    },

    /**
     * Check if the current game is complete
     */
    isGameComplete(): boolean {
      return this.stats.isComplete;
    },

    /**
     * Get cards that are currently revealed
     */
    revealedCards(): GameCard[] {
      return this.cards.filter((card) => card.state === "revealed");
    },

    /**
     * Get cards that are already matched
     */
    matchedCards(): GameCard[] {
      return this.cards.filter((card) => card.state === "matched");
    },

    /**
     * Get the current difficulty settings
     */
    difficultySettings(): DifficultyLevel {
      return this.difficulty;
    },
  },

  actions: {
    /**
     * Initialize a new game with the specified options
     */
    async initializeGame(options: Partial<GameOptions> = {}) {
      // Reset game state
      this.resetGameState();

      // Set difficulty
      const difficulty = this.getDifficultyConfig(options.difficulty || "easy");
      this.difficulty = difficulty;

      // Generate or use provided seed
      this.seed = options.seed || this.generateSeed();
      this.id = `game-${Date.now()}-${this.seed}`;

      // Initialize stats
      this.stats = {
        moves: 0,
        timeElapsed: 0,
        matchesFound: 0,
        totalPairs: difficulty.cardCount / 2,
        isComplete: false,
      };

      // TODO: Generate cards with CS2 items (will be implemented in Step 7)
      this.cards = [];
    },

    /**
     * Start the game timer and set playing state
     */
    startGame() {
      this.isPlaying = true;
      this.startTime = Date.now();
    },

    /**
     * Pause the game
     */
    pauseGame() {
      this.isPlaying = false;
      if (this.startTime) {
        this.stats.timeElapsed += Date.now() - this.startTime;
        this.startTime = null;
      }
    },

    /**
     * Resume the game
     */
    resumeGame() {
      this.isPlaying = true;
      this.startTime = Date.now();
    },

    /**
     * Handle card selection
     */
    selectCard(cardId: string) {
      if (!this.isPlaying) return;

      const card = this.cards.find((c) => c.id === cardId);
      if (!card || card.state !== "hidden") return;

      // Reveal the card
      card.state = "revealed";
      this.selectedCards.push(cardId);

      // Check for matches when two cards are selected
      if (this.selectedCards.length === 2) {
        this.checkForMatch();
      }

      // Increment move counter
      this.stats.moves++;
    },

    /**
     * Check if the two selected cards match
     */
    checkForMatch() {
      const [firstCardId, secondCardId] = this.selectedCards;
      const firstCard = this.cards.find((c) => c.id === firstCardId);
      const secondCard = this.cards.find((c) => c.id === secondCardId);

      if (!firstCard || !secondCard) return;

      if (firstCard.pairId === secondCard.pairId) {
        // Match found
        firstCard.state = "matched";
        secondCard.state = "matched";
        this.stats.matchesFound++;

        // Check if game is complete
        if (this.stats.matchesFound === this.stats.totalPairs) {
          this.completeGame();
        }
      } else {
        // No match - hide cards after delay
        setTimeout(() => {
          firstCard.state = "hidden";
          secondCard.state = "hidden";
        }, 1000);
      }

      // Clear selected cards
      this.selectedCards = [];
    },

    /**
     * Complete the game and save result
     */
    completeGame() {
      this.pauseGame();
      this.stats.isComplete = true;

      const result: GameResult = {
        id: this.id,
        seed: this.seed,
        difficulty: this.difficulty.name,
        moves: this.stats.moves,
        timeElapsed: this.stats.timeElapsed,
        completedAt: new Date(),
        score: this.currentScore,
      };

      this.gameHistory.push(result);
      this.saveGameHistory();
    },

    /**
     * Reset the game state
     */
    resetGameState() {
      this.id = "";
      this.seed = "";
      this.cards = [];
      this.selectedCards = [];
      this.startTime = null;
      this.isPlaying = false;
      this.stats = {
        moves: 0,
        timeElapsed: 0,
        matchesFound: 0,
        totalPairs: 0,
        isComplete: false,
      };
    },

    /**
     * Generate a random seed for the game
     */
    generateSeed(): string {
      return (
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15)
      );
    },

    /**
     * Get difficulty configuration
     */
    getDifficultyConfig(name: "easy" | "medium" | "hard"): DifficultyLevel {
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
    },

    /**
     * Save game history to localStorage
     */
    saveGameHistory() {
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "cs2-memory-game-history",
          JSON.stringify(this.gameHistory)
        );
      }
    },

    /**
     * Load game history from localStorage
     */
    loadGameHistory() {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("cs2-memory-game-history");
        if (saved) {
          this.gameHistory = JSON.parse(saved);
        }
      }
    },
  },
});
