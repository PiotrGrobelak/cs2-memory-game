import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGameCoreStore } from "~/stores/game/core";
import type { GameOptions } from "~/types/game";

describe("Game Core Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("Initial State", () => {
    it("should initialize with correct default state", () => {
      const store = useGameCoreStore();

      expect(store.gameId).toBe("");
      expect(store.seed).toBe("");
      expect(store.isPlaying).toBe(false);
      expect(store.stats.moves).toBe(0);
      expect(store.stats.timeElapsed).toBe(0);
      expect(store.stats.matchesFound).toBe(0);
      expect(store.stats.totalPairs).toBe(0);
      expect(store.stats.isComplete).toBe(false);
      expect(store.difficulty.name).toBe("easy");
      expect(store.difficulty.cardCount).toBe(12);
      expect(store.difficulty.gridSize).toEqual({ rows: 3, cols: 4 });
    });
  });

  describe("Game Initialization", () => {
    it("should initialize game with default options", async () => {
      const store = useGameCoreStore();

      await store.initializeGame();

      expect(store.gameId).toMatch(/^game-\d+-/);
      expect(store.seed).toBeTruthy();
      expect(store.seed.length).toBeGreaterThanOrEqual(20);
      expect(store.difficulty.name).toBe("easy");
      expect(store.stats.totalPairs).toBe(6); // 12 cards = 6 pairs
      expect(store.stats.moves).toBe(0);
      expect(store.stats.matchesFound).toBe(0);
      expect(store.stats.isComplete).toBe(false);
    });

    it("should initialize game with custom difficulty", async () => {
      const store = useGameCoreStore();
      const options: Partial<GameOptions> = { difficulty: "medium" };

      await store.initializeGame(options);

      expect(store.difficulty.name).toBe("medium");
      expect(store.difficulty.cardCount).toBe(18);
      expect(store.difficulty.gridSize).toEqual({ rows: 3, cols: 6 });
      expect(store.stats.totalPairs).toBe(9); // 18 cards = 9 pairs
    });

    it("should initialize game with hard difficulty", async () => {
      const store = useGameCoreStore();
      const options: Partial<GameOptions> = { difficulty: "hard" };

      await store.initializeGame(options);

      expect(store.difficulty.name).toBe("hard");
      expect(store.difficulty.cardCount).toBe(24);
      expect(store.difficulty.gridSize).toEqual({ rows: 4, cols: 6 });
      expect(store.stats.totalPairs).toBe(12); // 24 cards = 12 pairs
    });

    it("should use provided seed", async () => {
      const store = useGameCoreStore();
      const customSeed = "test-seed-123456789";

      await store.initializeGame({ seed: customSeed });

      expect(store.seed).toBe(customSeed);
      expect(store.gameId).toContain(customSeed);
    });

    it("should generate unique seeds", async () => {
      // Create separate Pinia instances to ensure truly independent stores
      const pinia1 = createPinia();
      const pinia2 = createPinia();

      setActivePinia(pinia1);
      const store1 = useGameCoreStore();

      setActivePinia(pinia2);
      const store2 = useGameCoreStore();

      await store1.initializeGame();
      await store2.initializeGame();

      expect(store1.seed).not.toBe(store2.seed);
    });
  });

  describe("Game Flow Control", () => {
    it("should start game correctly", async () => {
      const store = useGameCoreStore();
      await store.initializeGame();

      store.startGame();

      expect(store.isPlaying).toBe(true);
    });

    it("should pause game correctly", async () => {
      const store = useGameCoreStore();
      await store.initializeGame();
      store.startGame();

      store.pauseGame();

      expect(store.isPlaying).toBe(false);
    });

    it("should resume game correctly", async () => {
      const store = useGameCoreStore();
      await store.initializeGame();
      store.startGame();
      store.pauseGame();

      store.resumeGame();

      expect(store.isPlaying).toBe(true);
    });

    it("should complete game correctly", async () => {
      const store = useGameCoreStore();
      await store.initializeGame();
      store.startGame();

      store.completeGame();

      expect(store.isPlaying).toBe(false);
      expect(store.stats.isComplete).toBe(true);
    });
  });

  describe("Stats Management", () => {
    it("should increment moves correctly", async () => {
      const store = useGameCoreStore();
      await store.initializeGame();

      expect(store.stats.moves).toBe(0);

      store.incrementMoves();
      expect(store.stats.moves).toBe(1);

      store.incrementMoves();
      expect(store.stats.moves).toBe(2);
    });

    it("should increment matches correctly", async () => {
      const store = useGameCoreStore();
      await store.initializeGame();

      expect(store.stats.matchesFound).toBe(0);

      store.incrementMatches();
      expect(store.stats.matchesFound).toBe(1);

      store.incrementMatches();
      expect(store.stats.matchesFound).toBe(2);
    });

    it("should update time elapsed", async () => {
      const store = useGameCoreStore();
      await store.initializeGame();

      store.updateTimeElapsed(5000);

      expect(store.stats.timeElapsed).toBe(5000);
    });
  });

  describe("Score Calculation", () => {
    it("should return zero score when no time elapsed", async () => {
      const store = useGameCoreStore();
      await store.initializeGame();

      // No time elapsed
      expect(store.currentScore).toBe(0);
    });

    it("should calculate score with time penalty only", async () => {
      const store = useGameCoreStore();
      await store.initializeGame();

      store.updateTimeElapsed(10000); // 10 seconds
      // Expected: 10000 - (10 * 10) = 9900
      expect(store.currentScore).toBe(9900);
    });

    it("should calculate score with move penalty only", async () => {
      const store = useGameCoreStore();
      await store.initializeGame();

      store.updateTimeElapsed(1000); // 1 second to avoid zero
      for (let i = 0; i < 5; i++) {
        store.incrementMoves();
      }
      // Expected: 10000 - (1 * 10) - (5 * 50) = 9740
      expect(store.currentScore).toBe(9740);
    });

    it("should calculate score with both time and move penalties", async () => {
      const store = useGameCoreStore();
      await store.initializeGame();

      store.updateTimeElapsed(30000); // 30 seconds
      for (let i = 0; i < 10; i++) {
        store.incrementMoves();
      }
      // Expected: 10000 - (30 * 10) - (10 * 50) = 9200
      expect(store.currentScore).toBe(9200);
    });

    it("should not return negative score", async () => {
      const store = useGameCoreStore();
      await store.initializeGame();

      store.updateTimeElapsed(300000); // 5 minutes = 300 seconds
      for (let i = 0; i < 100; i++) {
        store.incrementMoves();
      }
      // Would be: 10000 - (300 * 10) - (100 * 50) = 2000, but still positive
      expect(store.currentScore).toBeGreaterThanOrEqual(0);

      // Force very high penalties
      store.updateTimeElapsed(1200000); // 20 minutes
      for (let i = 0; i < 200; i++) {
        store.incrementMoves();
      }
      // Should be clamped to 0
      expect(store.currentScore).toBe(0);
    });
  });

  describe("Game State Reset", () => {
    it("should reset all state correctly", async () => {
      const store = useGameCoreStore();
      await store.initializeGame();
      store.startGame();

      // Modify state
      store.incrementMoves();
      store.incrementMatches();
      store.updateTimeElapsed(5000);

      store.resetGameState();

      expect(store.gameId).toBe("");
      expect(store.seed).toBe("");
      expect(store.isPlaying).toBe(false);
      expect(store.stats.moves).toBe(0);
      expect(store.stats.timeElapsed).toBe(0);
      expect(store.stats.matchesFound).toBe(0);
      expect(store.stats.totalPairs).toBe(0);
      expect(store.stats.isComplete).toBe(false);
    });
  });

  describe("Computed Properties", () => {
    it("should return correct game completion status", async () => {
      const store = useGameCoreStore();
      await store.initializeGame();

      expect(store.isGameComplete).toBe(false);

      store.completeGame();
      expect(store.isGameComplete).toBe(true);
    });

    it("should return correct difficulty settings", async () => {
      const store = useGameCoreStore();
      await store.initializeGame({ difficulty: "medium" });

      const settings = store.difficultySettings;
      expect(settings.name).toBe("medium");
      expect(settings.cardCount).toBe(18);
      expect(settings.gridSize).toEqual({ rows: 3, cols: 6 });
    });
  });

  describe("Difficulty Configuration", () => {
    it("should return correct easy difficulty config", async () => {
      const store = useGameCoreStore();
      await store.initializeGame({ difficulty: "easy" });

      expect(store.difficulty).toEqual({
        name: "easy",
        cardCount: 12,
        gridSize: { rows: 3, cols: 4 },
      });
    });

    it("should return correct medium difficulty config", async () => {
      const store = useGameCoreStore();
      await store.initializeGame({ difficulty: "medium" });

      expect(store.difficulty).toEqual({
        name: "medium",
        cardCount: 18,
        gridSize: { rows: 3, cols: 6 },
      });
    });

    it("should return correct hard difficulty config", async () => {
      const store = useGameCoreStore();
      await store.initializeGame({ difficulty: "hard" });

      expect(store.difficulty).toEqual({
        name: "hard",
        cardCount: 24,
        gridSize: { rows: 4, cols: 6 },
      });
    });
  });
});
