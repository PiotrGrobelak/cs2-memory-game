import { ref } from "vue";
import type { Card } from "~/types/pixi";
import type { GameCard } from "~/types/game";

export const useGameInteractions = () => {
  const isGloballyInteractive = ref(true);
  const hoveredCard = ref<string | null>(null);
  const cards = ref<GameCard[]>([]);
  const cardSprites = ref<Map<string, Card>>(new Map());

  /**
   * Check if a specific card should be interactive based on game rules
   */
  const shouldCardBeInteractive = (cardId: string): boolean => {
    if (!isGloballyInteractive.value) {
      console.log(`🚫 Card ${cardId} not interactive - globally disabled`);
      return false;
    }

    const card = cards.value.find((c) => c.id === cardId);
    if (!card) {
      console.log(`🚫 Card ${cardId} not found in cards array`);
      return false;
    }

    // Don't allow interaction with already revealed or matched cards
    if (card.state === "revealed" || card.state === "matched") {
      console.log(`🚫 Card ${cardId} not interactive - state: ${card.state}`);
      return false;
    }

    // Check if there are already 2 revealed cards
    const revealedCount = cards.value.filter(
      (c) => c.state === "revealed"
    ).length;
    if (revealedCount >= 2) {
      console.log(
        `🚫 Card ${cardId} not interactive - ${revealedCount} cards already revealed`
      );
      return false;
    }

    console.log(
      `✅ Card ${cardId} is interactive - state: ${card.state}, revealed count: ${revealedCount}`
    );
    return true;
  };

  /**
   * Update the interactive state of all card sprites based on current game state
   */
  const updateCardInteractivity = () => {
    console.log("🔄 GameInteractions: Updating card interactivity");
    cardSprites.value.forEach((sprite, cardId) => {
      const shouldBeInteractive = shouldCardBeInteractive(cardId);
      sprite.interactive = shouldBeInteractive;
      sprite.cursor = shouldBeInteractive ? "pointer" : "default";
    });
  };

  const setupCardInteraction = (
    sprite: Card,
    onCardClick: (cardId: string) => void
  ) => {
    // Store sprite reference
    cardSprites.value.set(sprite.cardId, sprite);

    sprite.interactive = true;
    sprite.cursor = "pointer";

    // Click/Tap handler
    sprite.on("pointerdown", () => {
      if (!shouldCardBeInteractive(sprite.cardId)) return;
      onCardClick(sprite.cardId);
    });

    // Hover effects
    sprite.on("pointerover", () => {
      if (!shouldCardBeInteractive(sprite.cardId)) return;
      hoveredCard.value = sprite.cardId;
      sprite.scale.set(sprite.scale.x * 1.05, sprite.scale.y * 1.05);
    });

    sprite.on("pointerout", () => {
      hoveredCard.value = null;
      sprite.scale.set(sprite.scale.x / 1.05, sprite.scale.y / 1.05);
    });
  };

  const setInteractive = (interactive: boolean) => {
    isGloballyInteractive.value = interactive;
    updateCardInteractivity();
  };

  /**
   * Update the cards data and refresh interactivity
   */
  const updateCards = (newCards: GameCard[]) => {
    cards.value = newCards;
    updateCardInteractivity();
  };

  /**
   * Clear all sprite references (useful for cleanup)
   */
  const clearSprites = () => {
    cardSprites.value.clear();
  };

  const handleMouseMove = (
    event: MouseEvent,
    canvas: HTMLCanvasElement,
    onParallaxUpdate: (x: number, y: number) => void
  ) => {
    if (!isGloballyInteractive.value) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    onParallaxUpdate(x, y);
  };

  const handleTouchMove = (
    event: TouchEvent,
    canvas: HTMLCanvasElement,
    onParallaxUpdate: (x: number, y: number) => void
  ) => {
    if (!isGloballyInteractive.value || event.touches.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const touch = event.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    onParallaxUpdate(x, y);
  };

  return {
    isGloballyInteractive,
    hoveredCard,
    setupCardInteraction,
    setInteractive,
    updateCards,
    clearSprites,
    handleMouseMove,
    handleTouchMove,
  };
};
