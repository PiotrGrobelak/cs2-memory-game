/**
 * useCanvasLayout - Responsive layout system for the memory game canvas
 *
 * This composable manages the responsive layout and positioning of game elements:
 * - Calculates optimal card sizes based on available board space and grid layout
 * - Implements responsive breakpoints (mobile, tablet, desktop)
 * - Calculates optimal canvas size based on card layout requirements (no empty space)
 * - Handles canvas resizing and container size changes
 * - Manages spacing, padding, and aspect ratios across devices
 * - Provides coordinate conversion between canvas and screen space
 * - Ensures consistent gameplay experience across all device sizes
 *
 * Key features:
 * - Multi-breakpoint responsive design (320px to desktop)
 * - Dynamic card size calculation based on board space divided by grid dimensions
 * - Optimal canvas size calculation based on actual card layout needs
 * - Grid layout calculation for different difficulty levels
 * - Real-time layout updates on container resize
 * - Canvas coordinate system management
 * - Minimum size constraints to ensure playability
 */
import { ref, computed, reactive } from "vue";
import type { DifficultyLevel } from "~/types/game";

// Layout configuration interface
interface LayoutConfig {
  canvasSize: { width: number; height: number };
  cardSize: { width: number; height: number };
  gridLayout: { rows: number; cols: number };
  spacing: { horizontal: number; vertical: number };
  padding: { top: number; right: number; bottom: number; left: number };
}

// Breakpoint configuration
interface BreakpointConfig {
  name: string;
  minWidth: number;
  maxWidth?: number;
  cardAspectRatio: number;
  cardSize: number;
  spacing: number;
  padding: number;
}

// Responsive breakpoints based on requirements
const BREAKPOINTS: BreakpointConfig[] = [
  {
    name: "mobile",
    minWidth: 320,
    maxWidth: 767,
    cardAspectRatio: 0.75, // Slightly more square for mobile
    cardSize: 80, // Increased from 20 to 80 (4x larger)
    spacing: 24, // Increased from 6 to 24 (4x larger)
    padding: 16,
  },
  {
    name: "tablet",
    minWidth: 768,
    maxWidth: 1023,
    cardAspectRatio: 0.75,
    cardSize: 260, // Increased from 40 to 120 (3x larger)
    spacing: 24, // Increased from 8 to 24 (3x larger)
    padding: 16,
  },
  {
    name: "desktop",
    minWidth: 1024,
    cardAspectRatio: 0.65, // Slightly wider cards for desktop
    cardSize: 180, // Increased from 60 to 180 (3x larger)
    spacing: 30, // Increased from 10 to 30 (3x larger)
    padding: 16,
  },
];

