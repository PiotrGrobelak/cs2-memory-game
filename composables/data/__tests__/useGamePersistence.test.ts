import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useGamePersistence } from "~/composables/data/useGamePersistence";
import type { GameState, DifficultyLevel } from "~/types/game";

describe("useGamePersistence", () => {
  let persistence: ReturnType<typeof useGamePersistence>;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Reset all mocks
    vi.clearAllMocks();

    // Suppress console.error during tests unless explicitly enabled
    vi.spyOn(console, "error").mockImplementation(() => {});

    persistence = useGamePersistence();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("saveGameState", () => {
    const createMockGameState = (
      overrides: Partial<GameState> = {}
    ): GameState => {
      const difficulty: DifficultyLevel = {
        name: "easy",
        cardCount: 12,
        gridSize: { rows: 3, cols: 4 },
      };

      return {
        id: "test-game-123",
        seed: "test-seed",
        difficulty,
        cards: [
          {
            id: "card-1",
            pairId: "pair-1",
            state: "hidden",
            position: { x: 0, y: 0 },
            cs2Item: {
              id: "item-1",
              name: "Test Item 1",
              imageUrl: "/test1.jpg",
              rarity: "consumer",
              category: "weapon",
              collection: "Test Collection",
              exterior: "Factory New",
            },
          },
          {
            id: "card-2",
            pairId: "pair-1",
            state: "revealed",
            position: { x: 1, y: 0 },
            cs2Item: {
              id: "item-1",
              name: "Test Item 1",
              imageUrl: "/test1.jpg",
              rarity: "consumer",
              category: "weapon",
              collection: "Test Collection",
              exterior: "Factory New",
            },
          },
          {
            id: "card-3",
            pairId: "pair-2",
            state: "matched",
            position: { x: 2, y: 0 },
            cs2Item: {
              id: "item-2",
              name: "Test Item 2",
              imageUrl: "/test2.jpg",
              rarity: "industrial",
              category: "weapon",
              collection: "Test Collection",
              exterior: "Factory New",
            },
          },
        ],
        stats: {
          moves: 5,
          timeElapsed: 30,
          matchesFound: 1,
          totalPairs: 6,
          isComplete: false,
        },
        startTime: Date.now(),
        isPlaying: true,
        selectedCards: ["card-1", "card-2"], // This should be cleared
        gameHistory: [],
        ...overrides,
      };
    };

    it("should save game state successfully", async () => {
      const gameState = createMockGameState();

      const result = await persistence.saveGameState(gameState);

      expect(result).toBe(true);

      // Check that data was saved to localStorage
      const savedData = localStorage.getItem("cs2-memory-game-state");
      expect(savedData).toBeTruthy();

      const parsed = JSON.parse(savedData!);
      expect(parsed.version).toBe("1.0.0");
      expect(parsed.gameState.id).toBe("test-game-123");
    });

    it("should preserve matched cards when saving state", async () => {
      const gameState = createMockGameState();

      await persistence.saveGameState(gameState);

      const savedData = localStorage.getItem("cs2-memory-game-state");
      const parsed = JSON.parse(savedData!);
      const savedCards = parsed.gameState.cards;

      // Matched cards should remain matched
      const matchedCards = savedCards.filter(
        (card: { state: string }) => card.state === "matched"
      );
      expect(matchedCards).toHaveLength(1);

      const matchedCard = savedCards.find(
        (card: { id: string }) => card.id === "card-3"
      );
      expect(matchedCard.state).toBe("matched");
    });

    it("should not modify the original game state object", async () => {
      const gameState = createMockGameState();
      const originalCards = JSON.parse(JSON.stringify(gameState.cards));
      const originalSelectedCards = [...gameState.selectedCards];

      await persistence.saveGameState(gameState);

      // Original game state should remain unchanged
      expect(gameState.cards).toEqual(originalCards);
      expect(gameState.selectedCards).toEqual(originalSelectedCards);

      // Verify revealed card is still revealed in original
      const revealedCard = gameState.cards.find((card) => card.id === "card-2");
      expect(revealedCard?.state).toBe("revealed");
    });

    it("should handle empty cards array", async () => {
      const gameState = createMockGameState({
        cards: [],
        selectedCards: [],
      });

      const result = await persistence.saveGameState(gameState);

      expect(result).toBe(true);

      const savedData = localStorage.getItem("cs2-memory-game-state");
      const parsed = JSON.parse(savedData!);

      expect(parsed.gameState.cards).toHaveLength(0);
      expect(parsed.gameState.selectedCards).toHaveLength(0);
    });

    it("should handle localStorage unavailable", async () => {
      // Mock localStorage to throw error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error("Storage quota exceeded");
      });

      const gameState = createMockGameState();
      const result = await persistence.saveGameState(gameState);

      expect(result).toBe(false);

      // Restore original
      localStorage.setItem = originalSetItem;
    });
  });

  describe("loadGameState", () => {
    const createMockGameState = (
      overrides: Partial<GameState> = {}
    ): GameState => {
      const difficulty: DifficultyLevel = {
        name: "easy",
        cardCount: 12,
        gridSize: { rows: 3, cols: 4 },
      };

      return {
        id: "test-game-123",
        seed: "test-seed",
        difficulty,
        cards: [
          {
            id: "card-1",
            pairId: "pair-1",
            state: "hidden",
            position: { x: 0, y: 0 },
            cs2Item: {
              id: "item-1",
              name: "Test Item 1",
              imageUrl: "/test1.jpg",
              rarity: "consumer",
              category: "weapon",
              collection: "Test Collection",
              exterior: "Factory New",
            },
          },
          {
            id: "card-2",
            pairId: "pair-1",
            state: "revealed", // This should become hidden
            position: { x: 1, y: 0 },
            cs2Item: {
              id: "item-1",
              name: "Test Item 1",
              imageUrl: "/test1.jpg",
              rarity: "consumer",
              category: "weapon",
              collection: "Test Collection",
              exterior: "Factory New",
            },
          },
          {
            id: "card-3",
            pairId: "pair-2",
            state: "matched",
            position: { x: 2, y: 0 },
            cs2Item: {
              id: "item-2",
              name: "Test Item 2",
              imageUrl: "/test2.jpg",
              rarity: "industrial",
              category: "weapon",
              collection: "Test Collection",
              exterior: "Factory New",
            },
          },
        ],
        stats: {
          moves: 5,
          timeElapsed: 30,
          matchesFound: 1,
          totalPairs: 6,
          isComplete: false,
        },
        startTime: Date.now(),
        isPlaying: true,
        selectedCards: ["card-1", "card-2"], // This should be cleared
        gameHistory: [],
        ...overrides,
      };
    };

    it("should load saved game state", async () => {
      const gameState = createMockGameState();

      // Save first
      await persistence.saveGameState(gameState);

      // Load
      const loadedState = await persistence.loadGameState();

      expect(loadedState).toBeTruthy();
      expect(loadedState!.id).toBe("test-game-123");
      expect(loadedState!.seed).toBe("test-seed");

      // Verify revealed cards were filtered out
      const revealedCards = loadedState!.cards.filter(
        (card) => card.state === "revealed"
      );

      // Returned state should have 1 revealed card and 2 selected cards
      expect(revealedCards).toHaveLength(1);
      expect(loadedState!.selectedCards).toHaveLength(2);
    });

    it("should return null when no saved state exists", async () => {
      const loadedState = await persistence.loadGameState();
      expect(loadedState).toBeNull();
    });
  });
});
