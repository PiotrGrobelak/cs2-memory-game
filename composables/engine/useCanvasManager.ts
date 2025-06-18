/**
 * useCanvasManager - Canvas lifecycle and context management
 *
 * This composable provides low-level canvas management:
 * - Initializes canvas with high-DPI support for crisp rendering
 * - Manages rendering lifecycle (start/stop/pause)
 * - Handles resize events and cleanup resources
 * - Monitors performance metrics (FPS, memory usage)
 * - Optimizes dirty rendering to reduce unnecessary redraws
 *
 * Key features:
 * - High-DPI canvas setup for Retina displays
 * - Smart rendering cycles with dirty flag optimization
 * - Performance monitoring and frame rate tracking
 * - Memory efficient resource management
 * - Graceful cleanup and error handling
 */
import { ref, reactive, readonly } from "vue";

// Canvas configuration interface
interface CanvasConfig {
  enableHighDPI: boolean;
  targetFPS: number;
  enablePerformanceMonitoring: boolean;
  maxMemoryUsage: number; // MB
}

// Performance metrics interface
interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  renderCalls: number;
  skippedFrames: number;
}

// Canvas manager state interface
interface CanvasManagerState {
  isInitialized: boolean;
  isRunning: boolean;
  isPaused: boolean;
  lastFrameTime: number;
  frameCount: number;
  animationFrameId: number | null;
  isDirty: boolean;
}

// Default configuration
const DEFAULT_CONFIG: CanvasConfig = {
  enableHighDPI: true,
  targetFPS: 60,
  enablePerformanceMonitoring: true,
  maxMemoryUsage: 100, // 100MB
};

