import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGame } from "~/composables/core/useGame";
import { useGameCoreStore } from "~/stores/game/core";
import type { GameOptions } from "~/types/game";

describe("Game Composable", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("Game Initialization", () => {
    it("should initialize game with default settings", async () => {
      const game = useGame();

      await game.initializeNewGame();

      expect(game.gameId.value).toBeTruthy();
      expect(game.seed.value).toBeTruthy();
      expect(game.difficulty.value.name).toBe("easy");
      expect(game.stats.value.moves).toBe(0);
      expect(game.cards.value).toHaveLength(12);
    });

    it("should initialize game with custom difficulty", async () => {
      const game = useGame();
      const options: Partial<GameOptions> = { difficulty: "medium" };

      await game.initializeNewGame(options);

      expect(game.difficulty.value.name).toBe("medium");
      expect(game.cards.value).toHaveLength(24);
      expect(game.stats.value.totalPairs).toBe(12);
    });

    it("should use provided seed", async () => {
      const game = useGame();
      const customSeed = "test-seed-12345";

      await game.initializeNewGame({ seed: customSeed });

      expect(game.seed.value).toBe(customSeed);
    });
  });

  describe("Game Flow", () => {
    it("should start and pause game correctly", async () => {
      const game = useGame();
      await game.initializeNewGame();

      game.startGame();
      expect(game.isPlaying.value).toBe(true);
      expect(game.timerIsRunning.value).toBe(true);

      game.pauseGame();
      expect(game.isPlaying.value).toBe(false);
      expect(game.timerIsRunning.value).toBe(false);
    });

    it("should resume game correctly", async () => {
      const game = useGame();
      await game.initializeNewGame();

      game.startGame();
      game.pauseGame();
      game.resumeGame();

      expect(game.isPlaying.value).toBe(true);
      expect(game.timerIsRunning.value).toBe(true);
    });
  });

  describe("Card Selection", () => {
    it("should select cards when game is playing", async () => {
      const game = useGame();
      await game.initializeNewGame();
      game.startGame();

      const firstCard = game.cards.value[0];
      const result = game.selectCard(firstCard.id);

      expect(result).toBe(true);
      expect(game.selectedCards.value).toContain(firstCard.id);
      expect(game.stats.value.moves).toBe(1);
    });

    it("should not select cards when game is not playing", async () => {
      const game = useGame();
      await game.initializeNewGame();

      const firstCard = game.cards.value[0];
      const result = game.selectCard(firstCard.id);

      expect(result).toBe(false);
      expect(game.selectedCards.value).not.toContain(firstCard.id);
      expect(game.stats.value.moves).toBe(0);
    });

    it("should check for matches with two cards", async () => {
      const game = useGame();
      await game.initializeNewGame();
      game.startGame();

      // Find two cards with the same pairId
      const firstCard = game.cards.value[0];
      const matchingCard = game.cards.value.find(
        (card) => card.pairId === firstCard.pairId && card.id !== firstCard.id,
      );

      if (matchingCard) {
        game.selectCard(firstCard.id);
        game.selectCard(matchingCard.id);

        // Wait for match check to complete
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(game.stats.value.matchesFound).toBe(1);
        expect(game.selectedCards.value).toHaveLength(0);
      }
    });
  });

  describe("Game Completion", () => {
    it("should complete game when all pairs are matched", async () => {
      const game = useGame();
      await game.initializeNewGame({ difficulty: "easy" }); // 6 pairs
      game.startGame();

      // Simulate completing all matches by using store actions
      const coreStore = useGameCoreStore();
      for (let i = 0; i < 6; i++) {
        coreStore.incrementMatches();
      }
      coreStore.completeGame();

      expect(game.isGameComplete.value).toBe(true);
    });
  });

  describe("Score Calculation", () => {
    it("should calculate score based on time and moves", async () => {
      const game = useGame();
      await game.initializeNewGame();

      // Simulate some game time and moves using store actions
      const coreStore = useGameCoreStore();
      for (let i = 0; i < 10; i++) {
        coreStore.incrementMoves();
      }
      coreStore.updateTimeElapsed(30000); // 30 seconds

      expect(game.currentScore.value).toBeGreaterThan(0);
      expect(game.currentScore.value).toBeLessThan(10000); // Less than base score due to penalties
    });
  });

  describe("Helper Functions", () => {
    it("should check if card can be selected", async () => {
      const game = useGame();
      await game.initializeNewGame();

      const firstCard = game.cards.value[0];

      // Can't select when not playing
      expect(game.canSelectCard(firstCard.id)).toBe(false);

      // Can select when playing
      game.startGame();
      expect(game.canSelectCard(firstCard.id)).toBe(true);
    });

    it("should provide game progress", async () => {
      const game = useGame();
      await game.initializeNewGame();

      const progress = game.getGameProgress();
      expect(progress.matchesFound).toBe(0);
      expect(progress.totalPairs).toBe(6); // Easy difficulty has 6 pairs
      expect(progress.progressPercentage).toBe(0);
    });
  });

  describe("Game Reset", () => {
    it("should reset game state", async () => {
      const game = useGame();
      await game.initializeNewGame();
      game.startGame();

      // Make some changes
      game.selectCard(game.cards.value[0].id);

      game.resetGame();

      expect(game.gameId.value).toBe("");
      expect(game.isPlaying.value).toBe(false);
      expect(game.stats.value.moves).toBe(0);
      expect(game.cards.value).toHaveLength(0);
    });

    it("should restart game with same settings", async () => {
      const game = useGame();
      const options = { difficulty: "medium" as const, seed: "test-seed" };

      await game.initializeNewGame(options);
      const originalSeed = game.seed.value;

      await game.restartGame();

      expect(game.seed.value).toBe(originalSeed);
      expect(game.difficulty.value.name).toBe("medium");
    });
  });
});
