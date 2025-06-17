import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useGameStore } from "~/stores/game";

describe("Game Store", () => {
  beforeEach(() => {
    // Set up a fresh Pinia instance for each test
    setActivePinia(createPinia());
  });

  describe("Initial State", () => {
    it("should have correct initial state", () => {
      const gameStore = useGameStore();

      expect(gameStore.id).toBe("");
      expect(gameStore.seed).toBe("");
      expect(gameStore.isPlaying).toBe(false);
      expect(gameStore.stats.moves).toBe(0);
      expect(gameStore.stats.timeElapsed).toBe(0);
      expect(gameStore.stats.matchesFound).toBe(0);
      expect(gameStore.stats.isComplete).toBe(false);
      expect(gameStore.cards).toEqual([]);
      expect(gameStore.selectedCards).toEqual([]);
    });

    it("should have easy difficulty as default", () => {
      const gameStore = useGameStore();

      expect(gameStore.difficulty.name).toBe("easy");
      expect(gameStore.difficulty.cardCount).toBe(12);
      expect(gameStore.difficulty.gridSize).toEqual({ rows: 3, cols: 4 });
    });
  });

  describe("Game Initialization", () => {
    it("should initialize game with default options", async () => {
      const gameStore = useGameStore();

      await gameStore.initializeGame();

      expect(gameStore.id).toMatch(/^game-\d+-/);
      expect(gameStore.seed).toBeTruthy();
      expect(gameStore.difficulty.name).toBe("easy");
      expect(gameStore.stats.totalPairs).toBe(6); // 12 cards = 6 pairs
    });

    it("should initialize game with custom difficulty", async () => {
      const gameStore = useGameStore();

      await gameStore.initializeGame({ difficulty: "medium" });

      expect(gameStore.difficulty.name).toBe("medium");
      expect(gameStore.difficulty.cardCount).toBe(24);
      expect(gameStore.stats.totalPairs).toBe(12); // 24 cards = 12 pairs
    });

    it("should use provided seed", async () => {
      const gameStore = useGameStore();
      const customSeed = "test-seed-123";

      await gameStore.initializeGame({ seed: customSeed });

      expect(gameStore.seed).toBe(customSeed);
    });
  });

  describe("Game Flow", () => {
    it("should start game correctly", () => {
      const gameStore = useGameStore();

      gameStore.startGame();

      expect(gameStore.isPlaying).toBe(true);
      expect(gameStore.startTime).toBeTruthy();
    });

    it("should pause and resume game", () => {
      const gameStore = useGameStore();

      gameStore.startGame();
      const initialStartTime = gameStore.startTime;

      gameStore.pauseGame();
      expect(gameStore.isPlaying).toBe(false);
      expect(gameStore.startTime).toBeNull();

      gameStore.resumeGame();
      expect(gameStore.isPlaying).toBe(true);
      expect(gameStore.startTime).not.toBe(initialStartTime);
    });

    it("should reset game state", () => {
      const gameStore = useGameStore();

      // Set some state
      gameStore.id = "test-id";
      gameStore.seed = "test-seed";
      gameStore.isPlaying = true;
      gameStore.stats.moves = 10;

      gameStore.resetGameState();

      expect(gameStore.id).toBe("");
      expect(gameStore.seed).toBe("");
      expect(gameStore.isPlaying).toBe(false);
      expect(gameStore.stats.moves).toBe(0);
    });
  });

  describe("Getters", () => {
    it("should calculate score correctly", () => {
      const gameStore = useGameStore();

      // Set up game state for score calculation
      gameStore.stats.moves = 10;
      gameStore.stats.timeElapsed = 5000; // 5 seconds

      const expectedScore = 10000 - 5 * 10 - 10 * 50; // base - time penalty - move penalty
      expect(gameStore.currentScore).toBe(expectedScore);
    });

    it("should return zero score when no time elapsed", () => {
      const gameStore = useGameStore();

      gameStore.stats.moves = 10;
      gameStore.stats.timeElapsed = 0;

      expect(gameStore.currentScore).toBe(0);
    });
  });

  describe("Difficulty Configuration", () => {
    it("should return correct easy difficulty config", () => {
      const gameStore = useGameStore();

      const config = gameStore.getDifficultyConfig("easy");

      expect(config).toEqual({
        name: "easy",
        cardCount: 12,
        gridSize: { rows: 3, cols: 4 },
      });
    });

    it("should return correct medium difficulty config", () => {
      const gameStore = useGameStore();

      const config = gameStore.getDifficultyConfig("medium");

      expect(config).toEqual({
        name: "medium",
        cardCount: 24,
        gridSize: { rows: 4, cols: 6 },
      });
    });

    it("should return correct hard difficulty config", () => {
      const gameStore = useGameStore();

      const config = gameStore.getDifficultyConfig("hard");

      expect(config).toEqual({
        name: "hard",
        cardCount: 48,
        gridSize: { rows: 6, cols: 8 },
      });
    });
  });

  describe("Seed Generation", () => {
    it("should generate unique seeds", () => {
      const gameStore = useGameStore();

      const seed1 = gameStore.generateSeed();
      const seed2 = gameStore.generateSeed();

      expect(seed1).toBeTruthy();
      expect(seed2).toBeTruthy();
      expect(seed1).not.toBe(seed2);
    });

    it("should generate seeds of consistent length", () => {
      const gameStore = useGameStore();

      for (let i = 0; i < 10; i++) {
        const seed = gameStore.generateSeed();
        expect(seed.length).toBeGreaterThanOrEqual(20); // Should be reasonably long
      }
    });
  });
});
