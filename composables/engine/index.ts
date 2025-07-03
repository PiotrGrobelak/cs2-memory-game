// Main Engine Module Exports
// New composable-based architecture (recommended)
export { useEngineCore } from "./useEngineCore";

// Device detection
export { useDeviceDetection } from "./device";
export type { DeviceType, DeviceOrientation } from "./device";

// Canvas management
export { useCanvasState } from "./canvas/useCanvasState";
export { useResponsiveGrid as useResponsivePixiGrid } from "./canvas/useResponsiveGrid";

// Other composables
export { useTextureLoader } from "./canvas/useTextureLoader";
export { useCardRenderer } from "./canvas/useCardRenderer";
export { useParallaxEffect } from "./canvas/useParallaxEffect";

export type {
  PixiResponsiveConfig,
  ResponsivePixiState,
} from "./useEngineCore.model";

// Constants
// export { DEFAULT_CONFIG } from "./useEngineCore.constants";
