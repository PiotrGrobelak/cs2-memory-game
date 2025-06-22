import { ref, computed, watch, nextTick, readonly } from "vue";
import { useWindowSize, useElementSize, useThrottleFn } from "@vueuse/core";
import type { ShallowRef } from "vue";
import type {
  CanvasDimensions,
  ResponsiveCanvasState,
  ResponsiveCanvasConfig,
} from "./useResponsiveCanvas.model";

const DEFAULT_CONFIG: ResponsiveCanvasConfig = {
  minWidth: 320,
  minHeight: 200,
  padding: 32,
  resizeThrottleMs: 100,
};

export const useResponsiveCanvas = (config: ResponsiveCanvasConfig) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const topComponentsHeight = ref(0);
  const containerHeight = ref(0);
  const containerWidth = ref(0);

  const { width: windowWidth, height: windowHeight } = useWindowSize();

  const state = reactive<ResponsiveCanvasState>({
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

  const deviceType = computed(() => {
    if (windowWidth.value <= 768) return "mobile";
    if (windowWidth.value <= 1024) return "tablet";
    return "desktop";
  });

  const deviceOrientation = computed(() => {
    return windowHeight.value > windowWidth.value ? "portrait" : "landscape";
  });

  const isTouch = computed(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return false;
    }
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  });

  const calculateCanvasDimensions = (): CanvasDimensions => {
    // TODO: remove this or not in the future
    const topComponentsHeightValue = topComponentsHeight.value;

    let availableWidth = containerWidth.value - finalConfig.padding;
    let availableHeight = containerHeight.value - finalConfig.padding;

    // Apply aspect ratio if specified
    if (finalConfig.aspectRatio) {
      const ratioWidth = availableHeight * finalConfig.aspectRatio;
      const ratioHeight = availableWidth / finalConfig.aspectRatio;

      if (ratioWidth <= availableWidth) {
        availableWidth = ratioWidth;
      } else {
        availableHeight = ratioHeight;
      }
    }

    return {
      width: Math.floor(Math.max(availableWidth, finalConfig.minWidth)),
      height: Math.floor(Math.max(availableHeight, finalConfig.minHeight)),
    };
  };

  const updateCanvasDimensions = useThrottleFn(() => {
    state.containerSize = {
      width: containerWidth.value,
      height: containerHeight.value,
    };

    state.actualCanvasSize = calculateCanvasDimensions();

    state.deviceInfo = {
      type: deviceType.value,
      orientation: deviceOrientation.value,
      isTouch: isTouch.value,
    };
  }, finalConfig.resizeThrottleMs);

  const handleResize = async () => {
    state.isResizing = true;

    await nextTick();
    updateCanvasDimensions();

    setTimeout(() => {
      state.isResizing = false;
    }, 1000);
  };

  const handleOrientationChange = async () => {
    state.isLoading = true;

    await new Promise((resolve) => setTimeout(resolve, 200));

    await handleResize();

    setTimeout(() => {
      state.isLoading = false;
    }, 1000);
  };

  watch(
    [
      windowWidth,
      windowHeight,
      containerWidth,
      containerHeight,
      topComponentsHeight,
    ],
    handleResize
  );

  watch(deviceOrientation, handleOrientationChange);

  watch(topComponentsHeight, () => {
    state.actualCanvasSize = calculateCanvasDimensions();
  });

  const canvasWidth = computed(() => state.actualCanvasSize.width);
  const canvasHeight = computed(() => state.actualCanvasSize.height);
  const isResizing = computed(() => state.isResizing);
  const isLoading = computed(() => state.isLoading);
  const deviceInfo = computed(() => state.deviceInfo);

  return {
    // State
    state: readonly(state),

    // Dimensions
    canvasWidth,
    canvasHeight,
    canvasDimensions: computed(() => state.actualCanvasSize),

    // Reactive configuration
    topComponentsHeight,
    containerHeight,
    containerWidth,

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
