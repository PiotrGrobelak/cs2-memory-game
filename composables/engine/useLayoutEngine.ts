/**
 * useLayoutEngine - Advanced responsive layout engine for memory game canvas
 *
 * This composable provides intelligent layout calculations:
 * - Adaptive canvas size calculation based on available space
 * - Optimal card sizes for each breakpoint and difficulty level
 * - Intelligent spacing and padding management
 * - Responsive positioning and coordinate conversion
 * - Layout validation and fallback handling
 * - Performance-optimized resize handling
 *
 * Key features:
 * - Multi-breakpoint responsive design (mobile, tablet, desktop)
 * - Dynamic size calculation based on container space and grid requirements
 * - Optimized canvas dimensions to eliminate empty space
 * - Smart spacing algorithms for different screen densities
 * - Aspect ratio preservation across devices
 * - Memory efficient layout caching
 */
import { ref, reactive, computed, readonly } from "vue";
import type { DifficultyLevel } from "~/types/game";

// Device type enumeration
type DeviceType = "mobile" | "tablet" | "desktop";

// Size interface
interface Size {
  width: number;
  height: number;
}

// Position interface
interface Position {
  x: number;
  y: number;
}

// Spacing interface
interface Spacing {
  horizontal: number;
  vertical: number;
}

// Padding interface
interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Responsive breakpoint configuration (optimized according to implementation plan)
interface ResponsiveBreakpoint {
  range: [number, number];
  canvas: { maxWidth: number; maxHeight: number };
  cards: { minSize: number; maxSize: number; aspectRatio: number };
  spacing: { min: number; max: number };
  padding: number;
}

// Complete layout configuration
interface CanvasLayout {
  canvasSize: Size;
  cardSize: Size;
  gridSize: { rows: number; cols: number };
  spacing: Spacing;
  padding: Padding;
  positions: Position[];
  deviceType: DeviceType;
}

// Layout engine state
interface LayoutEngineState {
  isInitialized: boolean;
  containerSize: Size;
  currentDifficulty: DifficultyLevel | null;
  lastCalculationTime: number;
}

// Optimized responsive breakpoints according to implementation plan
const RESPONSIVE_BREAKPOINTS: Record<DeviceType, ResponsiveBreakpoint> = {
  mobile: {
    range: [320, 767],
    canvas: { maxWidth: 360, maxHeight: 640 },
    cards: { minSize: 60, maxSize: 80, aspectRatio: 0.75 },
    spacing: { min: 8, max: 16 },
    padding: 12,
  },
  tablet: {
    range: [768, 1023],
    canvas: { maxWidth: 720, maxHeight: 900 },
    cards: { minSize: 80, maxSize: 120, aspectRatio: 0.7 },
    spacing: { min: 12, max: 20 },
    padding: 16,
  },
  desktop: {
    range: [1024, Infinity],
    canvas: { maxWidth: 1200, maxHeight: 800 },
    cards: { minSize: 100, maxSize: 150, aspectRatio: 0.65 },
    spacing: { min: 16, max: 24 },
    padding: 20,
  },
};

// Specific sizes for difficulty levels according to implementation plan
const DIFFICULTY_SPECIFIC_SIZES = {
  mobile: {
    easy: {
      canvasMax: { width: 350, height: 280 },
      cardSize: { width: 70, height: 53 },
    },
    medium: {
      canvasMax: { width: 360, height: 320 },
      cardSize: { width: 50, height: 38 },
    },
    hard: {
      canvasMax: { width: 360, height: 400 },
      cardSize: { width: 40, height: 30 },
    },
  },
  tablet: {
    easy: {
      canvasMax: { width: 480, height: 360 },
      cardSize: { width: 100, height: 75 },
    },
    medium: {
      canvasMax: { width: 600, height: 400 },
      cardSize: { width: 85, height: 64 },
    },
    hard: {
      canvasMax: { width: 720, height: 480 },
      cardSize: { width: 70, height: 53 },
    },
  },
  desktop: {
    easy: {
      canvasMax: { width: 600, height: 450 },
      cardSize: { width: 120, height: 90 },
    },
    medium: {
      canvasMax: { width: 800, height: 500 },
      cardSize: { width: 110, height: 83 },
    },
    hard: {
      canvasMax: { width: 1000, height: 600 },
      cardSize: { width: 100, height: 75 },
    },
  },
} as const;

