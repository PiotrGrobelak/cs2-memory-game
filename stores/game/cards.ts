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

    console.log(`🎯 selectCard called for ${cardId}`, {
      cardExists: !!card,
      cardState: card?.state,
      selectedCount: selectedCards.value.length,
      selectedCards: selectedCards.value.map((id) => id),
      revealedCount: revealedCards.value.length,
      revealedCards: revealedCards.value.map((c) => ({
        id: c.id,
        state: c.state,
      })),
    });

    // Don't allow selection if card doesn't exist, is already revealed, or is matched
    if (!card) {
      console.log(`❌ Card ${cardId} not found`);
      return false;
    }

    if (card.state !== "hidden") {
      console.log(`❌ Card ${cardId} not hidden (state: ${card.state})`);
      return false;
    }

    // Don't allow new selections if 2 cards are already selected
    if (selectedCards.value.length >= 2) {
      console.log(
        `❌ Too many selected cards (${selectedCards.value.length}):`,
        selectedCards.value
      );
      return false;
    }

    // Additional safety check - make sure this card isn't already selected
    if (selectedCards.value.includes(cardId)) {
      console.log(`❌ Card ${cardId} already selected`);
      return false;
    }

    // Reveal the card
    card.state = "revealed";
    selectedCards.value.push(cardId);

    console.log("🔍 Revealed card state:", card.state);

    console.log(`✅ Card ${cardId} selected and revealed`, {
      newSelectedCount: selectedCards.value.length,
      newRevealedCount: revealedCards.value.length,
      selectedCards: selectedCards.value,
      selectedCardsLength: selectedCards.value.length,
      selectedCardsArray: [...selectedCards.value], // Force array expansion
    });

    return true;
  };

  const checkForMatch = (): boolean => {
    console.log(`🔍 checkForMatch called`, {
      selectedCount: selectedCards.value.length,
      selectedCards: selectedCards.value,
      revealedCount: revealedCards.value.length,
      revealedCardIds: revealedCards.value.map((c) => c.id),
    });

    // Only proceed if exactly 2 cards are selected
    if (selectedCards.value.length !== 2) {
      console.log(
        `❌ Wrong number of selected cards: ${selectedCards.value.length}`
      );
      return false;
    }

    const [firstCardId, secondCardId] = selectedCards.value;
    const firstCard = cards.value.find((c) => c.id === firstCardId);
    const secondCard = cards.value.find((c) => c.id === secondCardId);

    if (!firstCard || !secondCard) {
      console.log(`❌ Cards not found:`, {
        firstCard: !!firstCard,
        secondCard: !!secondCard,
      });
      // Clear selection if cards not found
      selectedCards.value = [];
      return false;
    }

    const isMatch = firstCard.pairId === secondCard.pairId;

    console.log(`🎮 Match check result:`, {
      firstCard: { id: firstCard.id, pairId: firstCard.pairId },
      secondCard: { id: secondCard.id, pairId: secondCard.pairId },
      isMatch,
    });

    if (isMatch) {
      // Match found
      firstCard.state = "matched";
      secondCard.state = "matched";
      console.log(
        `✅ Match found! Cards ${firstCard.id} and ${secondCard.id} matched`
      );
    } else {
      // No match - schedule hiding cards after 1 second
      console.log(
        `❌ No match - scheduling hide for cards ${firstCard.id} and ${secondCard.id} in 1000ms`
      );

      // Store references to avoid closure issues
      const cardToHide1 = firstCard;
      const cardToHide2 = secondCard;

      setTimeout(() => {
        console.log(
          `⏰ Timeout triggered - attempting to hide cards ${cardToHide1.id} and ${cardToHide2.id}`
        );
        console.log(
          `Current states: ${cardToHide1.id}=${cardToHide1.state}, ${cardToHide2.id}=${cardToHide2.state}`
        );

        let hiddenCount = 0;

        // Check if cards are still in revealed state before hiding
        if (cardToHide1.state === "revealed") {
          cardToHide1.state = "hidden";
          hiddenCount++;
          console.log(`🔄 Card ${cardToHide1.id} hidden`);
        } else {
          console.log(
            `⚠️  Card ${cardToHide1.id} not hidden - current state: ${cardToHide1.state}`
          );
        }

        if (cardToHide2.state === "revealed") {
          cardToHide2.state = "hidden";
          hiddenCount++;
          console.log(`🔄 Card ${cardToHide2.id} hidden`);
        } else {
          console.log(
            `⚠️  Card ${cardToHide2.id} not hidden - current state: ${cardToHide2.state}`
          );
        }

        console.log(
          `🔄 Cards hiding complete, ${hiddenCount} cards hidden, current revealed count: ${revealedCards.value.length}`
        );

        // Force reactivity update
        cards.value = [...cards.value];
      }, 1000);
    }

    // Clear selected cards immediately after processing
    selectedCards.value = [];
    console.log(`🧹 Selected cards cleared, can now select new cards`);
    return isMatch;
  };

  const generateCards = async (
    difficulty: DifficultyLevel,
    seed: string,
    cs2Items: CS2Item[] = []
  ): Promise<void> => {
    // Reset cards
    cards.value = [];
    selectedCards.value = [];

    // Handle edge case of zero grid size
    if (difficulty.gridSize.rows === 0 || difficulty.gridSize.cols === 0) {
      console.warn("Grid size is zero, no cards generated");
      return;
    }

    const cardPairs = difficulty.cardCount / 2;
    let availableItems: CS2Item[] = [];

    // Try to get CS2 items from API if not provided
    if (cs2Items.length === 0) {
      try {
        console.log("Fetching CS2 items for card generation...");
        availableItems = await cs2ApiService.getCS2Items(cardPairs * 2); // Get more items than needed for variety
        console.log(`Fetched ${availableItems.length} CS2 items for cards`);
      } catch (error) {
        console.warn("Failed to fetch CS2 items, using placeholders:", error);
        availableItems = [];
      }
    } else {
      availableItems = cs2Items;
    }

    // If we don't have enough items, create placeholders
    if (availableItems.length < cardPairs) {
      console.log(
        `Need ${cardPairs} items but only have ${availableItems.length}, creating placeholders`
      );

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

    // Select items for this game (shuffle available items first)
    const shuffledItems = [...availableItems].sort(() => Math.random() - 0.5);
    const selectedItems = shuffledItems.slice(0, cardPairs);

    const newCards: GameCard[] = [];

    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];
      const pairId = `pair-${i}`;

      // Create two cards for each pair
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

    // Shuffle cards using seed-based randomization
    shuffleCards(newCards, seed, difficulty.gridSize);

    // Set positions based on grid
    setCardPositions(newCards, difficulty.gridSize);

    cards.value = newCards;

    console.log(
      `Generated ${newCards.length} cards (${selectedItems.length} pairs) with ${selectedItems.filter((item) => !item.id.startsWith("placeholder")).length} real CS2 items`
    );

    // Preload images for all cards
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

  const debugCardStates = (): void => {
    console.log("🐛 Debug Card States:");
    console.log(`Total cards: ${cards.value.length}`);
    console.log(`Hidden: ${hiddenCards.value.length}`);
    console.log(`Revealed: ${revealedCards.value.length}`);
    console.log(`Matched: ${matchedCards.value.length}`);
    console.log(`Selected: ${selectedCards.value.length}`);

    console.log(
      "Revealed cards:",
      revealedCards.value.map((c) => ({ id: c.id, pairId: c.pairId }))
    );
    console.log("Selected cards:", selectedCards.value);

    // Check for any inconsistencies
    const totalStates =
      hiddenCards.value.length +
      revealedCards.value.length +
      matchedCards.value.length;
    if (totalStates !== cards.value.length) {
      console.warn(
        `⚠️  State count mismatch! Total cards: ${cards.value.length}, Total states: ${totalStates}`
      );
    }
  };

  // Helper functions
  const shuffleCards = (
    cardsArray: GameCard[],
    seed: string,
    gridSize: { rows: number; cols: number }
  ): void => {
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

    // Multiple shuffle passes for better randomization
    for (let pass = 0; pass < 3; pass++) {
      currentIndex = cardsArray.length;

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
    }

    // Validate and fix adjacent pairs if any exist
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
    const maxAttempts = 50; // Increase attempts for better success rate

    // Create a seeded random number generator for consistent results
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

      // Check for adjacent pairs (horizontal and vertical)
      for (let i = 0; i < cardsArray.length && !hasAdjacentPairs; i++) {
        const currentCard = cardsArray[i];
        const adjacentIndices: number[] = [];

        // Horizontal adjacency
        if (i % gridCols !== gridCols - 1 && i + 1 < cardsArray.length) {
          adjacentIndices.push(i + 1); // Right
        }
        if (i % gridCols !== 0 && i - 1 >= 0) {
          adjacentIndices.push(i - 1); // Left
        }

        // Vertical adjacency
        if (i + gridCols < cardsArray.length) {
          adjacentIndices.push(i + gridCols); // Down
        }
        if (i - gridCols >= 0) {
          adjacentIndices.push(i - gridCols); // Up
        }

        // Check if any adjacent card has the same pairId
        for (const adjIndex of adjacentIndices) {
          if (cardsArray[adjIndex].pairId === currentCard.pairId) {
            hasAdjacentPairs = true;
            break;
          }
        }
      }

      if (!hasAdjacentPairs) {
        break; // No adjacent pairs found, we're done
      }

      // If we found adjacent pairs, do a random shuffle and try again
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
    // Restore cards from saved state
    cards.value = [...savedCards];

    // Clear selected cards on restore
    selectedCards.value = [];
  };

  /**
   * Debug utility: Check for adjacent pairs in current card layout
   */
  const debugCheckAdjacentPairs = (): {
    hasAdjacent: boolean;
    adjacentPairs: string[];
  } => {
    const adjacentPairs: string[] = [];

    // Use correct grid dimensions based on actual card count
    let gridCols: number;
    if (cards.value.length === 12)
      gridCols = 4; // 3x4
    else if (cards.value.length === 24)
      gridCols = 6; // 4x6
    else if (cards.value.length === 48)
      gridCols = 8; // 6x8
    else gridCols = Math.ceil(Math.sqrt(cards.value.length)); // Fallback

    for (let i = 0; i < cards.value.length; i++) {
      const currentCard = cards.value[i];
      const adjacentIndices: number[] = [];

      // Horizontal adjacency (check bounds)
      if (i % gridCols !== gridCols - 1 && i + 1 < cards.value.length) {
        adjacentIndices.push(i + 1); // Right
      }
      if (i % gridCols !== 0 && i - 1 >= 0) {
        adjacentIndices.push(i - 1); // Left
      }

      // Vertical adjacency (check bounds)
      if (i + gridCols < cards.value.length) {
        adjacentIndices.push(i + gridCols); // Down
      }
      if (i - gridCols >= 0) {
        adjacentIndices.push(i - gridCols); // Up
      }

      // Check if any adjacent card has the same pairId
      for (const adjIndex of adjacentIndices) {
        // Double-check bounds to be safe
        if (adjIndex >= 0 && adjIndex < cards.value.length) {
          const adjacentCard = cards.value[adjIndex];
          if (adjacentCard && adjacentCard.pairId === currentCard.pairId) {
            adjacentPairs.push(
              `${currentCard.pairId} at positions ${i} and ${adjIndex}`
            );
          }
        }
      }
    }

    return {
      hasAdjacent: adjacentPairs.length > 0,
      adjacentPairs,
    };
  };

  /**
   * Debug utility: Get card layout as grid for visualization
   */
  const debugGetCardGrid = (): string[][] => {
    // Use correct grid dimensions based on actual card count
    let gridCols: number;
    if (cards.value.length === 12)
      gridCols = 4; // 3x4
    else if (cards.value.length === 24)
      gridCols = 6; // 4x6
    else if (cards.value.length === 48)
      gridCols = 8; // 6x8
    else gridCols = Math.ceil(Math.sqrt(cards.value.length)); // Fallback

    const grid: string[][] = [];

    for (let i = 0; i < cards.value.length; i += gridCols) {
      const row = cards.value.slice(i, i + gridCols).map((card) => card.pairId);
      grid.push(row);
    }

    return grid;
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
    debugCheckAdjacentPairs,
    debugGetCardGrid,
    debugCardStates,
  };
});
