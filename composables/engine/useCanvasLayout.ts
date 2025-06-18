/**
 * useCanvasLayout - Responsive layout system for the memory game canvas
 *
 * This composable manages the responsive layout and positioning of game elements:
 * - Calculates optimal card sizes and grid layouts for different screen sizes
 * - Implements responsive breakpoints (mobile, tablet, desktop)
 * - Handles canvas resizing and container size changes
 * - Manages spacing, padding, and aspect ratios across devices
 * - Provides coordinate conversion between canvas and screen space
 * - Ensures consistent gameplay experience across all device sizes
 *
 * Key features:
 * - Multi-breakpoint responsive design (320px to desktop)
 * - Automatic card size optimization based on available space
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
  minCardSize: number;
  maxCardSize: number;
  spacing: number;
  padding: number;
}

// Responsive breakpoints based on requirements
const BREAKPOINTS: BreakpointConfig[] = [
  {
    name: "mobile",
    minWidth: 320,
    maxWidth: 767,
    cardAspectRatio: 0.7, // Height/width ratio
    minCardSize: 60,
    maxCardSize: 90,
    spacing: 8,
    padding: 16,
  },
  {
    name: "tablet",
    minWidth: 768,
    maxWidth: 1023,
    cardAspectRatio: 0.7,
    minCardSize: 80,
    maxCardSize: 120,
    spacing: 12,
    padding: 24,
  },
  {
    name: "desktop",
    minWidth: 1024,
    cardAspectRatio: 0.7,
    minCardSize: 100,
    maxCardSize: 150,
    spacing: 16,
    padding: 32,
  },
];

export const useCanvasLayout = () => {
  // Container size (from ResizeObserver)
  const containerSize = ref({ width: 0, height: 0 });

  // Current layout configuration
  const layoutConfig = reactive<LayoutConfig>({
    canvasSize: { width: 800, height: 600 },
    cardSize: { width: 100, height: 140 },
    gridLayout: { rows: 3, cols: 4 },
    spacing: { horizontal: 16, vertical: 16 },
    padding: { top: 32, right: 32, bottom: 32, left: 32 },
  });

  // Current breakpoint
  const currentBreakpoint = computed(() => {
    const width = containerSize.value.width;
    return (
      BREAKPOINTS.find(
        (bp) => width >= bp.minWidth && (!bp.maxWidth || width <= bp.maxWidth),
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

    // Update canvas size to match container
    layoutConfig.canvasSize = {
      width: Math.max(320, width), // Minimum width as per requirements
      height: Math.max(240, height),
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

    // Update grid layout from difficulty
    layoutConfig.gridLayout = {
      rows: difficulty.gridSize.rows,
      cols: difficulty.gridSize.cols,
    };

    // Calculate padding based on breakpoint
    const padding = breakpoint.padding;
    layoutConfig.padding = {
      top: padding,
      right: padding,
      bottom: padding,
      left: padding,
    };

    // Calculate available space
    const availableWidth =
      containerWidth - (layoutConfig.padding.left + layoutConfig.padding.right);
    const availableHeight =
      containerHeight -
      (layoutConfig.padding.top + layoutConfig.padding.bottom);

    // Calculate spacing
    const spacing = breakpoint.spacing;
    layoutConfig.spacing = {
      horizontal: spacing,
      vertical: spacing,
    };

    // Calculate card size based on available space and grid
    const cardSize = calculateOptimalCardSize(
      availableWidth,
      availableHeight,
      difficulty.gridSize,
      breakpoint,
    );

    layoutConfig.cardSize = cardSize;

    // Recalculate actual canvas size based on final layout
    const totalWidth =
      layoutConfig.padding.left +
      layoutConfig.padding.right +
      cardSize.width * difficulty.gridSize.cols +
      layoutConfig.spacing.horizontal * (difficulty.gridSize.cols - 1);

    const totalHeight =
      layoutConfig.padding.top +
      layoutConfig.padding.bottom +
      cardSize.height * difficulty.gridSize.rows +
      layoutConfig.spacing.vertical * (difficulty.gridSize.rows - 1);

    layoutConfig.canvasSize = {
      width: Math.min(totalWidth, containerWidth),
      height: Math.min(totalHeight, containerHeight),
    };

    console.log("Layout calculated:", {
      difficulty: difficulty.name,
      breakpoint: breakpoint.name,
      containerSize: containerSize.value,
      canvasSize: layoutConfig.canvasSize,
      cardSize: layoutConfig.cardSize,
      gridLayout: layoutConfig.gridLayout,
    });
  };

  /**
   * Calculate optimal card size for given constraints
   */
  const calculateOptimalCardSize = (
    availableWidth: number,
    availableHeight: number,
    gridSize: { rows: number; cols: number },
    breakpoint: BreakpointConfig,
  ): { width: number; height: number } => {
    // Calculate maximum card size based on available space
    const maxWidthFromSpace =
      (availableWidth - layoutConfig.spacing.horizontal * (gridSize.cols - 1)) /
      gridSize.cols;
    const maxHeightFromSpace =
      (availableHeight - layoutConfig.spacing.vertical * (gridSize.rows - 1)) /
      gridSize.rows;

    // Apply aspect ratio constraint
    const maxWidthFromHeight = maxHeightFromSpace / breakpoint.cardAspectRatio;
    const maxHeightFromWidth = maxWidthFromSpace * breakpoint.cardAspectRatio;

    // Choose the most constraining dimension
    let cardWidth: number;
    let cardHeight: number;

    if (maxWidthFromHeight <= maxWidthFromSpace) {
      // Height is the constraining factor
      cardWidth = maxWidthFromHeight;
      cardHeight = maxHeightFromSpace;
    } else {
      // Width is the constraining factor
      cardWidth = maxWidthFromSpace;
      cardHeight = maxHeightFromWidth;
    }

    // Apply breakpoint size constraints
    cardWidth = Math.max(
      breakpoint.minCardSize,
      Math.min(breakpoint.maxCardSize, cardWidth),
    );
    cardHeight = cardWidth * breakpoint.cardAspectRatio;

    // Ensure minimum touch target size on mobile (44px as per iOS guidelines)
    if (breakpoint.name === "mobile") {
      const minTouchSize = 44;
      if (cardWidth < minTouchSize) {
        cardWidth = minTouchSize;
        cardHeight = cardWidth * breakpoint.cardAspectRatio;
      }
    }

    return {
      width: Math.round(cardWidth),
      height: Math.round(cardHeight),
    };
  };

  /**
   * Set default layout when container size is not available
   */
  const setDefaultLayout = (difficulty: DifficultyLevel): void => {
    const defaultBreakpoint = BREAKPOINTS.find((bp) => bp.name === "desktop")!;

    layoutConfig.gridLayout = {
      rows: difficulty.gridSize.rows,
      cols: difficulty.gridSize.cols,
    };

    layoutConfig.cardSize = {
      width: defaultBreakpoint.maxCardSize,
      height: defaultBreakpoint.maxCardSize * defaultBreakpoint.cardAspectRatio,
    };

    layoutConfig.spacing = {
      horizontal: defaultBreakpoint.spacing,
      vertical: defaultBreakpoint.spacing,
    };

    layoutConfig.padding = {
      top: defaultBreakpoint.padding,
      right: defaultBreakpoint.padding,
      bottom: defaultBreakpoint.padding,
      left: defaultBreakpoint.padding,
    };

    const totalWidth =
      layoutConfig.padding.left +
      layoutConfig.padding.right +
      layoutConfig.cardSize.width * difficulty.gridSize.cols +
      layoutConfig.spacing.horizontal * (difficulty.gridSize.cols - 1);

    const totalHeight =
      layoutConfig.padding.top +
      layoutConfig.padding.bottom +
      layoutConfig.cardSize.height * difficulty.gridSize.rows +
      layoutConfig.spacing.vertical * (difficulty.gridSize.rows - 1);

    layoutConfig.canvasSize = { width: totalWidth, height: totalHeight };
  };

  /**
   * Get card position in canvas coordinates
   */
  const getCardPosition = (cardIndex: number): { x: number; y: number } => {
    const row = Math.floor(cardIndex / layoutConfig.gridLayout.cols);
    const col = cardIndex % layoutConfig.gridLayout.cols;

    const x =
      layoutConfig.padding.left +
      col * (layoutConfig.cardSize.width + layoutConfig.spacing.horizontal);

    const y =
      layoutConfig.padding.top +
      row * (layoutConfig.cardSize.height + layoutConfig.spacing.vertical);

    return { x, y };
  };

  /**
   * Get card at specific canvas position
   */
  const getCardIndexAtPosition = (
    canvasX: number,
    canvasY: number,
  ): number | null => {
    // Adjust for padding
    const relativeX = canvasX - layoutConfig.padding.left;
    const relativeY = canvasY - layoutConfig.padding.top;

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
