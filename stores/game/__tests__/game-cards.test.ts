import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGameCardsStore } from "~/stores/game/cards";
import type { DifficultyLevel } from "~/types/game";

describe("Game Cards Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("Initial State", () => {
    it("should initialize with empty state", () => {
      const store = useGameCardsStore();

      expect(store.cards).toEqual([]);
      expect(store.selectedCards).toEqual([]);
      expect(store.revealedCards).toEqual([]);
      expect(store.matchedCards).toEqual([]);
      expect(store.hiddenCards).toEqual([]);
      expect(store.selectedCardsData).toEqual([]);
    });
  });

  describe("Card Generation", () => {
    it("should generate correct number of cards for easy difficulty", () => {
      const store = useGameCardsStore();
      const difficulty: DifficultyLevel = {
        name: "easy",
        cardCount: 12,
        gridSize: { rows: 3, cols: 4 },
      };

      store.generateCards(difficulty, "test-seed");

      expect(store.cards).toHaveLength(12);
      // Should create 6 pairs
      const pairs = new Set(store.cards.map((card) => card.pairId));
      expect(pairs.size).toBe(6);
    });

    it("should generate correct number of cards for medium difficulty", () => {
      const store = useGameCardsStore();
      const difficulty: DifficultyLevel = {
        name: "medium",
        cardCount: 24,
        gridSize: { rows: 4, cols: 6 },
      };

      store.generateCards(difficulty, "test-seed");

      expect(store.cards).toHaveLength(24);
      // Should create 12 pairs
      const pairs = new Set(store.cards.map((card) => card.pairId));
      expect(pairs.size).toBe(12);
    });

    it("should generate correct number of cards for hard difficulty", () => {
      const store = useGameCardsStore();
      const difficulty: DifficultyLevel = {
        name: "hard",
        cardCount: 48,
        gridSize: { rows: 6, cols: 8 },
      };

      store.generateCards(difficulty, "test-seed");

      expect(store.cards).toHaveLength(48);
      // Should create 24 pairs
      const pairs = new Set(store.cards.map((card) => card.pairId));
      expect(pairs.size).toBe(24);
    });

    it("should create proper pairs for each card", () => {
      const store = useGameCardsStore();
      const difficulty: DifficultyLevel = {
        name: "easy",
        cardCount: 12,
        gridSize: { rows: 3, cols: 4 },
      };

      store.generateCards(difficulty, "test-seed");

      // Each pairId should appear exactly twice
      const pairCounts = new Map<string, number>();
      store.cards.forEach((card) => {
        pairCounts.set(card.pairId, (pairCounts.get(card.pairId) || 0) + 1);
      });

      pairCounts.forEach((count) => {
        expect(count).toBe(2);
      });
    });

    it("should set correct grid positions", () => {
      const store = useGameCardsStore();
      const difficulty: DifficultyLevel = {
        name: "easy",
        cardCount: 12,
        gridSize: { rows: 3, cols: 4 },
      };

      store.generateCards(difficulty, "test-seed");

      store.cards.forEach((card, index) => {
        const expectedRow = Math.floor(index / 4);
        const expectedCol = index % 4;
        expect(card.position.y).toBe(expectedRow);
        expect(card.position.x).toBe(expectedCol);
      });
    });

    it("should use seeded randomization for reproducible shuffles", () => {
      const store1 = useGameCardsStore();
      const store2 = useGameCardsStore();
      const difficulty: DifficultyLevel = {
        name: "easy",
        cardCount: 12,
        gridSize: { rows: 3, cols: 4 },
      };
      const seed = "test-seed-123";

      store1.generateCards(difficulty, seed);
      store2.generateCards(difficulty, seed);

      // Same seed should produce same card order
      expect(store1.cards.map((c) => c.pairId)).toEqual(
        store2.cards.map((c) => c.pairId),
      );
    });

    it("should produce different shuffles with different seeds", () => {
      const difficulty: DifficultyLevel = {
        name: "easy",
        cardCount: 12,
        gridSize: { rows: 3, cols: 4 },
      };

      // Test multiple seed pairs to ensure the algorithm has sufficient entropy
      const seedPairs = [
        ["seed-a", "seed-b"],
        ["test-123", "test-456"],
        ["alpha-xyz", "beta-999"],
        ["completely-different-seed-alpha", "totally-unique-seed-beta-987"],
        ["short", "very-long-seed-with-many-characters"],
      ];

      let foundDifferentShuffle = false;

      for (const [seed1, seed2] of seedPairs) {
        // Create separate Pinia instances to ensure stores don't share state
        setActivePinia(createPinia());
        const store1 = useGameCardsStore();

        setActivePinia(createPinia());
        const store2 = useGameCardsStore();

        store1.generateCards(difficulty, seed1);
        store2.generateCards(difficulty, seed2);

        const order1 = store1.cards.map((c) => c.pairId);
        const order2 = store2.cards.map((c) => c.pairId);

        if (!order1.every((pair, index) => pair === order2[index])) {
          foundDifferentShuffle = true;
          break;
        }
      }

      // At least one seed pair should produce different shuffles
      expect(foundDifferentShuffle).toBe(true);
    });

    it("should initialize all cards as hidden", () => {
      const store = useGameCardsStore();
      const difficulty: DifficultyLevel = {
        name: "easy",
        cardCount: 12,
        gridSize: { rows: 3, cols: 4 },
      };

      store.generateCards(difficulty, "test-seed");

      store.cards.forEach((card) => {
        expect(card.state).toBe("hidden");
      });
      expect(store.hiddenCards).toHaveLength(12);
    });
  });

  describe("Card Selection", () => {
    beforeEach(() => {
      const store = useGameCardsStore();
      const difficulty: DifficultyLevel = {
        name: "easy",
        cardCount: 12,
        gridSize: { rows: 3, cols: 4 },
      };
      store.generateCards(difficulty, "test-seed");
    });

    it("should select hidden cards successfully", () => {
      const store = useGameCardsStore();
      const firstCard = store.cards[0];

      const result = store.selectCard(firstCard.id);

      expect(result).toBe(true);
      expect(firstCard.state).toBe("revealed");
      expect(store.selectedCards).toContain(firstCard.id);
      expect(store.revealedCards).toHaveLength(1);
    });

    it("should not select already revealed cards", () => {
      const store = useGameCardsStore();
      const firstCard = store.cards[0];

      // First selection should work
      store.selectCard(firstCard.id);
      expect(store.selectedCards).toHaveLength(1);

      // Second selection should fail
      const result = store.selectCard(firstCard.id);
      expect(result).toBe(false);
      expect(store.selectedCards).toHaveLength(1);
    });

    it("should not select matched cards", () => {
      const store = useGameCardsStore();
      const firstCard = store.cards[0];
      firstCard.state = "matched";

      const result = store.selectCard(firstCard.id);

      expect(result).toBe(false);
      expect(store.selectedCards).not.toContain(firstCard.id);
    });

    it("should track selected cards data correctly", () => {
      const store = useGameCardsStore();
      const firstCard = store.cards[0];
      const secondCard = store.cards[1];

      store.selectCard(firstCard.id);
      store.selectCard(secondCard.id);

      expect(store.selectedCardsData).toHaveLength(2);
      expect(store.selectedCardsData).toContain(firstCard);
      expect(store.selectedCardsData).toContain(secondCard);
    });
  });

  describe("Matching Logic", () => {
    beforeEach(() => {
      const store = useGameCardsStore();
      const difficulty: DifficultyLevel = {
        name: "easy",
        cardCount: 12,
        gridSize: { rows: 3, cols: 4 },
      };
      store.generateCards(difficulty, "test-seed");
    });

    it("should match cards with same pairId", async () => {
      const store = useGameCardsStore();

      // Find two cards with the same pairId
      const firstCard = store.cards[0];
      const matchingCard = store.cards.find(
        (card) => card.pairId === firstCard.pairId && card.id !== firstCard.id,
      )!;

      // Select both cards
      store.selectCard(firstCard.id);
      store.selectCard(matchingCard.id);

      const result = store.checkForMatch();

      expect(result).toBe(true);
      expect(firstCard.state).toBe("matched");
      expect(matchingCard.state).toBe("matched");
      expect(store.selectedCards).toHaveLength(0);
      expect(store.matchedCards).toHaveLength(2);
    });

    it("should not match cards with different pairId", async () => {
      const store = useGameCardsStore();

      // Find two cards with different pairIds
      const firstCard = store.cards[0];
      const nonMatchingCard = store.cards.find(
        (card) => card.pairId !== firstCard.pairId,
      )!;

      // Select both cards
      store.selectCard(firstCard.id);
      store.selectCard(nonMatchingCard.id);

      const result = store.checkForMatch();

      expect(result).toBe(false);
      expect(store.selectedCards).toHaveLength(0);

      // Cards should be scheduled to be hidden (will happen after timeout)
      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect(firstCard.state).toBe("hidden");
      expect(nonMatchingCard.state).toBe("hidden");
    });

    it("should not check match with less than 2 cards", () => {
      const store = useGameCardsStore();
      const firstCard = store.cards[0];

      store.selectCard(firstCard.id);
      const result = store.checkForMatch();

      expect(result).toBe(false);
      expect(store.selectedCards).toHaveLength(1);
    });

    it("should not check match with more than 2 cards", () => {
      const store = useGameCardsStore();

      // Manually add 3 cards to selection (edge case)
      store.selectedCards.push(store.cards[0].id);
      store.selectedCards.push(store.cards[1].id);
      store.selectedCards.push(store.cards[2].id);

      const result = store.checkForMatch();

      expect(result).toBe(false);
      expect(store.selectedCards).toHaveLength(3);
    });
  });

  describe("Computed Properties", () => {
    beforeEach(() => {
      const store = useGameCardsStore();
      const difficulty: DifficultyLevel = {
        name: "easy",
        cardCount: 12,
        gridSize: { rows: 3, cols: 4 },
      };
      store.generateCards(difficulty, "test-seed");
    });

    it("should correctly filter revealed cards", () => {
      const store = useGameCardsStore();

      store.selectCard(store.cards[0].id);
      store.selectCard(store.cards[1].id);

      expect(store.revealedCards).toHaveLength(2);
      expect(
        store.revealedCards.every((card) => card.state === "revealed"),
      ).toBe(true);
    });

    it("should correctly filter matched cards", () => {
      const store = useGameCardsStore();

      // Manually set some cards as matched
      store.cards[0].state = "matched";
      store.cards[1].state = "matched";

      expect(store.matchedCards).toHaveLength(2);
      expect(store.matchedCards.every((card) => card.state === "matched")).toBe(
        true,
      );
    });

    it("should correctly filter hidden cards", () => {
      const store = useGameCardsStore();

      // Select 2 cards (now revealed)
      store.selectCard(store.cards[0].id);
      store.selectCard(store.cards[1].id);

      expect(store.hiddenCards).toHaveLength(10);
      expect(store.hiddenCards.every((card) => card.state === "hidden")).toBe(
        true,
      );
    });
  });

  describe("Card State Management", () => {
    beforeEach(() => {
      const store = useGameCardsStore();
      const difficulty: DifficultyLevel = {
        name: "easy",
        cardCount: 12,
        gridSize: { rows: 3, cols: 4 },
      };
      store.generateCards(difficulty, "test-seed");
    });

    it("should reset cards correctly", () => {
      const store = useGameCardsStore();

      // Select some cards first
      store.selectCard(store.cards[0].id);
      store.selectCard(store.cards[1].id);

      store.resetCards();

      expect(store.cards).toHaveLength(0);
      expect(store.selectedCards).toHaveLength(0);
    });

    it("should hide all revealed cards", () => {
      const store = useGameCardsStore();

      // Select and reveal some cards
      store.selectCard(store.cards[0].id);
      store.selectCard(store.cards[1].id);
      store.selectCard(store.cards[2].id);

      expect(store.revealedCards).toHaveLength(3);

      store.hideAllRevealedCards();

      expect(store.revealedCards).toHaveLength(0);
      expect(store.selectedCards).toHaveLength(0);
      store.cards.slice(0, 3).forEach((card) => {
        expect(card.state).toBe("hidden");
      });
    });

    it("should not hide matched cards when hiding revealed cards", () => {
      const store = useGameCardsStore();

      // Set some cards as matched and some as revealed
      store.cards[0].state = "matched";
      store.cards[1].state = "matched";
      store.cards[2].state = "revealed";
      store.cards[3].state = "revealed";

      store.hideAllRevealedCards();

      expect(store.cards[0].state).toBe("matched");
      expect(store.cards[1].state).toBe("matched");
      expect(store.cards[2].state).toBe("hidden");
      expect(store.cards[3].state).toBe("hidden");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty card selection gracefully", () => {
      const store = useGameCardsStore();

      const result = store.selectCard("non-existent-id");

      expect(result).toBe(false);
      expect(store.selectedCards).toHaveLength(0);
    });

    it("should handle match check with invalid card IDs", () => {
      const store = useGameCardsStore();

      // Manually add invalid IDs
      store.selectedCards.push("invalid-id-1");
      store.selectedCards.push("invalid-id-2");

      const result = store.checkForMatch();

      expect(result).toBe(false);
    });

    it("should handle card generation with zero cards", () => {
      const store = useGameCardsStore();
      const difficulty: DifficultyLevel = {
        name: "easy",
        cardCount: 12,
        gridSize: { rows: 0, cols: 0 },
      };

      store.generateCards(difficulty, "test-seed");

      expect(store.cards).toHaveLength(0);
    });
  });
});
