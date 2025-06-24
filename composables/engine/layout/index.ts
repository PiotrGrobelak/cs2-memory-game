// Barrel exports for layout module
export {
  createLayout,
  calculateDesktopLayout,
  calculateMobilePortraitLayout,
  calculateMobileLandscapeLayout,
  getLayoutStrategy,
  getAllLayoutStrategies,
} from "./useLayoutStrategies";
export type { GridParams, LayoutStrategyFunction } from "./useLayoutStrategies";

// Re-export types from the main layout file for convenience
export type {
  GridLayout,
  GridPosition,
  LayoutCalculationContext,
  DeviceType,
  DeviceOrientation,
  CanvasDimensions,
} from "./adaptiveGridLayout";
