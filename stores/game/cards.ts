import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  GameCard,
  DifficultyLevel,
  CS2Item,
  ItemRarity,
  ItemCategory,
} from "~/types/game";
import cs2ApiService from "~/services/cs2ApiService";
import { imageLoader } from "~/services/ImageLoader";

export const useGameCardsStore = defineStore("game-cards", () => {
  const cards = ref<GameCard[]>([]);
  const selectedCards = ref<string[]>([]);

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

  const selectCard = (cardId: string): boolean => {
    const card = cards.value.find((c) => c.id === cardId);

    if (!card) {
      return false;
    }

    if (card.state !== "hidden") {
      return false;
    }

    // Check if there are already 2 revealed cards (not matched)
    // This prevents selecting more cards when 2 are already revealed and waiting for match check
    if (revealedCards.value.length >= 2) {
      return false;
    }

    if (selectedCards.value.includes(cardId)) {
      return false;
    }

    card.state = "revealed";
    selectedCards.value.push(cardId);

    return true;
  };

  const checkForMatch = (): boolean => {
    if (selectedCards.value.length !== 2) {
      return false;
    }

    const [firstCardId, secondCardId] = selectedCards.value;
    const firstCard = cards.value.find((c) => c.id === firstCardId);
    const secondCard = cards.value.find((c) => c.id === secondCardId);

    if (!firstCard || !secondCard) {
      selectedCards.value = [];
      return false;
    }

    const isMatch = firstCard.pairId === secondCard.pairId;

    if (isMatch) {
      firstCard.state = "matched";
      secondCard.state = "matched";
    } else {
      const cardToHide1 = firstCard;
      const cardToHide2 = secondCard;

      setTimeout(() => {
        if (cardToHide1.state === "revealed") {
          cardToHide1.state = "hidden";
        }

        if (cardToHide2.state === "revealed") {
          cardToHide2.state = "hidden";
        }

        cards.value = [...cards.value];
      }, 1000);
    }

    selectedCards.value = [];
    return isMatch;
  };

  const generateCards = async (
    difficulty: DifficultyLevel,
    seed: string,
    cs2Items: CS2Item[] = []
  ): Promise<void> => {
    cards.value = [];
    selectedCards.value = [];

    if (difficulty.gridSize.rows === 0 || difficulty.gridSize.cols === 0) {
      return;
    }

    const cardPairs = difficulty.cardCount / 2;
    let availableItems: CS2Item[] = [];

    if (cs2Items.length === 0) {
      try {
        availableItems = await cs2ApiService.getCS2Items(cardPairs * 2); // Get more items than needed for variety
      } catch (error) {
        console.warn("Failed to fetch CS2 items, using placeholders:", error);
        availableItems = [];
      }
    } else {
      availableItems = cs2Items;
    }

    if (availableItems.length < cardPairs) {
      const placeholderCount = cardPairs - availableItems.length;
      const rarities: ItemRarity[] = [
        "consumer",
        "industrial",
        "milSpec",
        "restricted",
        "classified",
        "covert",
        "contraband",
      ];
      const categories: ItemCategory[] = ["weapon", "knife", "glove"];

      for (let i = 0; i < placeholderCount; i++) {
        const placeholderItem: CS2Item = {
          id: `placeholder-${i}`,
          name: `CS2 Item ${availableItems.length + i + 1}`,
          imageUrl: `/placeholder-${i}.jpg`,
          rarity: rarities[i % rarities.length],
          category: categories[i % categories.length],
          collection: "Placeholder Collection",
          exterior: "Factory New",
        };
        availableItems.push(placeholderItem);
      }
    }

    const shuffledItems = [...availableItems].sort(() => Math.random() - 0.5);
    const selectedItems = shuffledItems.slice(0, cardPairs);

    const newCards: GameCard[] = [];

    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];
      const pairId = `pair-${i}`;

      for (let j = 0; j < 2; j++) {
        const cardId = `${pairId}-${j}`;
        newCards.push({
          id: cardId,
          pairId,
          cs2Item: item,
          state: "hidden",
          position: { x: 0, y: 0 }, // Will be set by layout logic
        });
      }
    }

    shuffleCards(newCards, seed, difficulty.gridSize);

    setCardPositions(newCards, difficulty.gridSize);

    cards.value = newCards;

    newCards.forEach((card) => {
      imageLoader.loadImage(card.cs2Item.imageUrl);
    });
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

  const shuffleCards = (
    cardsArray: GameCard[],
    seed: string,
    gridSize: { rows: number; cols: number }
  ): void => {
    let currentIndex = cardsArray.length;
    let randomIndex: number;

    let hash1 = 0;
    let hash2 = 1;

    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash1 = ((hash1 << 5) + hash1 + char) & 0x7fffffff;
      hash2 = (hash2 ^ char) & 0x7fffffff;
      hash2 = (hash2 * 16777619) & 0x7fffffff;
    }

    const charSum = seed
      .split("")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const seedVariation =
      seed.length * 31 + charSum * 17 + (seed.charCodeAt(0) || 1) * 123;
    hash1 = (hash1 + seedVariation) & 0x7fffffff;
    hash2 = (hash2 ^ seedVariation) & 0x7fffffff;

    let random1 = Math.abs(hash1) || 1;
    let random2 = Math.abs(hash2) || 1;

    for (let i = 0; i < 25; i++) {
      random1 = (random1 * 1103515245 + 12345) & 0x7fffffff;
      random2 = (random2 * 16807 + 1) & 0x7fffffff;
    }

    for (let pass = 0; pass < 3; pass++) {
      currentIndex = cardsArray.length;

      while (currentIndex > 0) {
        if (currentIndex % 2 === 0) {
          random1 = (random1 * 1103515245 + 12345) & 0x7fffffff;
          randomIndex = random1 % currentIndex;
        } else {
          random2 = (random2 * 16807 + 1) & 0x7fffffff;
          randomIndex = random2 % currentIndex;
        }

        currentIndex--;

        [cardsArray[currentIndex], cardsArray[randomIndex]] = [
          cardsArray[randomIndex],
          cardsArray[currentIndex],
        ];
      }
    }

    validateAndFixAdjacentPairs(cardsArray, seed, gridSize);
  };

  /**
   * Validate that no pairs are adjacent and fix if necessary
   */
  const validateAndFixAdjacentPairs = (
    cardsArray: GameCard[],
    seed: string,
    gridSize: { rows: number; cols: number }
  ): void => {
    const gridCols = gridSize.cols;
    let attempts = 0;
    const maxAttempts = 50;

    let random =
      Math.abs(
        seed.split("").reduce((a, b) => {
          a = (a << 5) - a + b.charCodeAt(0);
          return a & a;
        }, 0)
      ) || 1;

    const seededRandom = () => {
      random = (random * 9301 + 49297) % 233280;
      return random / 233280;
    };

    while (attempts < maxAttempts) {
      let hasAdjacentPairs = false;

      for (let i = 0; i < cardsArray.length && !hasAdjacentPairs; i++) {
        const currentCard = cardsArray[i];
        const adjacentIndices: number[] = [];

        if (i % gridCols !== gridCols - 1 && i + 1 < cardsArray.length) {
          adjacentIndices.push(i + 1);
        }
        if (i % gridCols !== 0 && i - 1 >= 0) {
          adjacentIndices.push(i - 1);
        }

        if (i + gridCols < cardsArray.length) {
          adjacentIndices.push(i + gridCols);
        }
        if (i - gridCols >= 0) {
          adjacentIndices.push(i - gridCols);
        }

        for (const adjIndex of adjacentIndices) {
          if (cardsArray[adjIndex].pairId === currentCard.pairId) {
            hasAdjacentPairs = true;
            break;
          }
        }
      }

      if (!hasAdjacentPairs) {
        break;
      }

      for (let i = cardsArray.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [cardsArray[i], cardsArray[j]] = [cardsArray[j], cardsArray[i]];
      }

      attempts++;
    }

    if (attempts >= maxAttempts) {
      console.warn(
        `Could not eliminate all adjacent pairs after ${maxAttempts} attempts`
      );
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
    const cardPairs = cs2Items.length;
    const newCards: GameCard[] = [];

    for (let i = 0; i < cardPairs; i++) {
      const pairId = `pair-${i}`;
      const cs2Item = cs2Items[i];

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
      // Update existing cards with new CS2 items while maintaining positions and pairIds
      // DO NOT overwrite pairId - it would break the card pairing logic!
      cards.value.forEach((existingCard, index) => {
        if (newCards[index]) {
          existingCard.cs2Item = newCards[index].cs2Item;
          // Keep existing pairId - DO NOT overwrite it!
          // existingCard.pairId = newCards[index].pairId; // ← REMOVED: This was corrupting pairIds
        }
      });
    } else {
      cards.value = newCards;
    }
  };

  const restoreState = (savedCards: GameCard[]): void => {
    const cleanedSavedCards = savedCards.map((card) => ({
      ...card,
      state: card.state === "revealed" ? ("hidden" as const) : card.state,
    }));

    cards.value = [...cleanedSavedCards];

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
