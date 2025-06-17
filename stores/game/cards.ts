import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { GameCard, DifficultyLevel, CS2Item } from "~/types/game";

export const useGameCardsStore = defineStore("game-cards", () => {
  // State
  const cards = ref<GameCard[]>([]);
  const selectedCards = ref<string[]>([]);

  // Getters (computed)
  const revealedCards = computed(() =>
    cards.value.filter((card) => card.state === "revealed")
  );

  const matchedCards = computed(() =>
    cards.value.filter((card) => card.state === "matched")
  );

  const hiddenCards = computed(() =>
    cards.value.filter((card) => card.state === "hidden")
  );

  const selectedCardsData = computed(
    () =>
      selectedCards.value
        .map((cardId) => cards.value.find((card) => card.id === cardId))
        .filter(Boolean) as GameCard[]
  );

  // Actions
  const selectCard = (cardId: string): boolean => {
    const card = cards.value.find((c) => c.id === cardId);
    // Don't allow selection if card doesn't exist, is already revealed, or is matched
    if (!card || card.state !== "hidden") return false;

    // Reveal the card
    card.state = "revealed";
    selectedCards.value.push(cardId);

    return true;
  };

  const checkForMatch = (): boolean => {
    // Only proceed if exactly 2 cards are selected
    if (selectedCards.value.length !== 2) return false;

    const [firstCardId, secondCardId] = selectedCards.value;
    const firstCard = cards.value.find((c) => c.id === firstCardId);
    const secondCard = cards.value.find((c) => c.id === secondCardId);

    if (!firstCard || !secondCard) {
      // Clear selection if cards not found
      selectedCards.value = [];
      return false;
    }

    const isMatch = firstCard.pairId === secondCard.pairId;

    if (isMatch) {
      // Match found
      firstCard.state = "matched";
      secondCard.state = "matched";
    } else {
      // No match - schedule hiding cards
      setTimeout(() => {
        firstCard.state = "hidden";
        secondCard.state = "hidden";
      }, 1000);
    }

    // Clear selected cards
    selectedCards.value = [];
    return isMatch;
  };

  const generateCards = (
    difficulty: DifficultyLevel,
    seed: string,
    _cs2Items: CS2Item[] = []
  ): void => {
    // Reset cards
    cards.value = [];
    selectedCards.value = [];

    // Handle edge case of zero grid size
    if (difficulty.gridSize.rows === 0 || difficulty.gridSize.cols === 0) {
      return;
    }

    // For now, create placeholder cards until CS2 items are implemented
    const cardPairs = difficulty.cardCount / 2;
    const newCards: GameCard[] = [];

    for (let i = 0; i < cardPairs; i++) {
      const pairId = `pair-${i}`;

      // Create placeholder CS2 item
      const placeholderItem: CS2Item = {
        id: `item-${i}`,
        name: `CS2 Item ${i + 1}`,
        imageUrl: `/placeholder-${i}.jpg`,
        rarity: "consumer",
        category: "weapon",
      };

      // Create two cards for each pair
      for (let j = 0; j < 2; j++) {
        const cardId = `${pairId}-${j}`;
        newCards.push({
          id: cardId,
          pairId,
          cs2Item: placeholderItem,
          state: "hidden",
          position: { x: 0, y: 0 }, // Will be set by layout logic
        });
      }
    }

    // Shuffle cards using seed-based randomization
    shuffleCards(newCards, seed);

    // Set positions based on grid
    setCardPositions(newCards, difficulty.gridSize);

    cards.value = newCards;
  };

  const resetCards = (): void => {
    cards.value = [];
    selectedCards.value = [];
  };

  const hideAllRevealedCards = (): void => {
    cards.value.forEach((card) => {
      if (card.state === "revealed") {
        card.state = "hidden";
      }
    });
    selectedCards.value = [];
  };

  // Helper functions
  const shuffleCards = (cardsArray: GameCard[], seed: string): void => {
    // Enhanced seeded shuffle algorithm for maximum differentiation
    let currentIndex = cardsArray.length;
    let randomIndex: number;

    // Create a more sophisticated hash from seed using multiple techniques
    let hash1 = 0;
    let hash2 = 1;

    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      // First hash using DJB2 algorithm
      hash1 = ((hash1 << 5) + hash1 + char) & 0x7fffffff;
      // Second hash using FNV-1a algorithm
      hash2 = (hash2 ^ char) & 0x7fffffff;
      hash2 = (hash2 * 16777619) & 0x7fffffff;
    }

    // Combine hashes with seed properties for maximum variation
    const charSum = seed
      .split("")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const seedVariation =
      seed.length * 31 + charSum * 17 + (seed.charCodeAt(0) || 1) * 123;
    hash1 = (hash1 + seedVariation) & 0x7fffffff;
    hash2 = (hash2 ^ seedVariation) & 0x7fffffff;

    // Use two interleaved random generators for better distribution
    let random1 = Math.abs(hash1) || 1;
    let random2 = Math.abs(hash2) || 1;

    // Pre-warm both generators with different patterns
    for (let i = 0; i < 25; i++) {
      random1 = (random1 * 1103515245 + 12345) & 0x7fffffff;
      random2 = (random2 * 16807 + 1) & 0x7fffffff;
    }

    while (currentIndex > 0) {
      // Use alternating generators for more randomness
      if (currentIndex % 2 === 0) {
        random1 = (random1 * 1103515245 + 12345) & 0x7fffffff;
        randomIndex = random1 % currentIndex;
      } else {
        random2 = (random2 * 16807 + 1) & 0x7fffffff;
        randomIndex = random2 % currentIndex;
      }

      currentIndex--;

      // Swap with current element
      [cardsArray[currentIndex], cardsArray[randomIndex]] = [
        cardsArray[randomIndex],
        cardsArray[currentIndex],
      ];
    }
  };

  const setCardPositions = (
    cardsArray: GameCard[],
    gridSize: { rows: number; cols: number }
  ): void => {
    cardsArray.forEach((card, index) => {
      const row = Math.floor(index / gridSize.cols);
      const col = index % gridSize.cols;
      card.position = { x: col, y: row };
    });
  };

  const setCS2Items = (cs2Items: CS2Item[]): void => {
    // Update existing cards with real CS2 items
    const cardPairs = cs2Items.length;
    const newCards: GameCard[] = [];

    for (let i = 0; i < cardPairs; i++) {
      const pairId = `pair-${i}`;
      const cs2Item = cs2Items[i];

      // Create two cards for each CS2 item (pair)
      for (let j = 0; j < 2; j++) {
        const cardId = `${pairId}-${j}`;
        newCards.push({
          id: cardId,
          pairId,
          cs2Item,
          state: "hidden",
          position: { x: 0, y: 0 }, // Will be set by layout logic
        });
      }
    }

    // Maintain current shuffle if cards exist, otherwise shuffle new cards
    if (cards.value.length > 0 && newCards.length === cards.value.length) {
      // Update existing cards with new CS2 items while maintaining positions
      cards.value.forEach((existingCard, index) => {
        if (newCards[index]) {
          existingCard.cs2Item = newCards[index].cs2Item;
          existingCard.pairId = newCards[index].pairId;
        }
      });
    } else {
      cards.value = newCards;
    }
  };

  const restoreState = (savedCards: GameCard[]): void => {
    // Restore cards from saved state
    cards.value = [...savedCards];

    // Clear selected cards on restore
    selectedCards.value = [];
  };

  return {
    // State
    cards,
    selectedCards,

    // Getters
    revealedCards,
    matchedCards,
    hiddenCards,
    selectedCardsData,

    // Actions
    selectCard,
    checkForMatch,
    generateCards,
    resetCards,
    hideAllRevealedCards,
    setCS2Items,
    restoreState,
  };
});