export const useLayoutEngine = () => {
  // Container reference for ResizeObserver
  const containerRef = ref<HTMLElement>();

  // Engine state
  const state = reactive<LayoutEngineState>({
    isInitialized: false,
    containerSize: { width: 0, height: 0 },
    currentDifficulty: null,
    lastCalculationTime: 0,
  });

  // Current layout (reactive)
  const currentLayout = ref<CanvasLayout>({
    canvasSize: { width: 400, height: 300 },
    cardSize: { width: 80, height: 60 },
    gridSize: { rows: 3, cols: 4 },
    spacing: { horizontal: 16, vertical: 16 },
    padding: { top: 16, right: 16, bottom: 16, left: 16 },
    positions: [],
    deviceType: "desktop",
  });

  // ResizeObserver for container size tracking
  let resizeObserver: ResizeObserver | null = null;

  // Debounce timeout for resize events
  let resizeTimeout: number | null = null;

  // Computed current device type
  const currentDevice = computed<DeviceType>(() => {
    const width = state.containerSize.width;

    if (width <= 767) return "mobile";
    if (width <= 1023) return "tablet";
    return "desktop";
  });

  // Computed current breakpoint
  const currentBreakpoint = computed(
    () => RESPONSIVE_BREAKPOINTS[currentDevice.value]
  );

  /**
   * Initialize layout engine with container element
   */
  const initialize = (container: HTMLElement): void => {
    if (state.isInitialized) {
      console.warn("Layout engine already initialized");
      return;
    }

    containerRef.value = container;

    // Setup ResizeObserver for container size tracking
    setupResizeObserver(container);

    // Get initial container size
    const rect = container.getBoundingClientRect();
    updateContainerSize(rect.width, rect.height);

    state.isInitialized = true;
    console.log("Layout engine initialized", {
      containerSize: state.containerSize,
      deviceType: currentDevice.value,
    });
  };

  /**
   * Setup ResizeObserver for automatic container size tracking
   */
  const setupResizeObserver = (container: HTMLElement): void => {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        handleResize(width, height);
      }
    });

    resizeObserver.observe(container);
  };

  /**
   * Handle resize events with debouncing
   */
  const handleResize = (width: number, height: number): void => {
    // Debounce resize events
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }

    resizeTimeout = setTimeout(() => {
      const hasSignificantChange = hasSignificantSizeChange(
        { width, height },
        state.containerSize
      );

      if (hasSignificantChange) {
        updateContainerSize(width, height);

        // Recalculate layout if difficulty is set
        if (state.currentDifficulty) {
          recalculateLayout();
        }
      }
    }, 150) as unknown as number;
  };

  /**
   * Check if size change is significant enough to trigger recalculation
   */
  const hasSignificantSizeChange = (newSize: Size, oldSize: Size): boolean => {
    const threshold = 50; // pixels
    return (
      Math.abs(newSize.width - oldSize.width) > threshold ||
      Math.abs(newSize.height - oldSize.height) > threshold
    );
  };

  /**
   * Update container size
   */
  const updateContainerSize = (width: number, height: number): void => {
    state.containerSize = { width, height };
    console.log("Container size updated", {
      width,
      height,
      device: currentDevice.value,
    });
  };

  /**
   * Calculate optimal canvas size based on difficulty and device
   */
  const calculateLayout = (difficulty: DifficultyLevel): CanvasLayout => {
    const startTime = performance.now();
    state.currentDifficulty = difficulty;

    const device = currentDevice.value;
    const breakpoint = currentBreakpoint.value;
    const { width: containerWidth, height: containerHeight } =
      state.containerSize;

    console.log("Calculating layout", {
      difficulty: difficulty.name,
      device,
      containerSize: state.containerSize,
    });

    // Get device and difficulty specific constraints
    const specificSizes = DIFFICULTY_SPECIFIC_SIZES[device][difficulty.name];

    // Calculate available space (container minus UI elements)
    const availableSpace = calculateAvailableSpace(
      { width: containerWidth, height: containerHeight },
      breakpoint.padding
    );

    // Use specific card size for this device/difficulty combination
    const cardSize = specificSizes.cardSize;

    // Calculate optimal spacing based on available space and card count
    const spacing = calculateOptimalSpacing(
      availableSpace,
      cardSize,
      difficulty.gridSize,
      breakpoint.spacing
    );

    // Calculate padding
    const padding: Padding = {
      top: breakpoint.padding,
      right: breakpoint.padding,
      bottom: breakpoint.padding,
      left: breakpoint.padding,
    };

    // Calculate required canvas size
    const canvasSize = calculateRequiredCanvasSize(
      cardSize,
      difficulty.gridSize,
      spacing,
      padding
    );

    // Ensure canvas doesn't exceed device-specific maximum
    const constrainedCanvasSize = constrainToDeviceLimits(
      canvasSize,
      specificSizes.canvasMax
    );

    // Generate card positions
    const positions = generateCardPositions(
      cardSize,
      difficulty.gridSize,
      spacing,
      padding
    );

    const layout: CanvasLayout = {
      canvasSize: constrainedCanvasSize,
      cardSize,
      gridSize: difficulty.gridSize,
      spacing,
      padding,
      positions,
      deviceType: device,
    };

    // Update current layout
    currentLayout.value = layout;

    const calculationTime = performance.now() - startTime;
    state.lastCalculationTime = calculationTime;

    console.log("Layout calculated", {
      layout,
      calculationTime: `${calculationTime.toFixed(2)}ms`,
    });

    return layout;
  };

  /**
   * Recalculate layout with current difficulty
   */
  const recalculateLayout = (): CanvasLayout | null => {
    if (!state.currentDifficulty) {
      console.warn("Cannot recalculate layout: no difficulty set");
      return null;
    }

    return calculateLayout(state.currentDifficulty);
  };

  /**
   * Calculate available space for canvas (container minus UI elements)
   */
  const calculateAvailableSpace = (
    containerSize: Size,
    padding: number
  ): Size => {
    const uiElementsHeight = 120; // Header, controls, stats, etc.
    const safetyMargin = 20;

    return {
      width: containerSize.width - padding * 2 - safetyMargin,
      height:
        containerSize.height - uiElementsHeight - padding * 2 - safetyMargin,
    };
  };

  /**
   * Calculate optimal spacing between cards
   */
  const calculateOptimalSpacing = (
    availableSpace: Size,
    cardSize: Size,
    gridSize: { rows: number; cols: number },
    spacingConstraints: { min: number; max: number }
  ): Spacing => {
    // Calculate available space for spacing
    const totalCardWidth = gridSize.cols * cardSize.width;
    const totalCardHeight = gridSize.rows * cardSize.height;

    const availableSpacingWidth = availableSpace.width - totalCardWidth;
    const availableSpacingHeight = availableSpace.height - totalCardHeight;

    // Calculate spacing (number of gaps = number of cards - 1)
    const horizontalSpacing = Math.max(
      spacingConstraints.min,
      Math.min(
        spacingConstraints.max,
        availableSpacingWidth / (gridSize.cols - 1)
      )
    );

    const verticalSpacing = Math.max(
      spacingConstraints.min,
      Math.min(
        spacingConstraints.max,
        availableSpacingHeight / (gridSize.rows - 1)
      )
    );

    return {
      horizontal: Math.round(horizontalSpacing),
      vertical: Math.round(verticalSpacing),
    };
  };

  /**
   * Calculate required canvas size based on layout elements
   */
  const calculateRequiredCanvasSize = (
    cardSize: Size,
    gridSize: { rows: number; cols: number },
    spacing: Spacing,
    padding: Padding
  ): Size => {
    const totalCardsWidth = gridSize.cols * cardSize.width;
    const totalSpacingWidth = (gridSize.cols - 1) * spacing.horizontal;
    const width =
      totalCardsWidth + totalSpacingWidth + padding.left + padding.right;

    const totalCardsHeight = gridSize.rows * cardSize.height;
    const totalSpacingHeight = (gridSize.rows - 1) * spacing.vertical;
    const height =
      totalCardsHeight + totalSpacingHeight + padding.top + padding.bottom;

    return {
      width: Math.round(width),
      height: Math.round(height),
    };
  };

  /**
   * Constrain canvas size to device-specific limits
   */
  const constrainToDeviceLimits = (canvasSize: Size, maxSize: Size): Size => {
    return {
      width: Math.min(canvasSize.width, maxSize.width),
      height: Math.min(canvasSize.height, maxSize.height),
    };
  };

  /**
   * Generate positions for all cards based on grid layout
   */
  const generateCardPositions = (
    cardSize: Size,
    gridSize: { rows: number; cols: number },
    spacing: Spacing,
    padding: Padding
  ): Position[] => {
    const positions: Position[] = [];

    for (let row = 0; row < gridSize.rows; row++) {
      for (let col = 0; col < gridSize.cols; col++) {
        const x = padding.left + col * (cardSize.width + spacing.horizontal);
        const y = padding.top + row * (cardSize.height + spacing.vertical);

        positions.push({ x, y });
      }
    }

    return positions;
  };

  /**
   * Get card position by index
   */
  const getCardPosition = (cardIndex: number): Position => {
    if (cardIndex < 0 || cardIndex >= currentLayout.value.positions.length) {
      console.warn(`Invalid card index: ${cardIndex}`);
      return { x: 0, y: 0 };
    }

    return currentLayout.value.positions[cardIndex];
  };

  /**
   * Get card index at canvas position (hit detection)
   */
  const getCardIndexAtPosition = (
    canvasX: number,
    canvasY: number
  ): number | null => {
    const { cardSize, positions } = currentLayout.value;

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];

      if (
        canvasX >= pos.x &&
        canvasX <= pos.x + cardSize.width &&
        canvasY >= pos.y &&
        canvasY <= pos.y + cardSize.height
      ) {
        return i;
      }
    }

    return null;
  };

  /**
   * Validate current layout
   */
  const validateLayout = (): boolean => {
    const layout = currentLayout.value;

    // Check minimum size requirements
    if (layout.cardSize.width < 30 || layout.cardSize.height < 20) {
      console.warn("Cards too small for playability");
      return false;
    }

    // Check canvas size is reasonable
    if (layout.canvasSize.width < 200 || layout.canvasSize.height < 150) {
      console.warn("Canvas too small");
      return false;
    }

    // Check positions are generated
    if (layout.positions.length === 0) {
      console.warn("No card positions generated");
      return false;
    }

    return true;
  };

  /**
   * Get layout information for debugging
   */
  const getLayoutInfo = () => ({
    containerSize: readonly(state.containerSize),
    currentLayout: readonly(currentLayout.value),
    deviceType: currentDevice.value,
    breakpoint: currentBreakpoint.value,
    isValid: validateLayout(),
    calculationTime: state.lastCalculationTime,
  });

  /**
   * Cleanup resources
   */
  const cleanup = (): void => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
      resizeTimeout = null;
    }

    state.isInitialized = false;
    state.currentDifficulty = null;

    console.log("Layout engine cleaned up");
  };

  return {
    // State
    containerSize: readonly(state.containerSize),
    currentLayout: readonly(currentLayout),
    currentDevice,
    currentBreakpoint,

    // Methods
    initialize,
    calculateLayout,
    recalculateLayout,
    getCardPosition,
    getCardIndexAtPosition,
    validateLayout,
    getLayoutInfo,
    cleanup,

    // Utilities
    updateContainerSize,
  };
};
