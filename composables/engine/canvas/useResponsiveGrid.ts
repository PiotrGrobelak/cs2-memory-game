import { shallowRef } from "vue";
import { Container, Graphics, type Application } from "pixi.js";
import type { GameCard } from "~/types/game";
import type { GridLayout } from "../layout/useLayoutStrategies";

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

  const redrawGrid = (): void => {
    gridContainer.value.removeChildren();

    const graphics = new Graphics();

    gridContainer.value.addChild(graphics);
  };

  const updateLayout = (
    cards: GameCard[],
    layout: GridLayout,
    forceRedraw = false
  ): GridLayout => {
    if (forceRedraw || !currentLayout.value || hasLayoutChanged(layout)) {
      redrawGrid();
      currentLayout.value = layout;
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
