import type { Application } from "pixi.js";
import type {
  DeviceOrientation,
  GridLayout,
  DeviceType,
} from "../useAdaptiveGridLayout";

export interface PixiResponsiveConfig {
  minWidth: number;
  minHeight: number;
  padding: number;
  resizeThrottleMs: number;
  enableAutoResize: boolean;
  maintainAspectRatio: boolean;
  backgroundAlpha: number;
}

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
