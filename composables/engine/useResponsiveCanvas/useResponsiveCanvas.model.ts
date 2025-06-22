export interface CanvasDimensions {
  width: number;
  height: number;
}

export interface ResponsiveCanvasState {
  isResizing: boolean;
  isLoading: boolean;
  containerSize: CanvasDimensions;
  actualCanvasSize: CanvasDimensions;
  deviceInfo: {
    type: "mobile" | "tablet" | "desktop";
    orientation: "portrait" | "landscape";
    isTouch: boolean;
  };
}

export interface ResponsiveCanvasConfig {
  minWidth: number;
  minHeight: number;
  aspectRatio?: number;
  padding: number;
  resizeThrottleMs: number;
}
