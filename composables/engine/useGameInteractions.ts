import { ref } from "vue";
import type { Card } from "~/types/pixi";

export const useGameInteractions = () => {
  const isInteractive = ref(true);
  const hoveredCard = ref<string | null>(null);

  const setupCardInteraction = (
    sprite: Card,
    onCardClick: (cardId: string) => void
  ) => {
    sprite.interactive = true;
    sprite.cursor = "pointer";

    // Click/Tap handler
    sprite.on("pointerdown", () => {
      if (!isInteractive.value) return;
      onCardClick(sprite.cardId);
    });

    // Hover effects
    sprite.on("pointerover", () => {
      if (!isInteractive.value) return;
      hoveredCard.value = sprite.cardId;
      sprite.scale.set(sprite.scale.x * 1.05, sprite.scale.y * 1.05);
    });

    sprite.on("pointerout", () => {
      hoveredCard.value = null;
      sprite.scale.set(sprite.scale.x / 1.05, sprite.scale.y / 1.05);
    });
  };

  const setInteractive = (interactive: boolean) => {
    isInteractive.value = interactive;
  };

  const handleMouseMove = (
    event: MouseEvent,
    canvas: HTMLCanvasElement,
    onParallaxUpdate: (x: number, y: number) => void
  ) => {
    if (!isInteractive.value) return;

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
    if (!isInteractive.value || event.touches.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const touch = event.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    onParallaxUpdate(x, y);
  };

  return {
    isInteractive,
    hoveredCard,
    setupCardInteraction,
    setInteractive,
    handleMouseMove,
    handleTouchMove,
  };
};
