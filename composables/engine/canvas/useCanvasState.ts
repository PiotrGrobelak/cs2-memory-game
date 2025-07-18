import { ref, reactive, computed, watch } from "vue";
import type { Application } from "pixi.js";
import { useThrottleFn } from "@vueuse/core";
import type { DeviceType, DeviceOrientation } from "../device";
import type { GridLayout } from "../layout/useOrientationGrid";
import type {
  PixiResponsiveConfig,
  ResponsivePixiState,
} from "../useEngineCore.model";

/**
 * Canvas State Management Composable
 *
 * Manages all reactive state for PixiJS canvas including:
 * - Container dimensions
 * - Device information
 * - Loading and resizing states
 * - Application instance
 * - Layout state
 *
 */
export const useCanvasState = (config: PixiResponsiveConfig) => {
  const containerWidth = ref(config.containerWidth);
  const containerHeight = ref(config.containerHeight);

  const state = reactive<ResponsivePixiState>({
    isResizing: false,
    isLoading: false,
    isOrientationChanging: false,
    pixiApp: null,
    currentLayout: null,
    deviceInfo: {
      type: "desktop",
      orientation: "landscape",
      isTouch: false,
    },
  });

  const cleanupFunctions: Array<() => void> = [];

  const containerDimensions = computed(() => ({
    width: containerWidth.value,
    height: containerHeight.value,
  }));

  const deviceType = computed((): DeviceType => {
    return config.deviceType;
  });

  const deviceOrientation = computed((): DeviceOrientation => {
    const { width, height } = containerDimensions.value;
    return height > width ? "portrait" : "landscape";
  });

  const isTouch = computed(() => {
    return config.isTouchDevice;
  });

  const isReady = computed(() => !!state.pixiApp && !state.isLoading);

  const isResizing = computed(() => state.isResizing);
  const isLoading = computed(() => state.isLoading);
  const isOrientationChanging = computed(() => state.isOrientationChanging);
  const currentLayout = computed(() => state.currentLayout);

  const updateDimensions = (width: number, height: number): void => {
    containerWidth.value = Math.max(width, config.minWidth);
    containerHeight.value = Math.max(height, config.minHeight);
  };

  const updateDeviceInfo = (): void => {
    state.deviceInfo = {
      type: deviceType.value,
      orientation: deviceOrientation.value,
      isTouch: isTouch.value,
      userAgent: config.deviceCapabilities.userAgent,
    };
  };

  const setPixiApp = (app: Application | null): void => {
    state.pixiApp = app;
  };

  const updateLayout = (layout: GridLayout | null): void => {
    state.currentLayout = layout;
  };

  const setLoading = (loading: boolean): void => {
    state.isLoading = loading;
  };

  const setResizing = (resizing: boolean): void => {
    state.isResizing = resizing;

    if (resizing) {
      // Auto-clear resizing state after throttle time
      setTimeout(() => {
        state.isResizing = false;
      }, config.resizeThrottleMs);
    }
  };

  const setOrientationChanging = (changing: boolean): void => {
    state.isOrientationChanging = changing;

    if (changing) {
      // Auto-clear orientation changing state after delay
      setTimeout(() => {
        state.isOrientationChanging = false;
      }, 500);
    }
  };

  const getElementDimensions = (
    container: HTMLElement | undefined,
  ): {
    width: number;
    height: number;
  } => {
    if (!container) return { width: 0, height: 0 };

    const rect = container.getBoundingClientRect();
    return {
      width: Math.max(rect.width || 0, config.minWidth),
      height: Math.max(rect.height || 0, config.minHeight),
    };
  };

  const initializeFromElement = (container: HTMLElement | undefined): void => {
    const dimensions = getElementDimensions(container);
    updateDimensions(dimensions.width, dimensions.height);
    updateDeviceInfo();
  };

  const createResizeHandler = (
    onResize: (width: number, height: number) => void,
  ): (() => void) => {
    return useThrottleFn(() => {
      setResizing(true);

      const { width, height } = containerDimensions.value;
      const newWidth = Math.max(width, config.minWidth);
      const newHeight = Math.max(height, config.minHeight);

      onResize(newWidth, newHeight);
      updateDeviceInfo();
    }, config.resizeThrottleMs);
  };

  const watchContainerDimensions = (
    onDimensionChange: () => void,
  ): (() => void) => {
    const stopWatcher = watch(containerDimensions, onDimensionChange, {
      deep: true,
    });

    cleanupFunctions.push(stopWatcher);
    return stopWatcher;
  };

  const setupDeviceWatchers = (): void => {
    const handleOrientationChange = useThrottleFn(async () => {
      if (deviceType.value === "mobile" || deviceType.value === "tablet") {
        setOrientationChanging(true);

        // Wait for orientation change to complete
        await new Promise((resolve) => setTimeout(resolve, 300));
        updateDeviceInfo();
      }
    }, 300);

    // Watch for device changes
    const stopDeviceWatcher = watch(
      [deviceType, deviceOrientation],
      handleOrientationChange,
    );

    cleanupFunctions.push(stopDeviceWatcher);
  };

  const destroy = (): void => {
    cleanupFunctions.forEach((cleanup) => cleanup());
    cleanupFunctions.length = 0;

    state.pixiApp = null;
    state.currentLayout = null;
    state.isLoading = false;
    state.isResizing = false;
    state.isOrientationChanging = false;

    containerWidth.value = 0;
    containerHeight.value = 0;
  };

  setupDeviceWatchers();

  return {
    // State
    containerWidth,
    containerHeight,
    state,

    // Computed properties
    containerDimensions,
    deviceType,
    deviceOrientation,
    isTouch,
    isReady,
    isResizing,
    isLoading,
    isOrientationChanging,
    currentLayout,

    // Methods
    updateDimensions,
    updateDeviceInfo,
    setPixiApp,
    updateLayout,
    setLoading,
    setResizing,
    setOrientationChanging,
    getElementDimensions,
    initializeFromElement,
    createResizeHandler,
    watchContainerDimensions,
    destroy,
  };
};
