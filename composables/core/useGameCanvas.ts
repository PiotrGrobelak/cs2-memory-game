import { ref, computed, watch, nextTick } from "vue";
import type { GridLayout } from "~/composables/engine/useAdaptiveGridLayout";

interface CanvasError {
  type: "initialization" | "rendering" | "memory" | "critical";
  message: string;
  timestamp: number;
  retryCount: number;
  canRecover: boolean;
}

interface CanvasPerformanceMetrics {
  initTime: number;
  renderTime: number;
  memoryUsage: number;
  errorCount: number;
}

export const useGameCanvas = () => {
  const canvasKey = ref<string>(`canvas-${Date.now()}`);
  const isCanvasReady = ref(false);
  const canvasError = ref<CanvasError | null>(null);
  const isCanvasLoading = ref(false);
  const currentLayout = ref<GridLayout | null>(null);
  const performanceMetrics = ref<CanvasPerformanceMetrics>({
    initTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    errorCount: 0,
  });

  // Progressive enhancement flags
  const hasWebGL = ref(true);
  const hasFallbackCanvas = ref(false);
  const degradationLevel = ref<"none" | "reduced" | "minimal">("none");

  // Recovery configuration
  const RECOVERY_CONFIG = {
    MAX_RETRIES: 3,
    RETRY_DELAYS: [1000, 2000, 5000], // Progressive delays
    CRITICAL_ERROR_TIMEOUT: 10000,
    MEMORY_THRESHOLD: 100, // MB
  } as const;

  // Error classification and handling
  const createError = (
    type: CanvasError["type"],
    message: string,
    canRecover = true
  ): CanvasError => ({
    type,
    message,
    timestamp: Date.now(),
    retryCount: 0,
    canRecover,
  });

  const classifyError = (error: unknown): CanvasError => {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // WebGL context lost
    if (errorMessage.includes("webgl") || errorMessage.includes("context")) {
      hasWebGL.value = false;
      return createError("critical", "WebGL context lost or unavailable", true);
    }

    // Memory pressure
    if (
      errorMessage.includes("memory") ||
      errorMessage.includes("allocation")
    ) {
      return createError("memory", "Memory allocation failed", true);
    }

    // Pixi initialization failure
    if (errorMessage.includes("pixi") || errorMessage.includes("application")) {
      return createError(
        "initialization",
        "Pixi.js initialization failed",
        true
      );
    }

    // Rendering errors
    if (errorMessage.includes("render") || errorMessage.includes("texture")) {
      return createError("rendering", "Rendering system error", true);
    }

    // Generic critical error
    return createError("critical", errorMessage, false);
  };

  const resetCanvas = async (forceDegradation = false) => {
    const startTime = Date.now();

    try {
      canvasKey.value = `canvas-${Date.now()}`;
      isCanvasReady.value = false;
      canvasError.value = null;

      if (forceDegradation) {
        degradationLevel.value =
          degradationLevel.value === "none" ? "reduced" : "minimal";
        console.log(
          `🔄 Canvas reset with degradation level: ${degradationLevel.value}`
        );
      }

      await nextTick(); // Allow DOM to update

      performanceMetrics.value.initTime = Date.now() - startTime;
    } catch (err) {
      console.error("Failed to reset canvas:", err);
      canvasError.value = createError("critical", "Canvas reset failed", false);
    }
  };

  const handleCanvasReady = () => {
    isCanvasReady.value = true;
    canvasError.value = null;
    degradationLevel.value = "none"; // Reset degradation on successful init

    console.log("✅ Canvas ready with performance:", {
      initTime: performanceMetrics.value.initTime,
      degradationLevel: degradationLevel.value,
    });
  };

  const handleCanvasError = async (error?: string | Error | unknown) => {
    const classifiedError = classifyError(error);
    performanceMetrics.value.errorCount++;

    isCanvasReady.value = false;
    canvasError.value = classifiedError;

    console.error(
      `🚨 Canvas error [${classifiedError.type}]:`,
      classifiedError.message
    );

    // Automatic recovery for recoverable errors
    if (
      classifiedError.canRecover &&
      classifiedError.retryCount < RECOVERY_CONFIG.MAX_RETRIES
    ) {
      const retryDelay =
        RECOVERY_CONFIG.RETRY_DELAYS[classifiedError.retryCount] || 5000;

      console.log(
        `🔄 Attempting automatic recovery in ${retryDelay}ms (attempt ${classifiedError.retryCount + 1})`
      );

      setTimeout(async () => {
        if (canvasError.value) {
          canvasError.value.retryCount++;
          await resetCanvas(
            classifiedError.type === "memory" ||
              classifiedError.type === "critical"
          );
        }
      }, retryDelay);
    } else if (!classifiedError.canRecover) {
      // Enable fallback mode for non-recoverable errors
      hasFallbackCanvas.value = true;
      degradationLevel.value = "minimal";
      console.log("🚨 Enabling fallback canvas mode due to critical error");
    }
  };

  const handleLoadingStateChanged = (loading: boolean) => {
    isCanvasLoading.value = loading;
  };

  const handleLayoutChanged = (layout: GridLayout) => {
    currentLayout.value = layout;
  };

  // Enhanced canvas status with degradation awareness
  const canvasStatus = computed(() => {
    if (canvasError.value) {
      if (canvasError.value.canRecover) return "error-recoverable";
      return "error-critical";
    }
    if (isCanvasLoading.value) return "loading";
    if (isCanvasReady.value) {
      if (degradationLevel.value !== "none") return "ready-degraded";
      return "ready";
    }
    return "initializing";
  });

  const shouldShowCanvas = computed(() => {
    const status = canvasStatus.value;
    return (
      status === "ready" ||
      status === "ready-degraded" ||
      status === "loading" ||
      (status === "error-recoverable" && canvasError.value?.retryCount === 0)
    );
  });

  const shouldShowFallback = computed(() => {
    return (
      hasFallbackCanvas.value ||
      (canvasError.value?.type === "critical" && !canvasError.value.canRecover)
    );
  });

  // Performance monitoring
  const getPerformanceReport = computed(() => ({
    ...performanceMetrics.value,
    degradationLevel: degradationLevel.value,
    hasWebGL: hasWebGL.value,
    hasFallback: hasFallbackCanvas.value,
    canvasAge: Date.now() - parseInt(canvasKey.value.split("-")[1]),
    healthScore: Math.max(0, 100 - performanceMetrics.value.errorCount * 10),
  }));

  // Graceful degradation based on error pattern
  const applyGracefulDegradation = () => {
    if (performanceMetrics.value.errorCount > 3) {
      degradationLevel.value = "reduced";
    }
    if (performanceMetrics.value.errorCount > 5) {
      degradationLevel.value = "minimal";
      hasFallbackCanvas.value = true;
    }
  };

  // Auto-recovery watcher with exponential backoff
  watch(canvasError, (error) => {
    if (error) {
      applyGracefulDegradation();
    }
  });

  // Health check for long-running canvas
  const healthCheck = () => {
    const report = getPerformanceReport.value;

    if (report.healthScore < 50) {
      console.warn(
        "🏥 Canvas health check failed, initiating recovery:",
        report
      );
      resetCanvas(true);
    }
  };

  // Periodic health monitoring
  let healthCheckInterval: number | undefined;
  const startHealthMonitoring = () => {
    healthCheckInterval = window.setInterval(healthCheck, 30000); // Every 30 seconds
  };

  const stopHealthMonitoring = () => {
    if (healthCheckInterval) {
      window.clearInterval(healthCheckInterval);
      healthCheckInterval = undefined;
    }
  };

  // Manual recovery function for user-triggered retries
  const manualRecover = async () => {
    if (canvasError.value) {
      canvasError.value.retryCount = 0; // Reset retry count
      await resetCanvas(false);
    }
  };

  return {
    // State
    canvasKey: computed(() => canvasKey.value),
    isCanvasReady: computed(() => isCanvasReady.value),
    canvasError: computed(() => canvasError.value),
    isCanvasLoading: computed(() => isCanvasLoading.value),
    currentLayout: computed(() => currentLayout.value),
    canvasStatus,
    shouldShowCanvas,
    shouldShowFallback,
    degradationLevel: computed(() => degradationLevel.value),

    // Performance & Health
    getPerformanceReport,

    // Actions
    resetCanvas,
    handleCanvasReady,
    handleCanvasError,
    handleLoadingStateChanged,
    handleLayoutChanged,
    manualRecover,

    // Monitoring
    startHealthMonitoring,
    stopHealthMonitoring,
  };
};
