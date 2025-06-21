import type { GameCard } from "~/types/game";

export const useLayoutEngine = () => {
  const calculateCardPositions = (
    cards: GameCard[],
    canvasWidth: number,
    canvasHeight: number,
    difficulty: "easy" | "medium" | "hard"
  ) => {
    const gridConfigs = {
      easy: { rows: 3, cols: 4 },
      medium: { rows: 4, cols: 6 },
      hard: { rows: 6, cols: 8 },
    };

    const grid = gridConfigs[difficulty];
    const cardWidth = 120;
    const cardHeight = 160;
    const padding = 20;

    // Calculate available space
    const totalWidth = grid.cols * cardWidth + (grid.cols - 1) * padding;
    const totalHeight = grid.rows * cardHeight + (grid.rows - 1) * padding;

    // Center on canvas
    const startX = (canvasWidth - totalWidth) / 2 + cardWidth / 2;
    const startY = (canvasHeight - totalHeight) / 2 + cardHeight / 2;

    const positions: Array<{ x: number; y: number; cardId: string }> = [];

    cards.forEach((card, index) => {
      const row = Math.floor(index / grid.cols);
      const col = index % grid.cols;

      const x = startX + col * (cardWidth + padding);
      const y = startY + row * (cardHeight + padding);

      positions.push({ x, y, cardId: card.id });
    });

    return positions;
  };

  const getResponsiveCardSize = (canvasWidth: number, canvasHeight: number) => {
    // Automatic card scaling based on canvas size
    const baseWidth = 120;
    const baseHeight = 160;

    const scaleX = canvasWidth / 1000; // Base canvas 1000px
    const scaleY = canvasHeight / 700; // Base canvas 700px
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale above 100%

    return {
      width: baseWidth * scale,
      height: baseHeight * scale,
      scale,
    };
  };

  return {
    calculateCardPositions,
    getResponsiveCardSize,
  };
};
