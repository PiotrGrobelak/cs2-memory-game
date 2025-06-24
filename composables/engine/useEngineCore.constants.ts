import type { PixiResponsiveConfig } from "./useEngineCore.model";

/**
 * Default configuration for PixiJS responsive canvas
 */
export const DEFAULT_CONFIG: PixiResponsiveConfig = {
  minWidth: 320,
  minHeight: 240,
  padding: 20,
  resizeThrottleMs: 150,
  enableAutoResize: true,
  maintainAspectRatio: true,
  backgroundAlpha: 0,
};
