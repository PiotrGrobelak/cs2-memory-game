import { ref, computed, watch, nextTick } from "vue";
import { useWindowSize, useElementSize, useThrottleFn } from "@vueuse/core";
import type { ShallowRef } from "vue";

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
  topComponentsHeight?: number | (() => number);
}

const DEFAULT_CONFIG: ResponsiveCanvasConfig = {
  minWidth: 320,
  minHeight: 200,
  padding: 32,
  resizeThrottleMs: 100,
};

export const useResponsiveCanvas = (
  containerRef: Readonly<ShallowRef<HTMLDivElement | null>>,
  config: Partial<ResponsiveCanvasConfig> = {}
) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // VueUse composables for responsive behavior
  const { width: windowWidth, height: windowHeight } = useWindowSize();
  const { width: containerWidth, height: containerHeight } =
    useElementSize(containerRef);

  // State management
  const state = ref<ResponsiveCanvasState>({
    isResizing: false,
    isLoading: false,
    containerSize: { width: 0, height: 0 },
    actualCanvasSize: { width: 0, height: 0 },
    deviceInfo: {
      type: "desktop",
      orientation: "landscape",
      isTouch: false,
    },
  });

  // Device type detection based on window size
  const deviceType = computed(() => {
    if (windowWidth.value <= 768) return "mobile";
    if (windowWidth.value <= 1024) return "tablet";
    return "desktop";
  });

  // Device orientation detection
  const deviceOrientation = computed(() => {
    return windowHeight.value > windowWidth.value ? "portrait" : "landscape";
  });

  // Touch device detection - SSR safe
  const isTouch = computed(() => {
    // Check if running in browser environment
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return false;
    }
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  });

  const calculateCanvasDimensions = (): CanvasDimensions => {
    // Calculate height of components above canvas
    const topComponentsHeight =
      typeof finalConfig.topComponentsHeight === "function"
        ? finalConfig.topComponentsHeight()
        : finalConfig.topComponentsHeight || 0;

    console.log(
      "🔧 calculateCanvasDimensions",
      "container:",
      containerWidth.value,
      containerHeight.value,
      "window:",
      windowWidth.value,
      windowHeight.value,
      "topComponentsHeight:",
      topComponentsHeight,
      "element:",
      containerRef.value
    );

    let availableWidth = containerWidth.value - finalConfig.padding;
    let availableHeight =
      containerHeight.value - finalConfig.padding - topComponentsHeight;

    // If container is not mounted or has no size, use window size with reasonable limits
    if (containerWidth.value === 0 || containerHeight.value === 0) {
      availableWidth =
        Math.min(windowWidth.value * 0.85, 1200) - finalConfig.padding;
      availableHeight =
        Math.min(windowHeight.value * 0.7, 800) -
        finalConfig.padding -
        topComponentsHeight;
      console.log(
        "🔧 Using window size fallback:",
        availableWidth,
        availableHeight,
        "topComponentsHeight:",
        topComponentsHeight
      );
    }

    // Ensure we don't go below minimums
    availableWidth = Math.max(availableWidth, finalConfig.minWidth);
    availableHeight = Math.max(availableHeight, finalConfig.minHeight);

    let width = availableWidth;
    let height = availableHeight;

    // Apply aspect ratio if specified
    if (finalConfig.aspectRatio) {
      const ratioWidth = height * finalConfig.aspectRatio;
      const ratioHeight = width / finalConfig.aspectRatio;

      if (ratioWidth <= availableWidth) {
        width = ratioWidth;
      } else {
        height = ratioHeight;
      }
    }

    return {
      width: Math.floor(Math.max(width, finalConfig.minWidth)),
      height: Math.floor(Math.max(height, finalConfig.minHeight)),
    };
  };

  // Update canvas dimensions with throttling
  const updateCanvasDimensions = useThrottleFn(() => {
    state.value.containerSize = {
      width: containerWidth.value,
      height: containerHeight.value,
    };

    state.value.actualCanvasSize = calculateCanvasDimensions();

    state.value.deviceInfo = {
      type: deviceType.value,
      orientation: deviceOrientation.value,
      isTouch: isTouch.value,
    };

    // Debug logging for canvas dimensions
    if (process.env.NODE_ENV === "development") {
      const topComponentsHeight =
        typeof finalConfig.topComponentsHeight === "function"
          ? finalConfig.topComponentsHeight()
          : finalConfig.topComponentsHeight || 0;

      console.log("📐 Canvas Dimensions Updated:", {
        containerSize: state.value.containerSize,
        canvasSize: state.value.actualCanvasSize,
        config: finalConfig,
        deviceInfo: state.value.deviceInfo,
        topComponentsHeight,
        rawCalculation: {
          availableWidth: containerWidth.value - finalConfig.padding,
          availableHeight:
            containerHeight.value - finalConfig.padding - topComponentsHeight,
          originalContainerHeight: containerHeight.value,
          usedMinWidth:
            containerWidth.value === 0 ||
            containerWidth.value - finalConfig.padding < finalConfig.minWidth,
          usedMinHeight:
            containerHeight.value === 0 ||
            containerHeight.value - finalConfig.padding - topComponentsHeight <
              finalConfig.minHeight,
        },
      });
    }
  }, finalConfig.resizeThrottleMs);

  // Handle resize events
  const handleResize = async () => {
    state.value.isResizing = true;

    await nextTick();
    updateCanvasDimensions();

    // Extended delay to ensure smooth transition and stable layout (1 second after resize)
    setTimeout(() => {
      state.value.isResizing = false;
    }, 1000);
  };

  // Handle orientation change
  const handleOrientationChange = async () => {
    state.value.isLoading = true;

    // Wait for orientation change to complete
    await new Promise((resolve) => setTimeout(resolve, 200));

    await handleResize();

    // Additional delay for orientation change stabilization
    setTimeout(() => {
      state.value.isLoading = false;
    }, 1000); // 1.2 seconds total for orientation changes
  };

  // Watch for changes
  watch(
    [windowWidth, windowHeight, containerWidth, containerHeight],
    handleResize,
    { immediate: true }
  );
  watch(deviceOrientation, handleOrientationChange);

  // Computed properties for easy access
  const canvasWidth = computed(() => state.value.actualCanvasSize.width);
  const canvasHeight = computed(() => state.value.actualCanvasSize.height);
  const isResizing = computed(() => state.value.isResizing);
  const isLoading = computed(() => state.value.isLoading);
  const deviceInfo = computed(() => state.value.deviceInfo);

  return {
    // State
    state: readonly(state),

    // Dimensions
    canvasWidth,
    canvasHeight,
    canvasDimensions: computed(() => state.value.actualCanvasSize),

    // Status
    isResizing,
    isLoading,
    deviceInfo,

    // Methods
    updateCanvasDimensions,
    handleResize,
    handleOrientationChange,
  };
};
