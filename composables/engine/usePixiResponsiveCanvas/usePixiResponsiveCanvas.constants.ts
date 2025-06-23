import type { PixiResponsiveConfig } from "./usePixiResponsiveCanvas.model";

export const DEFAULT_CONFIG: PixiResponsiveConfig = {
  minWidth: 320,
  minHeight: 200,
  padding: 32,
  resizeThrottleMs: 150,
  enableAutoResize: true,
  maintainAspectRatio: false,
  backgroundAlpha: 0,
};
