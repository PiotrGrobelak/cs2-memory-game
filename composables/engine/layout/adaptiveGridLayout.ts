import type { GameCard } from "~/types/game";
import type { DeviceType, DeviceOrientation } from "../device";
import { createLayout, getLayoutStrategy } from "./useLayoutStrategies";
export interface GridPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridLayout {
  positions: GridPosition[];
  cardDimensions: {
    width: number;
    height: number;
  };
  cols: number;
  rows: number;
  totalGridWidth: number;
  totalGridHeight: number;
  efficiency: number;
  deviceType: DeviceType;
  orientation: DeviceOrientation;
}

export interface CanvasDimensions {
  width: number;
  height: number;
}

export type { DeviceType, DeviceOrientation };

export interface LayoutCalculationContext {
  canvasWidth: number;
  canvasHeight: number;
  cardCount: number;
  deviceType: DeviceType;
  orientation: DeviceOrientation;
  minCardSize: number;
  maxCardSize: number;
  gap: number;
  aspectRatio: number;
  paddingFactor: number;
}

export interface ILayoutStrategy {
  calculateLayout(context: LayoutCalculationContext): GridLayout;
  getStrategyName(): string;
}

export function createLayoutStrategy(
  deviceType: DeviceType,
  orientation: DeviceOrientation
): ILayoutStrategy {
  const strategyFunction = getLayoutStrategy(deviceType, orientation);

  return {
    calculateLayout: (context: LayoutCalculationContext): GridLayout => {
      const gridParams = strategyFunction(context);

      if (!gridParams) {
        throw new Error(
          `Failed to calculate valid grid parameters for ${deviceType} ${orientation}`
        );
      }

      return createLayout(gridParams);
    },
    getStrategyName: () =>
      `${deviceType}${orientation === "portrait" ? "Portrait" : "Landscape"}Strategy`,
  };
}

export function getAllLayoutStrategies(): ILayoutStrategy[] {
  return [
    createLayoutStrategy("desktop", "landscape"),
    createLayoutStrategy("mobile", "portrait"),
    createLayoutStrategy("mobile", "landscape"),
    createLayoutStrategy("tablet", "portrait"),
    createLayoutStrategy("tablet", "landscape"),
  ];
}

export function generateSimpleLayout(
  cards: GameCard[],
  canvasWidth: number,
  canvasHeight: number,
  deviceType: DeviceType = "desktop",
  orientation: DeviceOrientation = "landscape",
  options: {
    gap?: number;
    minCardSize?: number;
    maxCardSize?: number;
    aspectRatio?: number;
    paddingFactor?: number;
  } = {}
): GridLayout {
  // Default device settings
  const deviceDefaults = {
    mobile: {
      gap: 6,
      minCardSize: 40,
      maxCardSize: 120,
      aspectRatio: 0.8,
      paddingFactor: 0.05,
    },
    tablet: {
      gap: 10,
      minCardSize: 70,
      maxCardSize: 140,
      aspectRatio: 0.75,
      paddingFactor: 0.03,
    },
    desktop: {
      gap: 16,
      minCardSize: 40,
      maxCardSize: 180,
      aspectRatio: 0.7,
      paddingFactor: 0.02,
    },
  };

  const settings = { ...deviceDefaults[deviceType], ...options };
  const strategy = getLayoutStrategy(deviceType, orientation);

  const context: LayoutCalculationContext = {
    canvasWidth,
    canvasHeight,
    cardCount: cards.length,
    deviceType,
    orientation,
    ...settings,
  };

  const gridParams = strategy(context);

  if (!gridParams) {
    throw new Error(
      `Failed to calculate valid grid parameters for ${deviceType} ${orientation}`
    );
  }

  return createLayout(gridParams);
}