export const useCanvasLayout = () => {
  // Container size (from ResizeObserver)
  const containerSize = ref({ width: 0, height: 0 });

  // Current layout configuration
  const layoutConfig = reactive<LayoutConfig>({
    canvasSize: { width: 400, height: 300 }, // Will be calculated based on actual card layout
    cardSize: { width: 80, height: 60 }, // Will be calculated based on available board space
    gridLayout: { rows: 3, cols: 4 },
    spacing: { horizontal: 16, vertical: 16 }, // Will be set based on breakpoint
    padding: { top: 16, right: 16, bottom: 16, left: 16 },
  });

  // Current breakpoint
  const currentBreakpoint = computed(() => {
    const width = containerSize.value.width;
    return (
      BREAKPOINTS.find(
        (bp) => width >= bp.minWidth && (!bp.maxWidth || width <= bp.maxWidth)
      ) || BREAKPOINTS[BREAKPOINTS.length - 1]
    ); // Default to desktop
  });

  // Computed canvas size (readonly)
  const canvasSize = computed(() => layoutConfig.canvasSize);

  // Computed card size (readonly)
  const cardSize = computed(() => layoutConfig.cardSize);

  // Computed grid layout (readonly)
  const gridLayout = computed(() => layoutConfig.gridLayout);

  /**
   * Update container size (called by ResizeObserver)
   */
  const updateContainerSize = (width: number, height: number): void => {
    containerSize.value = { width, height };
    // Canvas size will be calculated in calculateLayout based on card requirements
  };

  /**
   * Calculate optimal canvas size based on card layout
   */
  const calculateOptimalCanvasSize = (
    cardSize: { width: number; height: number },
    gridLayout: { rows: number; cols: number },
    spacing: { horizontal: number; vertical: number },
    padding: { top: number; right: number; bottom: number; left: number }
  ): { width: number; height: number } => {
    // Calculate total width needed for all cards and spacing
    const totalCardsWidth = gridLayout.cols * cardSize.width;
    const totalSpacingWidth = (gridLayout.cols - 1) * spacing.horizontal;
    const canvasWidth =
      totalCardsWidth + totalSpacingWidth + padding.left + padding.right;

    // Calculate total height needed for all cards and spacing
    const totalCardsHeight = gridLayout.rows * cardSize.height;
    const totalSpacingHeight = (gridLayout.rows - 1) * spacing.vertical;
    const canvasHeight =
      totalCardsHeight + totalSpacingHeight + padding.top + padding.bottom;

    return {
      width: Math.round(canvasWidth),
      height: Math.round(canvasHeight),
    };
  };

  /**
   * Calculate optimal layout for given difficulty
   */
  const calculateLayout = (difficulty: DifficultyLevel): void => {
    const breakpoint = currentBreakpoint.value;
    const { width: containerWidth, height: containerHeight } =
      containerSize.value;

    if (containerWidth === 0 || containerHeight === 0) {
      // Use default layout if container size not available
      setDefaultLayout(difficulty);
      return;
    }

    // STEP 1: Calculate total number of cards
    const totalCards = difficulty.gridSize.rows * difficulty.gridSize.cols;

    // Update grid layout from difficulty
    layoutConfig.gridLayout = {
      rows: difficulty.gridSize.rows,
      cols: difficulty.gridSize.cols,
    };

    // STEP 2: Set padding and spacing first
    layoutConfig.padding = {
      top: 16,
      right: 16,
      bottom: 16,
      left: 16,
    };

    layoutConfig.spacing = {
      horizontal: breakpoint.spacing,
      vertical: breakpoint.spacing,
    };

    // STEP 3: Calculate available board space (container minus padding)
    const availableBoardWidth = containerWidth - 32; // 16px padding on each side
    const availableBoardHeight = containerHeight - 32; // 16px padding on each side

    // STEP 4: Calculate optimal card size based on board space and grid layout
    const cardSize = calculateOptimalCardSizeFromGrid(
      availableBoardWidth,
      availableBoardHeight,
      difficulty.gridSize,
      breakpoint
    );

    layoutConfig.cardSize = cardSize;

    // STEP 5: Calculate optimal canvas size based on actual card layout requirements
    const optimalCanvasSize = calculateOptimalCanvasSize(
      layoutConfig.cardSize,
      layoutConfig.gridLayout,
      layoutConfig.spacing,
      layoutConfig.padding
    );

    // Ensure canvas doesn't exceed container size
    layoutConfig.canvasSize = {
      width: Math.min(optimalCanvasSize.width, containerWidth),
      height: Math.min(optimalCanvasSize.height, containerHeight),
    };

    console.log("Layout calculated (board-based card sizing):", {
      difficulty: difficulty.name,
      breakpoint: breakpoint.name,
      totalCards,
      containerSize: containerSize.value,
      availableBoardSize: {
        width: availableBoardWidth,
        height: availableBoardHeight,
      },
      calculatedCardSize: layoutConfig.cardSize,
      optimalCanvasSize,
      finalCanvasSize: layoutConfig.canvasSize,
      gridLayout: layoutConfig.gridLayout,
    });
  };

  /**
   * Calculate optimal card size from board dimensions and grid layout
   * This replaces the previous calculateCardSizeFromBoard function
   */
  const calculateOptimalCardSizeFromGrid = (
    availableBoardWidth: number,
    availableBoardHeight: number,
    gridSize: { rows: number; cols: number },
    breakpoint: BreakpointConfig
  ): { width: number; height: number } => {
    // Calculate maximum possible card width and height based on grid
    const maxCardWidth =
      (availableBoardWidth - breakpoint.spacing * (gridSize.cols - 1)) /
      gridSize.cols;
    const maxCardHeight =
      (availableBoardHeight - breakpoint.spacing * (gridSize.rows - 1)) /
      gridSize.rows;

    // Apply aspect ratio constraint - use the more constraining dimension
    const constrainedWidth = maxCardHeight / breakpoint.cardAspectRatio;
    const constrainedHeight = maxCardWidth * breakpoint.cardAspectRatio;

    let finalWidth: number;
    let finalHeight: number;

    if (constrainedWidth <= maxCardWidth) {
      // Height constrains width
      finalWidth = constrainedWidth;
      finalHeight = maxCardHeight;
    } else {
      // Width constrains height
      finalWidth = maxCardWidth;
      finalHeight = constrainedHeight;
    }

    // Apply maximum size constraint from breakpoint (optional limit)
    if (breakpoint.cardSize && finalWidth > breakpoint.cardSize) {
      finalWidth = breakpoint.cardSize;
      finalHeight = finalWidth * breakpoint.cardAspectRatio;
    }

    // Ensure minimum touch target size on mobile
    if (breakpoint.name === "mobile") {
      const minTouchSize = 44;
      if (finalWidth < minTouchSize) {
        finalWidth = minTouchSize;
        finalHeight = finalWidth * breakpoint.cardAspectRatio;
      }
    }

    return {
      width: Math.round(finalWidth),
      height: Math.round(finalHeight),
    };
  };

  /**
   * Set default layout when container size is not available
   */
  const setDefaultLayout = (difficulty: DifficultyLevel): void => {
    const defaultBreakpoint = BREAKPOINTS.find((bp) => bp.name === "desktop")!;

    // STEP 1: Calculate total number of cards
    const totalCards = difficulty.gridSize.rows * difficulty.gridSize.cols;

    layoutConfig.gridLayout = {
      rows: difficulty.gridSize.rows,
      cols: difficulty.gridSize.cols,
    };

    // STEP 2: Set padding and spacing first
    layoutConfig.padding = {
      top: 16,
      right: 16,
      bottom: 16,
      left: 16,
    };

    layoutConfig.spacing = {
      horizontal: defaultBreakpoint.spacing,
      vertical: defaultBreakpoint.spacing,
    };

    // STEP 3: Use reasonable default container size for desktop
    const defaultContainerWidth = 1200;
    const defaultContainerHeight = 800;

    // Calculate available board space
    const availableBoardWidth = defaultContainerWidth - 32; // 16px padding on each side
    const availableBoardHeight = defaultContainerHeight - 32; // 16px padding on each side

    // STEP 4: Calculate optimal card size based on board space and grid layout
    const cardSize = calculateOptimalCardSizeFromGrid(
      availableBoardWidth,
      availableBoardHeight,
      difficulty.gridSize,
      defaultBreakpoint
    );

    layoutConfig.cardSize = cardSize;

    // STEP 5: Calculate optimal canvas size based on card layout requirements
    const optimalCanvasSize = calculateOptimalCanvasSize(
      layoutConfig.cardSize,
      layoutConfig.gridLayout,
      layoutConfig.spacing,
      layoutConfig.padding
    );

    layoutConfig.canvasSize = optimalCanvasSize;

    console.log("Default layout set (board-based card sizing):", {
      difficulty: difficulty.name,
      totalCards,
      defaultContainerSize: {
        width: defaultContainerWidth,
        height: defaultContainerHeight,
      },
      availableBoardSize: {
        width: availableBoardWidth,
        height: availableBoardHeight,
      },
      calculatedCardSize: layoutConfig.cardSize,
      optimalCanvasSize,
      gridLayout: layoutConfig.gridLayout,
    });
  };

  /**
   * Get card position in canvas coordinates
   */
  const getCardPosition = (cardIndex: number): { x: number; y: number } => {
    const row = Math.floor(cardIndex / layoutConfig.gridLayout.cols);
    const col = cardIndex % layoutConfig.gridLayout.cols;

    const x =
      16 + // Fixed 16px left padding
      col * (layoutConfig.cardSize.width + layoutConfig.spacing.horizontal);

    const y =
      16 + // Fixed 16px top padding
      row * (layoutConfig.cardSize.height + layoutConfig.spacing.vertical);

    return { x, y };
  };

  /**
   * Get card at specific canvas position
   */
  const getCardIndexAtPosition = (
    canvasX: number,
    canvasY: number
  ): number | null => {
    // Adjust for fixed 16px padding
    const relativeX = canvasX - 16;
    const relativeY = canvasY - 16;

    // Check if click is within the grid area
    if (relativeX < 0 || relativeY < 0) return null;

    // Calculate which grid cell was clicked
    const cellWidth =
      layoutConfig.cardSize.width + layoutConfig.spacing.horizontal;
    const cellHeight =
      layoutConfig.cardSize.height + layoutConfig.spacing.vertical;

    const col = Math.floor(relativeX / cellWidth);
    const row = Math.floor(relativeY / cellHeight);

    // Check if within grid bounds
    if (
      col >= layoutConfig.gridLayout.cols ||
      row >= layoutConfig.gridLayout.rows
    ) {
      return null;
    }

    // Check if click is within the actual card (not in spacing)
    const cardStartX = col * cellWidth;
    const cardStartY = row * cellHeight;

    if (
      relativeX > cardStartX + layoutConfig.cardSize.width ||
      relativeY > cardStartY + layoutConfig.cardSize.height
    ) {
      return null;
    }

    // Calculate card index
    const cardIndex = row * layoutConfig.gridLayout.cols + col;

    // Check if card index is valid for current difficulty
    const totalCards =
      layoutConfig.gridLayout.rows * layoutConfig.gridLayout.cols;
    if (cardIndex >= totalCards) return null;

    return cardIndex;
  };

  /**
   * Get layout information for debugging
   */
  const getLayoutInfo = () => ({
    containerSize: containerSize.value,
    currentBreakpoint: currentBreakpoint.value,
    layoutConfig: { ...layoutConfig },
    totalCards: layoutConfig.gridLayout.rows * layoutConfig.gridLayout.cols,
  });

  /**
   * Check if layout is suitable for current container
   */
  const isLayoutValid = (): boolean => {
    const { width, height } = containerSize.value;
    const { canvasSize } = layoutConfig;

    return (
      width >= 320 && // Minimum width requirement
      height >= 240 && // Minimum height requirement
      canvasSize.width <= width &&
      canvasSize.height <= height
    );
  };

  /**
   * Get responsive scale factor for elements
   */
  const getScaleFactor = (): number => {
    const breakpoint = currentBreakpoint.value;
    const containerWidth = containerSize.value.width;

    if (breakpoint.name === "mobile" && containerWidth < 400) {
      return Math.max(0.8, containerWidth / 400);
    }

    return 1;
  };

  return {
    // Reactive state
    containerSize,
    canvasSize,
    cardSize,
    gridLayout,
    currentBreakpoint,

    // Methods
    updateContainerSize,
    calculateLayout,
    getCardPosition,
    getCardIndexAtPosition,
    getLayoutInfo,
    isLayoutValid,
    getScaleFactor,

    // Layout configuration (readonly)
    layoutConfig: readonly(layoutConfig),
  };
};
