// Main Engine Module Exports
// New composable-based architecture (recommended)
export { useEngineCore } from "./useEngineCore";

// Device detection
export { useDeviceDetection } from "./device";
export type { DeviceType, DeviceOrientation } from "./device";

// Canvas management
export { useCanvasState } from "./canvas/useCanvasState";
export { useResponsiveGrid as useResponsivePixiGrid } from "./canvas/useResponsiveGrid";

// Layout strategies
export {
  createLayout,
  calculateDesktopLayout,
  calculateMobilePortraitLayout,
  calculateMobileLandscapeLayout,
  getLayoutStrategy,
  getAllLayoutStrategies,
} from "./layout";
export type { GridParams, LayoutStrategyFunction } from "./layout";

// Simple layout generation for basic use cases
export { generateSimpleLayout } from "./layout/adaptiveGridLayout";

// Other composables
export { useTextureLoader } from "./canvas/useTextureLoader";
export { useCardRenderer } from "./canvas/useCardRenderer";
export { useParallaxEffect } from "./canvas/useParallaxEffect";

// Types re-exports
export type {
  GridLayout,
  GridPosition,
  LayoutCalculationContext,
  CanvasDimensions,
} from "./layout/adaptiveGridLayout";
export type {
  PixiResponsiveConfig,
  ResponsivePixiState,
} from "./useEngineCore.model";

// Constants
export { DEFAULT_CONFIG } from "./useEngineCore.constants";
