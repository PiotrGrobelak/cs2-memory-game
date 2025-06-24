import { shallowRef, onUnmounted } from "vue";
import { Container, Graphics, type Application } from "pixi.js";
import type { GameCard } from "~/types/game";
import type { GridLayout } from "../layout/adaptiveGridLayout";

/**
 * Responsive Grid Composable
 *
 * Handles the creation and management of responsive grid layout
 * for the PixiJS canvas in the CS2 Memory Game.
 *
 * This composable is responsible for:
 * - Managing grid and cards containers
 * - Updating layout based on game cards
 * - Redrawing grid when layout changes
 * - Providing access to cards container for rendering
 *
 */
export const useResponsiveGrid = (app: Application) => {
  const gridContainer = shallowRef<Container>(new Container());
  const cardsContainer = shallowRef<Container>(new Container());
  const currentLayout = shallowRef<GridLayout | null>(null);

  const initializeContainers = () => {
    app.stage.addChild(gridContainer.value);
    app.stage.addChild(cardsContainer.value);
  };

  /**
   * Checks if the new layout differs significantly from the current layout
   */
  const hasLayoutChanged = (newLayout: GridLayout): boolean => {
    if (!currentLayout.value) return true;

    const current = currentLayout.value;
    return (
      current.cols !== newLayout.cols ||
      current.rows !== newLayout.rows ||
      Math.abs(current.cardDimensions.width - newLayout.cardDimensions.width) >
        1 ||
      Math.abs(
        current.cardDimensions.height - newLayout.cardDimensions.height
      ) > 1
    );
  };

  const redrawGrid = (layout: GridLayout): void => {
    gridContainer.value.removeChildren();

    const graphics = new Graphics();

    const { cardDimensions } = layout;
    const { width: cardWidth, height: cardHeight } = cardDimensions;

    // Draw grid lines (optional, for debugging)
    if (process.env.NODE_ENV === "development") {
      layout.positions.forEach((pos) => {
        graphics
          .rect(
            pos.x - cardWidth / 2,
            pos.y - cardHeight / 2,
            cardWidth,
            cardHeight
          )
          .stroke({
            color: 0x333333,
            width: 1,
            alpha: 0.3,
          });
      });
    }

    gridContainer.value.addChild(graphics);
  };

  const updateLayout = (
    cards: GameCard[],
    layout: GridLayout,
    forceRedraw = false
  ): GridLayout => {
    if (forceRedraw || !currentLayout.value || hasLayoutChanged(layout)) {
      redrawGrid(layout);
      currentLayout.value = layout;

      if (process.env.NODE_ENV === "development") {
        console.log("🎯 ResponsivePixiGrid Updated:", {
          gridSize: `${layout.cols}×${layout.rows}`,
          cardSize: `${layout.cardDimensions.width}×${layout.cardDimensions.height}px`,
          efficiency: Math.round(layout.efficiency * 100) + "%",
          positionsCount: layout.positions.length,
        });
      }
    }

    return layout;
  };

  const getCardsContainer = (): Container => {
    return cardsContainer.value;
  };

  const getCurrentLayout = (): GridLayout | null => {
    return currentLayout.value;
  };

  const destroy = (): void => {
    gridContainer.value.destroy({ children: true });
    cardsContainer.value.destroy({ children: true });
    currentLayout.value = null;
  };

  initializeContainers();

  onUnmounted(() => {
    destroy();
  });

  return {
    // State
    gridContainer,
    cardsContainer,
    currentLayout,

    // Methods
    updateLayout,
    getCardsContainer,
    getCurrentLayout,
    destroy,

    // Internal methods exposed for testing
    hasLayoutChanged,
    redrawGrid,
  };
};