export const useCanvasManager = (config: Partial<CanvasConfig> = {}) => {
  // Merge configuration with defaults
  const canvasConfig = { ...DEFAULT_CONFIG, ...config };

  // Canvas references
  const canvas = ref<HTMLCanvasElement>();
  const context = ref<CanvasRenderingContext2D>();

  // Canvas manager state
  const state = reactive<CanvasManagerState>({
    isInitialized: false,
    isRunning: false,
    isPaused: false,
    lastFrameTime: 0,
    frameCount: 0,
    animationFrameId: null,
    isDirty: true,
  });

  // Performance metrics
  const metrics = reactive<PerformanceMetrics>({
    fps: 0,
    frameTime: 0,
    memoryUsage: 0,
    renderCalls: 0,
    skippedFrames: 0,
  });

  // Rendering callbacks
  const renderCallbacks = new Set<() => void>();
  const updateCallbacks = new Set<(deltaTime: number) => boolean>();

  // Frame timing
  const frameSkipThreshold = 1000 / canvasConfig.targetFPS;

  /**
   * Initialize canvas with high-DPI support
   */
  const initialize = async (
    canvasElement: HTMLCanvasElement
  ): Promise<void> => {
    if (state.isInitialized) {
      console.warn("Canvas manager already initialized");
      return;
    }

    try {
      canvas.value = canvasElement;
      const ctx = canvasElement.getContext("2d");

      if (!ctx) {
        throw new Error("Failed to get 2D context from canvas");
      }

      context.value = ctx;

      // Setup high-DPI canvas if enabled
      if (canvasConfig.enableHighDPI) {
        setupHighDPICanvas(canvasElement, ctx);
      }

      // Initialize canvas context settings
      setupCanvasContext(ctx);

      state.isInitialized = true;
      state.isDirty = true;

      console.log("Canvas manager initialized successfully", {
        highDPI: canvasConfig.enableHighDPI,
        targetFPS: canvasConfig.targetFPS,
        size: {
          width: canvasElement.width,
          height: canvasElement.height,
        },
      });
    } catch (error) {
      console.error("Failed to initialize canvas manager:", error);
      throw error;
    }
  };

  /**
   * Start the rendering loop
   */
  const start = (): void => {
    if (!state.isInitialized) {
      console.error("Cannot start rendering: canvas not initialized");
      return;
    }

    if (state.isRunning) {
      console.warn("Rendering loop already running");
      return;
    }

    state.isRunning = true;
    state.isPaused = false;
    state.lastFrameTime = performance.now();

    // Reset metrics
    metrics.frameTime = 0;
    metrics.renderCalls = 0;
    metrics.skippedFrames = 0;

    // Start the rendering loop
    renderLoop();

    console.log("Canvas rendering started");
  };

  /**
   * Stop the rendering loop
   */
  const stop = (): void => {
    state.isRunning = false;
    state.isPaused = false;

    if (state.animationFrameId !== null) {
      cancelAnimationFrame(state.animationFrameId);
      state.animationFrameId = null;
    }

    console.log("Canvas rendering stopped");
  };

  /**
   * Pause the rendering loop
   */
  const pause = (): void => {
    if (!state.isRunning) return;

    state.isPaused = true;
    console.log("Canvas rendering paused");
  };

  /**
   * Resume the rendering loop
   */
  const resume = (): void => {
    if (!state.isRunning || !state.isPaused) return;

    state.isPaused = false;
    state.lastFrameTime = performance.now();
    console.log("Canvas rendering resumed");
  };

  /**
   * Main rendering loop
   */
  const renderLoop = (): void => {
    if (!state.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - state.lastFrameTime;

    // Skip frame if running too fast
    if (deltaTime < frameSkipThreshold) {
      state.animationFrameId = requestAnimationFrame(renderLoop);
      metrics.skippedFrames++;
      return;
    }

    state.lastFrameTime = currentTime;
    state.frameCount++;

    // Update FPS every 60 frames
    if (state.frameCount % 60 === 0) {
      metrics.fps = Math.round(1000 / deltaTime);
      metrics.frameTime = deltaTime;

      // Update memory usage if monitoring enabled
      if (canvasConfig.enablePerformanceMonitoring) {
        updateMemoryMetrics();
      }
    }

    // Skip rendering if paused, but continue update loop
    if (state.isPaused) {
      state.animationFrameId = requestAnimationFrame(renderLoop);
      return;
    }

    // Execute update callbacks and check for changes
    let hasChanges = false;
    updateCallbacks.forEach((callback) => {
      try {
        const changed = callback(deltaTime);
        if (changed) hasChanges = true;
      } catch (error) {
        console.error("Error in update callback:", error);
      }
    });

    // Only render if there are changes or forced dirty flag
    if (state.isDirty || hasChanges) {
      render();
      state.isDirty = false;
      metrics.renderCalls++;
    }

    // Schedule next frame
    state.animationFrameId = requestAnimationFrame(renderLoop);
  };

  /**
   * Execute render callbacks
   */
  const render = (): void => {
    if (!context.value) return;

    // Clear canvas
    const ctx = context.value;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Execute render callbacks
    renderCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error("Error in render callback:", error);
      }
    });
  };

  /**
   * Setup high-DPI canvas for crisp rendering
   */
  const setupHighDPICanvas = (
    canvasElement: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
  ): void => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvasElement.getBoundingClientRect();

    // Set actual canvas size
    canvasElement.width = rect.width * dpr;
    canvasElement.height = rect.height * dpr;

    // Scale the canvas back down using CSS
    canvasElement.style.width = rect.width + "px";
    canvasElement.style.height = rect.height + "px";

    // Scale the drawing context to account for device pixel ratio
    ctx.scale(dpr, dpr);

    console.log("High-DPI canvas setup completed", {
      dpr,
      canvasSize: { width: canvasElement.width, height: canvasElement.height },
      cssSize: { width: rect.width, height: rect.height },
    });
  };

  /**
   * Setup canvas context with optimal settings
   */
  const setupCanvasContext = (ctx: CanvasRenderingContext2D): void => {
    // Set rendering quality settings
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Set text rendering settings
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Set line settings
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    console.log("Canvas context configured");
  };

  /**
   * Update memory usage metrics
   */
  const updateMemoryMetrics = (): void => {
    // Performance.memory is available in Chrome but not standard
    const perfWithMemory = performance as Performance & {
      memory?: { usedJSHeapSize: number };
    };

    if (perfWithMemory.memory) {
      metrics.memoryUsage = Math.round(
        perfWithMemory.memory.usedJSHeapSize / (1024 * 1024)
      );

      // Warn if memory usage is too high
      if (metrics.memoryUsage > canvasConfig.maxMemoryUsage) {
        console.warn(`High memory usage: ${metrics.memoryUsage}MB`);
      }
    }
  };

  /**
   * Mark canvas as dirty for next render
   */
  const markDirty = (): void => {
    state.isDirty = true;
  };

  /**
   * Resize canvas to new dimensions
   */
  const resize = (width: number, height: number): void => {
    if (!canvas.value || !context.value) return;

    // Update canvas size
    canvas.value.width = width;
    canvas.value.height = height;

    // Re-setup high-DPI if enabled
    if (canvasConfig.enableHighDPI) {
      setupHighDPICanvas(canvas.value, context.value);
    }

    // Re-setup context settings
    setupCanvasContext(context.value);

    // Mark as dirty for re-render
    markDirty();

    console.log("Canvas resized", { width, height });
  };

  /**
   * Add render callback
   */
  const addRenderCallback = (callback: () => void): void => {
    renderCallbacks.add(callback);
  };

  /**
   * Remove render callback
   */
  const removeRenderCallback = (callback: () => void): void => {
    renderCallbacks.delete(callback);
  };

  /**
   * Add update callback
   */
  const addUpdateCallback = (
    callback: (deltaTime: number) => boolean
  ): void => {
    updateCallbacks.add(callback);
  };

  /**
   * Remove update callback
   */
  const removeUpdateCallback = (
    callback: (deltaTime: number) => boolean
  ): void => {
    updateCallbacks.delete(callback);
  };

  /**
   * Clean up resources
   */
  const cleanup = (): void => {
    stop();

    // Clear callbacks
    renderCallbacks.clear();
    updateCallbacks.clear();

    // Reset state
    canvas.value = undefined;
    context.value = undefined;
    state.isInitialized = false;

    console.log("Canvas manager cleaned up");
  };

  /**
   * Get current performance metrics
   */
  const getMetrics = () => readonly(metrics);

  /**
   * Get current state
   */
  const getState = () => readonly(state);

  return {
    // Canvas references
    canvas: readonly(canvas),
    context: readonly(context),

    // State
    state: getState(),
    metrics: getMetrics(),

    // Lifecycle methods
    initialize,
    start,
    stop,
    pause,
    resume,
    cleanup,

    // Utility methods
    markDirty,
    resize,

    // Callback management
    addRenderCallback,
    removeRenderCallback,
    addUpdateCallback,
    removeUpdateCallback,
  };
};
