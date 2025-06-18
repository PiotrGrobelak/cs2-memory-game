interface CanvasConfig {
  width: number;
  height: number;
  pixelRatio?: number;
}

interface RenderCallback {
  (): void;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationId: number | null = null;
  private isRendering = false;
  private pixelRatio: number;

  constructor(canvas: HTMLCanvasElement, config?: Partial<CanvasConfig>) {
    this.canvas = canvas;
    this.pixelRatio = config?.pixelRatio || window.devicePixelRatio || 1;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to get 2D context from canvas");
    }

    this.ctx = context;
    this.setupCanvas(config);
  }

  private setupCanvas(config?: Partial<CanvasConfig>) {
    // Set canvas size with proper pixel ratio handling
    if (config?.width && config?.height) {
      this.setSize(config.width, config.height);
    }

    // Configure context for crisp rendering
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
  }

  /**
   * Set canvas size with proper pixel ratio handling
   */
  setSize(width: number, height: number) {
    // Set actual canvas size (in memory)
    this.canvas.width = width * this.pixelRatio;
    this.canvas.height = height * this.pixelRatio;

    // Set display size (CSS pixels)
    this.canvas.style.width = width + "px";
    this.canvas.style.height = height + "px";

    // Scale context to match pixel ratio
    this.ctx.scale(this.pixelRatio, this.pixelRatio);
  }

  /**
   * Start the render loop with a callback
   */
  startRenderLoop(renderCallback: RenderCallback) {
    if (this.isRendering) {
      console.warn("Render loop is already running");
      return;
    }

    this.isRendering = true;

    const render = () => {
      if (!this.isRendering) return;

      try {
        renderCallback();
        this.animationId = requestAnimationFrame(render);
      } catch (error) {
        console.error("Error in render callback:", error);
        this.stopRenderLoop();
      }
    };

    render();
  }

  /**
   * Stop the render loop
   */
  stopRenderLoop() {
    this.isRendering = false;

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Clear the entire canvas
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Get the canvas context for direct drawing operations
   */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  /**
   * Get canvas dimensions
   */
  getDimensions() {
    return {
      width: this.canvas.width / this.pixelRatio,
      height: this.canvas.height / this.pixelRatio,
      actualWidth: this.canvas.width,
      actualHeight: this.canvas.height,
      pixelRatio: this.pixelRatio,
    };
  }

  /**
   * Convert screen coordinates to canvas coordinates
   */
  screenToCanvas(screenX: number, screenY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    return {
      x: ((screenX - rect.left) * scaleX) / this.pixelRatio,
      y: ((screenY - rect.top) * scaleY) / this.pixelRatio,
    };
  }

  /**
   * Check if a point is within canvas bounds
   */
  isPointInCanvas(x: number, y: number): boolean {
    const dimensions = this.getDimensions();
    return x >= 0 && x <= dimensions.width && y >= 0 && y <= dimensions.height;
  }

  /**
   * Get canvas performance metrics
   */
  getPerformanceMetrics() {
    return {
      isRendering: this.isRendering,
      animationId: this.animationId,
      pixelRatio: this.pixelRatio,
      contextSettings: {
        imageSmoothingEnabled: this.ctx.imageSmoothingEnabled,
        imageSmoothingQuality: this.ctx.imageSmoothingQuality,
      },
    };
  }

  /**
   * Cleanup resources and stop rendering
   */
  cleanup() {
    this.stopRenderLoop();

    // Clear canvas
    this.clear();

    // Reset context settings
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    console.log("CanvasRenderer cleaned up");
  }
}
