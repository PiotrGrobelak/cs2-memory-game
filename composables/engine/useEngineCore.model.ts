import type { Application } from "pixi.js";
import type {
  DeviceOrientation,
  GridLayout,
  DeviceType,
} from "./layout/adaptiveGridLayout";

/**
 * Configuration interface for PixiJS responsive canvas
 * Used by useEngineCore and related composables
 */
export interface PixiResponsiveConfig {
  minWidth: number;
  minHeight: number;
  padding: number;
  resizeThrottleMs: number;
  enableAutoResize: boolean;
  maintainAspectRatio: boolean;
  backgroundAlpha: number;
}

/**
 * Internal state interface for responsive Pixi applications
 * @deprecated Will be refactored in future versions
 */
export interface ResponsivePixiState {
  isResizing: boolean;
  isLoading: boolean;
  isOrientationChanging: boolean;
  pixiApp: Application | null;
  currentLayout: GridLayout | null;
  deviceInfo: {
    type: DeviceType;
    orientation: DeviceOrientation;
    isTouch: boolean;
    userAgent?: string;
  };
}

/**
 * Engine configuration with optional pixi app
 */
export interface EngineConfig extends PixiResponsiveConfig {
  pixiApp?: Application | null;
}
