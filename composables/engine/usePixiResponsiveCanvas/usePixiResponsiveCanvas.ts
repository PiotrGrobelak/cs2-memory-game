import { type ShallowRef, watch, readonly, reactive } from "vue";
import { Application, Graphics, Container } from "pixi.js";
import { useThrottleFn } from "@vueuse/core";
import { UAParser } from "ua-parser-js";
import type { GameCard } from "~/types/game";
import {
  useAdaptiveGridLayout,
  type GridLayout,
  type DeviceType,
  type DeviceOrientation,
} from "../useAdaptiveGridLayout";
import type {
  PixiResponsiveConfig,
  ResponsivePixiState,
} from "./usePixiResponsiveCanvas.model";
import { DEFAULT_CONFIG } from "./usePixiResponsiveCanvas.constants";

export const usePixiResponsiveCanvas = (
  canvasContainer: ShallowRef<HTMLElement | undefined>,
  config: Partial<PixiResponsiveConfig> = {}
) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const containerHeight = ref(0);
  const containerWidth = ref(0);

  // Use container dimensions instead of window dimensions
  const containerDimensions = computed(() => ({
    width: containerWidth.value,
    height: containerHeight.value,
  }));

  // Initialize UAParser for device detection
  const parser = new UAParser();
  const uaResult = parser.getResult();

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

  const deviceType = computed((): DeviceType => {
    if (typeof window === "undefined") return "desktop";

    const deviceType = uaResult.device.type;
    const os = uaResult.os.name?.toLowerCase();
    const width = containerDimensions.value.width;

    if (deviceType === "mobile") return "mobile";
    if (deviceType === "tablet") return "tablet";

    if (os?.includes("android") || os?.includes("ios")) {
      return width <= 768 ? "mobile" : width <= 1024 ? "tablet" : "desktop";
    }

    if (width <= 480) return "mobile";
    if (width <= 768) return "tablet";
    return "desktop";
  });

  const deviceOrientation = computed((): DeviceOrientation => {
    const { width, height } = containerDimensions.value;
    return height > width ? "portrait" : "landscape";
  });

  const isTouch = computed(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return false;
    }

    return Boolean(
      "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        ["mobile", "tablet"].includes(uaResult.device.type || "")
    );
  });

  const {
    generateLayout,
    updateDeviceContext,
    updateCanvasDimensions,
    getCurrentStrategy,
  } = useAdaptiveGridLayout(
    { width: 0, height: 0 },
    deviceType.value,
    deviceOrientation.value
  );

  const getElementDimensions = () => {
    if (!canvasContainer.value) return { width: 0, height: 0 };

    const rect = canvasContainer.value.getBoundingClientRect();
    return {
      width: Math.max(rect.width || 0, finalConfig.minWidth),
      height: Math.max(rect.height || 0, finalConfig.minHeight),
    };
  };

  const initializeContainerDimensions = () => {
    const dimensions = getElementDimensions();
    containerWidth.value = dimensions.width;
    containerHeight.value = dimensions.height;

    if (dimensions.width > 0 && dimensions.height > 0) {
      updateCanvasDimensions(dimensions.width, dimensions.height);
      updateDeviceContext(deviceType.value, deviceOrientation.value);
    }
  };

  class ResponsivePixiGrid {
    private gridContainer: Container;
    private cardsContainer: Container;

    constructor(private app: Application) {
      this.gridContainer = new Container();
      this.cardsContainer = new Container();

      // Add containers to stage in correct order
      this.app.stage.addChild(this.gridContainer);
      this.app.stage.addChild(this.cardsContainer);
    }

    updateLayout(cards: GameCard[], forceRedraw = false): GridLayout {
      const layout = generateLayout(cards);

      if (
        forceRedraw ||
        !state.currentLayout ||
        this.hasLayoutChanged(layout)
      ) {
        this.redrawGrid(layout);
        state.currentLayout = layout;

        if (process.env.NODE_ENV === "development") {
          console.log("🎯 Pixi Responsive Grid Updated:", {
            strategy: getCurrentStrategy.value?.name,
            gridSize: `${layout.cols}×${layout.rows}`,
            cardSize: `${layout.cardDimensions.width}×${layout.cardDimensions.height}px`,
            efficiency: Math.round(layout.efficiency * 100) + "%",
            deviceType: deviceType.value,
            orientation: deviceOrientation.value,
            containerSize: `${containerDimensions.value.width}×${containerDimensions.value.height}px`,
          });
        }
      }

      return layout;
    }

    private hasLayoutChanged(newLayout: GridLayout): boolean {
      if (!state.currentLayout) return true;

      const current = state.currentLayout;
      return (
        current.cols !== newLayout.cols ||
        current.rows !== newLayout.rows ||
        Math.abs(
          current.cardDimensions.width - newLayout.cardDimensions.width
        ) > 1 ||
        Math.abs(
          current.cardDimensions.height - newLayout.cardDimensions.height
        ) > 1
      );
    }

    private redrawGrid(layout: GridLayout) {
      // Clear existing grid
      this.gridContainer.removeChildren();

      // Create new grid graphics
      const graphics = new Graphics();

      const { cols, rows, cardDimensions } = layout;
      const { width: cardWidth, height: cardHeight } = cardDimensions;

      // Draw grid lines (optional, for debugging)
      if (process.env.NODE_ENV === "development") {
        layout.positions.forEach((pos) => {
          graphics
            .rect(
              pos.x - cardWidth / 2,
              pos.y - cardHeight / 2,
              cardWidth,
              cardHeight
            )
            .stroke({
              color: 0x333333,
              width: 1,
              alpha: 0.3,
            });
        });
      }

      this.gridContainer.addChild(graphics);
    }

    getCardsContainer(): Container {
      return this.cardsContainer;
    }

    destroy() {
      this.gridContainer.destroy();
      this.cardsContainer.destroy();
    }
  }

  let responsiveGrid: ResponsivePixiGrid | null = null;

  // Initialize Pixi Application with responsive features
  const initializePixiApp = async (): Promise<Application> => {
    if (!canvasContainer.value) {
      throw new Error("Canvas container not available");
    }

    state.isLoading = true;

    try {
      // Initialize container dimensions first
      initializeContainerDimensions();

      const { width, height } = containerDimensions.value;

      // Ensure we have valid dimensions
      if (width === 0 || height === 0) {
        throw new Error(
          "Container dimensions not available. Please ensure the container has proper width and height."
        );
      }

      const app = new Application();

      await app.init({
        width,
        height,
        backgroundAlpha: finalConfig.backgroundAlpha,
        antialias: true,
        resolution: 1,
        resizeTo: canvasContainer.value,
      });

      // Add canvas to container
      canvasContainer.value.appendChild(app.canvas);

      // Initialize responsive grid
      responsiveGrid = new ResponsivePixiGrid(app);

      state.pixiApp = app;

      // Update device info
      updateDeviceInfo();

      // Setup container dimension watching
      setupContainerResize(app);

      return app;
    } catch (error) {
      console.error("Failed to initialize Pixi app:", error);
      throw error;
    } finally {
      state.isLoading = false;
    }
  };

  // Setup container-based resize handler
  const setupContainerResize = (app: Application) => {
    const handleResize = useThrottleFn(() => {
      if (!app) return;

      state.isResizing = true;

      const { width, height } = containerDimensions.value;
      const newWidth = Math.max(width, finalConfig.minWidth);
      const newHeight = Math.max(height, finalConfig.minHeight);

      // Update Pixi renderer only if dimensions actually changed
      if (
        app.renderer.width !== newWidth ||
        app.renderer.height !== newHeight
      ) {
        app.renderer.resize(newWidth, newHeight);
      }

      // Update grid layout system
      updateCanvasDimensions(newWidth, newHeight);

      // Update device context if changed
      updateDeviceContext(deviceType.value, deviceOrientation.value);

      setTimeout(() => {
        state.isResizing = false;
      }, finalConfig.resizeThrottleMs);
    }, finalConfig.resizeThrottleMs);

    // Watch container dimensions instead of window size
    const stopWatcher = watch(
      containerDimensions,
      () => {
        handleResize();
      },
      { deep: true }
    );

    // Return cleanup function
    return () => {
      stopWatcher();
    };
  };

  // Handle orientation changes with special care for mobile devices
  const handleOrientationChange = useThrottleFn(async () => {
    if (deviceType.value === "mobile" || deviceType.value === "tablet") {
      state.isOrientationChanging = true;

      // Wait for orientation change to complete
      await new Promise((resolve) => setTimeout(resolve, 300));

      updateDeviceInfo();

      setTimeout(() => {
        state.isOrientationChanging = false;
      }, 500);
    }
  }, 300);

  // Update device information
  const updateDeviceInfo = () => {
    state.deviceInfo = {
      type: deviceType.value,
      orientation: deviceOrientation.value,
      isTouch: isTouch.value,
      userAgent: navigator.userAgent,
    };

    updateDeviceContext(deviceType.value, deviceOrientation.value);

    // Always update canvas dimensions when device info changes
    const { width, height } = containerDimensions.value;
    if (width > 0 && height > 0) {
      updateCanvasDimensions(width, height);
    }
  };

  // Watch for device changes
  watch([deviceType, deviceOrientation], handleOrientationChange);

  // Public API
  const renderCards = (
    cards: GameCard[],
    forceRedraw = false
  ): GridLayout | null => {
    if (!responsiveGrid || !state.pixiApp) {
      console.warn("Pixi app or responsive grid not initialized");
      return null;
    }

    // Ensure container dimensions are properly initialized
    const { width, height } = containerDimensions.value;
    if (width === 0 || height === 0) {
      initializeContainerDimensions();

      // Check again after initialization
      const updatedDimensions = containerDimensions.value;
      if (updatedDimensions.width === 0 || updatedDimensions.height === 0) {
        console.warn(
          "Container dimensions are still not available. Cannot render cards."
        );
        return null;
      }
    }

    return responsiveGrid.updateLayout(cards, forceRedraw);
  };

  const getCardsContainer = (): Container | null => {
    return responsiveGrid?.getCardsContainer() || null;
  };

  const destroy = () => {
    if (responsiveGrid) {
      responsiveGrid.destroy();
      responsiveGrid = null;
    }

    if (state.pixiApp) {
      state.pixiApp.destroy(true);
      state.pixiApp = null;
    }
  };

  // Computed properties
  const isReady = computed(() => !!state.pixiApp && !state.isLoading);

  return {
    // State
    state: readonly(state),
    containerHeight,
    containerWidth,

    // Methods
    initializePixiApp,
    renderCards,
    getCardsContainer,
    destroy,
    initializeContainerDimensions,

    // Computed
    isReady,
    deviceType: computed(() => state.deviceInfo.type),
    deviceOrientation: computed(() => state.deviceInfo.orientation),
    isResizing: computed(() => state.isResizing),
    isLoading: computed(() => state.isLoading),
    isOrientationChanging: computed(() => state.isOrientationChanging),
    currentLayout: computed(() => state.currentLayout),

    // Strategy info
    getCurrentStrategy,
  };
};
