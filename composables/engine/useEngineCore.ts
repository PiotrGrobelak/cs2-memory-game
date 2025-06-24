import { computed, ref } from "vue";
import { useDeviceDetection } from "./device";
import { useCanvasState } from "./canvas/useCanvasState";
import { useResponsiveGrid } from "./canvas/useResponsiveGrid";
import { createLayout, getLayoutStrategy } from "./layout/useLayoutStrategies";
import type { GridLayout } from "./layout/adaptiveGridLayout";
import type { PixiResponsiveConfig } from "./useEngineCore.model";
import type { GameCard } from "~/types/game";
import type { Application } from "pixi.js";

/**
 * Core Engine Composable
 *
 * Provides a unified API for all engine functionalities:
 * - Device detection and responsiveness
 * - Canvas state management
 * - Grid layout computation
 * - Pixi grid rendering
 *
 */
export const useEngineCore = (config: PixiResponsiveConfig) => {
  // Device detection - called once during component setup
  const {
    deviceType,
    deviceOrientation,
    windowSize,
    deviceCapabilities,
    isMobile,
    isTouchDevice,
  } = useDeviceDetection();

  // Canvas state management
  const canvasState = useCanvasState(config);

  // Reactive reference to pixi app and grid
  const pixiApp = ref<Application | null>(null);
  let pixiGrid: ReturnType<typeof useResponsiveGrid> | null = null;

  /**
   * Initialize Pixi application and grid rendering
   */
  const initializePixiApp = (app: Application) => {
    pixiApp.value = app;
    pixiGrid = useResponsiveGrid(app);
  };

  // Device Settings Configuration
  const DEVICE_SETTINGS = {
    mobile: {
      gap: 6,
      minCardSize: 40,
      maxCardSize: 120,
      aspectRatio: 0.8,
      paddingFactor: 0.05,
    },
    tablet: {
      gap: 10,
      minCardSize: 70,
      maxCardSize: 140,
      aspectRatio: 0.75,
      paddingFactor: 0.03,
    },
    desktop: {
      gap: 16,
      minCardSize: 40,
      maxCardSize: 180,
      aspectRatio: 0.7,
      paddingFactor: 0.02,
    },
  };

  /**
   * Generate optimal grid layout for given cards
   */
  const generateLayout = (cards: GameCard[]): GridLayout | null => {
    const { width, height } = canvasState.containerDimensions.value;

    if (width === 0 || height === 0) {
      console.warn(
        "Container dimensions not available. Cannot generate layout."
      );
      return null;
    }

    const deviceSettings = DEVICE_SETTINGS[deviceType.value];
    const strategy = getLayoutStrategy(
      deviceType.value,
      deviceOrientation.value
    );

    const context = {
      canvasWidth: width,
      canvasHeight: height,
      cardCount: cards.length,
      deviceType: deviceType.value,
      orientation: deviceOrientation.value,
      ...deviceSettings,
    };

    const gridParams = strategy(context);

    if (!gridParams) {
      console.error("Failed to calculate grid parameters");
      return null;
    }

    return createLayout(gridParams);
  };

  const renderCards = (
    cards: GameCard[],
    forceRedraw = false
  ): GridLayout | null => {
    if (!pixiGrid) {
      console.warn(
        "Pixi grid not initialized. Use generateLayout for layout calculation only."
      );
      return generateLayout(cards);
    }

    const layout = generateLayout(cards);
    if (!layout) return null;

    return pixiGrid.updateLayout(cards, layout, forceRedraw);
  };

  const updateCanvasDimensions = (width: number, height: number) => {
    canvasState.updateDimensions(width, height);
  };

  const initializeFromElement = (element: HTMLElement | undefined) => {
    canvasState.initializeFromElement(element);
  };

  const getDeviceInfo = computed(() => ({
    type: deviceType.value,
    orientation: deviceOrientation.value,
    isTouch: isTouchDevice.value,
    isMobile: isMobile.value,
    capabilities: deviceCapabilities.value,
  }));

  const getCanvasInfo = computed(() => ({
    dimensions: canvasState.containerDimensions.value,
    isReady: canvasState.isReady.value,
    isLoading: canvasState.isLoading.value,
    isResizing: canvasState.isResizing.value,
    currentLayout: canvasState.currentLayout.value,
  }));

  const validateLayout = (layout: GridLayout) => {
    const warnings: string[] = [];
    const deviceSettings = DEVICE_SETTINGS[deviceType.value];

    // Check card size constraints
    if (layout.cardDimensions.width < deviceSettings.minCardSize) {
      warnings.push(
        `Cards are smaller than recommended minimum (${deviceSettings.minCardSize}px)`
      );
    }

    if (layout.cardDimensions.width > deviceSettings.maxCardSize) {
      warnings.push(
        `Cards exceed recommended maximum (${deviceSettings.maxCardSize}px)`
      );
    }

    // Check grid efficiency
    if (layout.efficiency < 0.75) {
      warnings.push(
        `Grid efficiency is low (${Math.round(layout.efficiency * 100)}%) - consider adjusting card count`
      );
    }

    return {
      warnings,
      recommendations: {
        optimalCardCount: Math.ceil(layout.cols * layout.rows * 0.8),
        gridEfficiency: layout.efficiency,
        deviceOptimized: true,
      },
    };
  };

  const destroy = () => {
    canvasState.destroy();
    pixiGrid?.destroy();
    pixiGrid = null;
    pixiApp.value = null;
  };

  return {
    // Device state
    deviceType,
    deviceOrientation,
    isMobile,
    isTouchDevice,
    deviceCapabilities,

    // Canvas state
    containerDimensions: canvasState.containerDimensions,
    isReady: canvasState.isReady,
    isLoading: canvasState.isLoading,
    isResizing: canvasState.isResizing,
    currentLayout: canvasState.currentLayout,

    // Methods
    generateLayout,
    renderCards,
    updateCanvasDimensions,
    initializeFromElement,
    initializePixiApp,
    validateLayout,
    destroy,

    // Computed info getters
    getDeviceInfo,
    getCanvasInfo,

    // Direct access to sub-composables for advanced usage
    canvasState,
    get pixiGrid() {
      return pixiGrid;
    },

    // Pixi-specific methods (if grid available)
    getCardsContainer: () => pixiGrid?.getCardsContainer() || null,
  };
};
