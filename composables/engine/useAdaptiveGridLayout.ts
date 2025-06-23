import { computed, ref, watch, reactive, readonly, type Ref } from "vue";
import type { GameCard } from "~/types/game";

// Core types for the adaptive grid system
export interface GridPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridLayout {
  positions: GridPosition[];
  cardDimensions: {
    width: number;
    height: number;
  };
  cols: number;
  rows: number;
  totalGridWidth: number;
  totalGridHeight: number;
  efficiency: number;
  deviceType: DeviceType;
  orientation: DeviceOrientation;
}

export interface CanvasDimensions {
  width: number;
  height: number;
}

export type DeviceType = "mobile" | "tablet" | "desktop";
export type DeviceOrientation = "portrait" | "landscape";

export interface LayoutCalculationContext {
  canvasWidth: number;
  canvasHeight: number;
  cardCount: number;
  deviceType: DeviceType;
  orientation: DeviceOrientation;
  minCardSize: number;
  maxCardSize: number;
  gap: number;
  aspectRatio: number;
  paddingFactor: number;
}

// Strategy Pattern Interface
export interface ILayoutStrategy {
  /**
   * Calculate optimal grid layout based on the given context
   */
  calculateLayout(context: LayoutCalculationContext): GridLayout;

  /**
   * Get strategy name for debugging
   */
  getStrategyName(): string;
}

// Desktop Layout Strategy - Uses balanced approach
class DesktopLayoutStrategy implements ILayoutStrategy {
  calculateLayout(context: LayoutCalculationContext): GridLayout {
    const {
      canvasWidth,
      canvasHeight,
      cardCount,
      minCardSize,
      maxCardSize,
      gap,
      aspectRatio,
      paddingFactor,
      deviceType,
      orientation,
    } = context;

    // Apply padding to canvas dimensions
    const paddedWidth = canvasWidth * (1 - paddingFactor * 2);
    const paddedHeight = canvasHeight * (1 - paddingFactor * 2);

    // For desktop, use balanced approach - try to find optimal square-ish grid
    const sqrt = Math.sqrt(cardCount);
    let bestLayout: GridLayout | null = null;
    let bestScore = 0;

    // Calculate canvas aspect ratio to determine if we need to test wider ranges
    const canvasAspectRatio = canvasWidth / canvasHeight;
    const isVeryWide = canvasAspectRatio > 2.5; // Much wider than tall
    const isVeryTall = canvasAspectRatio < 0.6; // Much taller than wide

    // Expand search range for extreme aspect ratios
    let minCols = Math.floor(sqrt);
    let maxCols = Math.ceil(sqrt) + 2;

    if (isVeryWide) {
      // For very wide canvas, test more columns (fewer rows)
      maxCols = Math.min(cardCount, Math.ceil(sqrt) + 4);
    } else if (isVeryTall) {
      // For very tall canvas, test fewer columns (more rows)
      minCols = Math.max(1, Math.floor(sqrt) - 2);
    }

    // Test different grid configurations
    for (let cols = minCols; cols <= maxCols; cols++) {
      const rows = Math.ceil(cardCount / cols);

      // Calculate initial card dimensions for this grid
      let cardWidth = (paddedWidth - (cols - 1) * gap) / cols;
      let cardHeight = (paddedHeight - (rows - 1) * gap) / rows;

      // Apply aspect ratio constraint
      const targetCardHeight = cardWidth * aspectRatio;
      if (targetCardHeight <= cardHeight) {
        cardHeight = targetCardHeight;
      } else {
        cardWidth = cardHeight / aspectRatio;
      }

      const initialCardSize = Math.min(cardWidth, cardHeight);

      // Iterative card size reduction until it fits
      let finalCardWidth = Math.ceil(cardWidth);
      let finalCardHeight = Math.ceil(cardHeight);
      let attempts = 0;
      const maxAttempts = 50; // Safety limit

      while (attempts < maxAttempts) {
        // Calculate grid dimensions with current card size
        const totalGridWidth = cols * finalCardWidth + (cols - 1) * gap;
        const totalGridHeight = rows * finalCardHeight + (rows - 1) * gap;

        // Check if it fits
        const widthFits = totalGridWidth <= paddedWidth;
        const heightFits = totalGridHeight <= paddedHeight;
        const finalCardSize = Math.min(finalCardWidth, finalCardHeight);
        const cardSizeValid =
          finalCardSize >= minCardSize && finalCardSize <= maxCardSize;

        // If everything fits, proceed with scoring
        if (widthFits && heightFits && cardSizeValid) {
          // Calculate score based on card size and grid efficiency
          const gridEfficiency = cardCount / (cols * rows);
          const sizeScore = finalCardSize / maxCardSize;
          const aspectScore = Math.min(cols / rows, rows / cols);

          // Adjust scoring weights based on canvas aspect ratio
          let sizeWeight = 0.5;
          let efficiencyWeight = 0.3;
          let aspectWeight = 0.2;

          if (isVeryWide) {
            sizeWeight = 0.4; // Increase card size importance
            efficiencyWeight = 0.5; // Keep high efficiency importance
            aspectWeight = 0.1; // Reduce aspect ratio importance for wide canvas
          }

          const score =
            sizeScore * sizeWeight +
            gridEfficiency * efficiencyWeight +
            aspectScore * aspectWeight;

          if (score > bestScore) {
            bestScore = score;
            bestLayout = this.createLayout(
              cols,
              rows,
              finalCardWidth,
              finalCardHeight,
              gap,
              paddedWidth,
              paddedHeight,
              canvasWidth,
              canvasHeight,
              cardCount,
              deviceType,
              orientation
            );
          }
          break; // Found valid solution for this grid configuration
        }

        // If doesn't fit, reduce card size by 2px
        if (!widthFits) {
          finalCardWidth = Math.max(minCardSize, finalCardWidth - 2);
        }
        if (!heightFits) {
          finalCardHeight = Math.max(minCardSize, finalCardHeight - 2);
        }

        // If card size becomes too small, break
        if (Math.min(finalCardWidth, finalCardHeight) < minCardSize) {
          if (process.env.NODE_ENV === "development") {
            console.log(
              `❌ ${cols}×${rows} rejected: cards too small after reduction`
            );
          }
          break;
        }

        attempts++;
      }
    }

    // Fallback if no valid layout found
    if (!bestLayout) {
      console.warn(
        `No valid layout found for ${cardCount} cards on desktop. Using constrained fallback.`
      );

      const cols = Math.ceil(Math.sqrt(cardCount));
      const rows = Math.ceil(cardCount / cols);

      // Calculate card size that fits within both width and height constraints
      const cardWidthFromWidth = (paddedWidth - (cols - 1) * gap) / cols;
      const cardHeightFromHeight = (paddedHeight - (rows - 1) * gap) / rows;
      const cardWidthFromHeight = cardHeightFromHeight / aspectRatio;

      // Use the smaller constraint to ensure the grid fits
      let cardWidth = Math.min(cardWidthFromWidth, cardWidthFromHeight);
      cardWidth = Math.max(minCardSize, Math.min(cardWidth, maxCardSize));
      const cardHeight = cardWidth * aspectRatio;

      bestLayout = this.createLayout(
        cols,
        rows,
        cardWidth,
        cardHeight,
        gap,
        paddedWidth,
        paddedHeight,
        canvasWidth,
        canvasHeight,
        cardCount,
        deviceType,
        orientation
      );
    }

    return bestLayout;
  }

  private createLayout(
    cols: number,
    rows: number,
    cardWidth: number,
    cardHeight: number,
    gap: number,
    paddedWidth: number,
    paddedHeight: number,
    canvasWidth: number,
    canvasHeight: number,
    cardCount: number,
    deviceType: DeviceType,
    orientation: DeviceOrientation
  ): GridLayout {
    const totalGridWidth = cols * cardWidth + (cols - 1) * gap;
    const totalGridHeight = rows * cardHeight + (rows - 1) * gap;

    const offsetX = (canvasWidth - totalGridWidth) / 2;
    const offsetY = (canvasHeight - totalGridHeight) / 2;

    const positions: GridPosition[] = [];

    for (let i = 0; i < cardCount; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;

      let x: number;

      const isLastRow = row === rows - 1;
      const cardsInLastRow = cardCount % cols;
      const isIncompleteLastRow = isLastRow && cardsInLastRow > 0;

      if (isIncompleteLastRow) {
        const lastRowWidth =
          cardsInLastRow * cardWidth + (cardsInLastRow - 1) * gap;
        const lastRowOffsetX = (totalGridWidth - lastRowWidth) / 2;
        x = offsetX + lastRowOffsetX + col * (cardWidth + gap);
      } else {
        x = offsetX + col * (cardWidth + gap);
      }

      const y = offsetY + row * (cardHeight + gap);

      positions.push({
        x: Math.round(x + cardWidth / 2),
        y: Math.round(y + cardHeight / 2),
        width: Math.round(cardWidth),
        height: Math.round(cardHeight),
      });
    }

    return {
      positions,
      cardDimensions: {
        width: Math.round(cardWidth),
        height: Math.round(cardHeight),
      },
      cols,
      rows,
      totalGridWidth,
      totalGridHeight,
      efficiency: cardCount / (cols * rows),
      deviceType,
      orientation,
    };
  }

  getStrategyName(): string {
    return "DesktopLayoutStrategy";
  }
}

// Mobile Portrait Strategy - Optimizes for width first with card count awareness
class MobilePortraitLayoutStrategy implements ILayoutStrategy {
  calculateLayout(context: LayoutCalculationContext): GridLayout {
    const {
      canvasWidth,
      canvasHeight,
      cardCount,
      minCardSize,
      maxCardSize,
      gap,
      aspectRatio,
      paddingFactor,
      deviceType,
      orientation,
    } = context;

    const paddedWidth = canvasWidth * (1 - paddingFactor * 2);
    const paddedHeight = canvasHeight * (1 - paddingFactor * 2);

    let minCols: number, maxCols: number;

    if (cardCount <= 12) {
      // Easy level: 2-4 columns work well
      minCols = 2;
      maxCols = 4;
    } else if (cardCount <= 16) {
      // Medium level: 3-5 columns
      minCols = 3;
      maxCols = 5;
    } else {
      // Hard level (16+ cards): 4-6 columns to keep cards reasonably sized
      minCols = 4;
      maxCols = 6;
    }

    let bestLayout: GridLayout | null = null;
    let bestScore = 0;

    // Test different column configurations within the optimal range
    for (let cols = minCols; cols <= maxCols; cols++) {
      const rows = Math.ceil(cardCount / cols);

      // Calculate card dimensions for this grid
      const cardWidth = (paddedWidth - (cols - 1) * gap) / cols;
      const cardHeight = cardWidth * aspectRatio;
      const totalHeight = rows * cardHeight + (rows - 1) * gap;

      // Check if this layout is valid
      if (
        cardWidth >= minCardSize &&
        cardWidth <= maxCardSize &&
        totalHeight <= paddedHeight
      ) {
        // Calculate score - prefer layouts that:
        // 1. Have larger cards (but within limits)
        // 2. Use space efficiently
        // 3. Have good grid efficiency
        const sizeScore = Math.min(cardWidth / maxCardSize, 1);
        const gridEfficiency = cardCount / (cols * rows);
        const spaceUsage = totalHeight / paddedHeight;

        // For mobile portrait, prefer more columns for better space usage
        const columnBonus = Math.min(cols / maxCols, 1) * 0.1;

        const score =
          sizeScore * 0.4 +
          gridEfficiency * 0.3 +
          spaceUsage * 0.2 +
          columnBonus;

        if (score > bestScore) {
          bestScore = score;
          bestLayout = this.createLayout(
            cols,
            rows,
            cardWidth,
            cardHeight,
            gap,
            paddedWidth,
            paddedHeight,
            canvasWidth,
            canvasHeight,
            cardCount,
            deviceType,
            orientation
          );
        }
      }
    }

    // Enhanced fallback if no valid layout found
    if (!bestLayout) {
      console.warn(
        `No valid layout found for ${cardCount} cards. Using fallback.`
      );

      // Use optimal column count based on card count
      let fallbackCols: number;
      if (cardCount <= 12) fallbackCols = 3;
      else if (cardCount <= 24) fallbackCols = 4;
      else fallbackCols = Math.min(6, Math.ceil(Math.sqrt(cardCount * 1.2))); // Slightly more columns for large sets

      const fallbackRows = Math.ceil(cardCount / fallbackCols);

      // Calculate card size that fits within constraints
      let cardWidth = (paddedWidth - (fallbackCols - 1) * gap) / fallbackCols;
      cardWidth = Math.max(minCardSize, Math.min(cardWidth, maxCardSize));
      const cardHeight = cardWidth * aspectRatio;

      bestLayout = this.createLayout(
        fallbackCols,
        fallbackRows,
        cardWidth,
        cardHeight,
        gap,
        paddedWidth,
        paddedHeight,
        canvasWidth,
        canvasHeight,
        cardCount,
        deviceType,
        orientation
      );
    }

    return bestLayout;
  }

  private createLayout(
    cols: number,
    rows: number,
    cardWidth: number,
    cardHeight: number,
    gap: number,
    paddedWidth: number,
    paddedHeight: number,
    canvasWidth: number,
    canvasHeight: number,
    cardCount: number,
    deviceType: DeviceType,
    orientation: DeviceOrientation
  ): GridLayout {
    const totalGridWidth = cols * cardWidth + (cols - 1) * gap;
    const totalGridHeight = rows * cardHeight + (rows - 1) * gap;

    const offsetX = (canvasWidth - totalGridWidth) / 2;
    const offsetY = (canvasHeight - totalGridHeight) / 2;

    const positions: GridPosition[] = [];

    for (let i = 0; i < cardCount; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;

      let x: number;

      // Center cards in the last incomplete row if needed
      const isLastRow = row === rows - 1;
      const cardsInLastRow = cardCount % cols;
      const isIncompleteLastRow = isLastRow && cardsInLastRow > 0;

      if (isIncompleteLastRow) {
        const lastRowWidth =
          cardsInLastRow * cardWidth + (cardsInLastRow - 1) * gap;
        const lastRowOffsetX = (totalGridWidth - lastRowWidth) / 2;
        x = offsetX + lastRowOffsetX + col * (cardWidth + gap);
      } else {
        x = offsetX + col * (cardWidth + gap);
      }

      const y = offsetY + row * (cardHeight + gap);

      positions.push({
        x: Math.round(x + cardWidth / 2),
        y: Math.round(y + cardHeight / 2),
        width: Math.round(cardWidth),
        height: Math.round(cardHeight),
      });
    }

    return {
      positions,
      cardDimensions: {
        width: Math.round(cardWidth),
        height: Math.round(cardHeight),
      },
      cols,
      rows,
      totalGridWidth,
      totalGridHeight,
      efficiency: cardCount / (cols * rows),
      deviceType,
      orientation,
    };
  }

  getStrategyName(): string {
    return "MobilePortraitLayoutStrategy";
  }
}

// Mobile Landscape Strategy - Optimizes for height first with card count awareness
class MobileLandscapeLayoutStrategy implements ILayoutStrategy {
  calculateLayout(context: LayoutCalculationContext): GridLayout {
    const {
      canvasWidth,
      canvasHeight,
      cardCount,
      minCardSize,
      maxCardSize,
      gap,
      aspectRatio,
      paddingFactor,
      deviceType,
      orientation,
    } = context;

    // Apply padding to canvas dimensions
    const paddedWidth = canvasWidth * (1 - paddingFactor * 2);
    const paddedHeight = canvasHeight * (1 - paddingFactor * 2);

    // Determine optimal row range based on card count (difficulty level)
    let minRows: number, maxRows: number;

    if (cardCount <= 12) {
      // Easy level: 2-3 rows work well in landscape
      minRows = 2;
      maxRows = 3;
    } else if (cardCount <= 16) {
      // Medium level: 3-4 rows
      minRows = 3;
      maxRows = 4;
    } else {
      // Hard level (16+ cards): 4-6 rows to keep cards reasonably sized
      minRows = 4;
      maxRows = 6;
    }

    let bestLayout: GridLayout | null = null;
    let bestScore = 0;

    // Test different row configurations within the optimal range
    for (let rows = minRows; rows <= maxRows; rows++) {
      const cols = Math.ceil(cardCount / rows);

      // Calculate card dimensions for this grid
      const cardHeight = (paddedHeight - (rows - 1) * gap) / rows;
      const cardWidth = cardHeight / aspectRatio;
      const totalWidth = cols * cardWidth + (cols - 1) * gap;

      // Check if this layout is valid
      if (
        cardWidth >= minCardSize &&
        cardWidth <= maxCardSize &&
        totalWidth <= paddedWidth
      ) {
        // Calculate score - prefer layouts that use space efficiently
        const sizeScore = Math.min(cardWidth / maxCardSize, 1);
        const gridEfficiency = cardCount / (cols * rows);
        const spaceUsage = totalWidth / paddedWidth;

        // For mobile landscape, prefer fewer rows for better visibility
        const rowBonus = Math.min((maxRows - rows + 1) / maxRows, 1) * 0.1;

        const score =
          sizeScore * 0.4 + gridEfficiency * 0.3 + spaceUsage * 0.2 + rowBonus;

        if (score > bestScore) {
          bestScore = score;
          bestLayout = this.createLayout(
            cols,
            rows,
            cardWidth,
            cardHeight,
            gap,
            paddedWidth,
            paddedHeight,
            canvasWidth,
            canvasHeight,
            cardCount,
            deviceType,
            orientation
          );
        }
      }
    }

    // Enhanced fallback if no valid layout found
    if (!bestLayout) {
      console.warn(
        `No valid layout found for ${cardCount} cards in landscape. Using fallback.`
      );

      // Use optimal row count based on card count
      let fallbackRows: number;
      if (cardCount <= 12) fallbackRows = 3;
      else if (cardCount <= 24) fallbackRows = 4;
      else fallbackRows = Math.min(6, Math.ceil(Math.sqrt(cardCount * 0.8))); // Fewer rows for landscape

      const fallbackCols = Math.ceil(cardCount / fallbackRows);

      // Calculate card size that fits within constraints
      const cardHeight =
        (paddedHeight - (fallbackRows - 1) * gap) / fallbackRows;
      let cardWidth = cardHeight / aspectRatio;
      cardWidth = Math.max(minCardSize, Math.min(cardWidth, maxCardSize));

      bestLayout = this.createLayout(
        fallbackCols,
        fallbackRows,
        cardWidth,
        cardHeight,
        gap,
        paddedWidth,
        paddedHeight,
        canvasWidth,
        canvasHeight,
        cardCount,
        deviceType,
        orientation
      );
    }

    return bestLayout;
  }

  private createLayout(
    cols: number,
    rows: number,
    cardWidth: number,
    cardHeight: number,
    gap: number,
    paddedWidth: number,
    paddedHeight: number,
    canvasWidth: number,
    canvasHeight: number,
    cardCount: number,
    deviceType: DeviceType,
    orientation: DeviceOrientation
  ): GridLayout {
    const totalGridWidth = cols * cardWidth + (cols - 1) * gap;
    const totalGridHeight = rows * cardHeight + (rows - 1) * gap;

    const offsetX = (canvasWidth - totalGridWidth) / 2;
    const offsetY = (canvasHeight - totalGridHeight) / 2;

    const positions: GridPosition[] = [];

    for (let i = 0; i < cardCount; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;

      let x: number;

      // Center cards in the last incomplete row if needed
      const isLastRow = row === rows - 1;
      const cardsInLastRow = cardCount % cols;
      const isIncompleteLastRow = isLastRow && cardsInLastRow > 0;

      if (isIncompleteLastRow) {
        const lastRowWidth =
          cardsInLastRow * cardWidth + (cardsInLastRow - 1) * gap;
        const lastRowOffsetX = (totalGridWidth - lastRowWidth) / 2;
        x = offsetX + lastRowOffsetX + col * (cardWidth + gap);
      } else {
        x = offsetX + col * (cardWidth + gap);
      }

      const y = offsetY + row * (cardHeight + gap);

      positions.push({
        x: Math.round(x + cardWidth / 2),
        y: Math.round(y + cardHeight / 2),
        width: Math.round(cardWidth),
        height: Math.round(cardHeight),
      });
    }

    return {
      positions,
      cardDimensions: {
        width: Math.round(cardWidth),
        height: Math.round(cardHeight),
      },
      cols,
      rows,
      totalGridWidth,
      totalGridHeight,
      efficiency: cardCount / (cols * rows),
      deviceType,
      orientation,
    };
  }

  getStrategyName(): string {
    return "MobileLandscapeLayoutStrategy";
  }
}

// Factory Pattern for creating layout strategies
/**
 * Create appropriate layout strategy based on device type and orientation
 */
export function createLayoutStrategy(
  deviceType: DeviceType,
  orientation: DeviceOrientation
): ILayoutStrategy {
  if (deviceType === "desktop") {
    return new DesktopLayoutStrategy();
  }

  if (deviceType === "mobile" || deviceType === "tablet") {
    if (orientation === "portrait") {
      return new MobilePortraitLayoutStrategy();
    } else {
      return new MobileLandscapeLayoutStrategy();
    }
  }

  // Fallback to desktop strategy
  return new DesktopLayoutStrategy();
}

/**
 * Get all available strategies for testing/debugging
 */
export function getAllLayoutStrategies(): ILayoutStrategy[] {
  return [
    new DesktopLayoutStrategy(),
    new MobilePortraitLayoutStrategy(),
    new MobileLandscapeLayoutStrategy(),
  ];
}

// Device Settings Configuration
interface DeviceSettings {
  gap: number;
  minCardSize: number;
  maxCardSize: number;
  aspectRatio: number;
  paddingFactor: number;
}

const DEVICE_SETTINGS: Record<DeviceType, DeviceSettings> = {
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

// Main Layout Manager using Strategy Pattern
export class CardLayoutManager {
  private currentStrategy: ILayoutStrategy;
  private currentDeviceType: DeviceType = "desktop";
  private currentOrientation: DeviceOrientation = "landscape";

  constructor(
    deviceType: DeviceType = "desktop",
    orientation: DeviceOrientation = "landscape"
  ) {
    this.currentDeviceType = deviceType;
    this.currentOrientation = orientation;
    this.currentStrategy = createLayoutStrategy(deviceType, orientation);
  }

  /**
   * Update device context and switch strategy if needed
   */
  updateDeviceContext(
    deviceType: DeviceType,
    orientation: DeviceOrientation
  ): void {
    if (
      this.currentDeviceType !== deviceType ||
      this.currentOrientation !== orientation
    ) {
      this.currentDeviceType = deviceType;
      this.currentOrientation = orientation;
      this.currentStrategy = createLayoutStrategy(deviceType, orientation);

      console.log(
        `🔄 Layout strategy switched to: ${this.currentStrategy.getStrategyName()}`,
        {
          deviceType,
          orientation,
        }
      );
    }
  }

  /**
   * Calculate optimal grid layout using current strategy
   */
  calculateLayout(
    canvasWidth: number,
    canvasHeight: number,
    cardCount: number
  ): GridLayout {
    const deviceSettings = DEVICE_SETTINGS[this.currentDeviceType];

    const context: LayoutCalculationContext = {
      canvasWidth,
      canvasHeight,
      cardCount,
      deviceType: this.currentDeviceType,
      orientation: this.currentOrientation,
      ...deviceSettings,
    };

    const layout = this.currentStrategy.calculateLayout(context);

    return layout;
  }

  /**
   * Get current strategy info for debugging
   */
  getCurrentStrategyInfo(): {
    name: string;
    deviceType: DeviceType;
    orientation: DeviceOrientation;
  } {
    return {
      name: this.currentStrategy.getStrategyName(),
      deviceType: this.currentDeviceType,
      orientation: this.currentOrientation,
    };
  }

  /**
   * Validate layout and provide warnings/recommendations
   */
  validateLayout(layout: GridLayout): {
    warnings: string[];
    recommendations: {
      optimalCardCount: number;
      gridEfficiency: number;
      deviceOptimized: boolean;
    };
  } {
    const warnings: string[] = [];
    const deviceSettings = DEVICE_SETTINGS[this.currentDeviceType];

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
  }
}

/**
 * Vue Composable for Adaptive Grid Layout
 * Main entry point for using the adaptive grid system
 */
export function useAdaptiveGridLayout(
  canvasDimensions?: Ref<CanvasDimensions> | CanvasDimensions,
  initialDeviceType: DeviceType = "desktop",
  initialOrientation: DeviceOrientation = "landscape"
) {
  // Reactive state
  const layoutManager = ref(
    new CardLayoutManager(initialDeviceType, initialOrientation)
  );
  const currentLayout = ref<GridLayout | null>(null);
  const layoutWarnings = ref<string[]>([]);

  // Handle canvas dimensions - can be reactive ref or static object
  const canvasWidth = ref(0);
  const canvasHeight = ref(0);

  // Initialize canvas dimensions
  if (canvasDimensions) {
    if ("value" in canvasDimensions) {
      // It's a reactive ref
      canvasWidth.value = canvasDimensions.value.width;
      canvasHeight.value = canvasDimensions.value.height;

      watch(
        canvasDimensions,
        (newDimensions) => {
          canvasWidth.value = newDimensions.width;
          canvasHeight.value = newDimensions.height;
        },
        { immediate: true }
      );
    } else {
      // It's a static object
      canvasWidth.value = canvasDimensions.width;
      canvasHeight.value = canvasDimensions.height;
    }
  }

  /**
   * Update canvas dimensions manually
   */
  const updateCanvasDimensions = (width: number, height: number) => {
    canvasWidth.value = width;
    canvasHeight.value = height;
  };

  /**
   * Update device context (device type and orientation)
   */
  const updateDeviceContext = (
    deviceType: DeviceType,
    orientation: DeviceOrientation
  ) => {
    layoutManager.value.updateDeviceContext(deviceType, orientation);
  };

  /**
   * Generate layout for given cards
   */
  const generateLayout = (cards: GameCard[]): GridLayout => {
    if (canvasWidth.value === 0 || canvasHeight.value === 0) {
      throw new Error(
        "Canvas dimensions not set. Call updateCanvasDimensions first."
      );
    }

    const layout = layoutManager.value.calculateLayout(
      canvasWidth.value,
      canvasHeight.value,
      cards.length
    );

    // Validate layout and store warnings
    const validation = layoutManager.value.validateLayout(layout);
    layoutWarnings.value = validation.warnings;
    currentLayout.value = layout;

    return layout;
  };

  /**
   * Get current strategy information
   */
  const getCurrentStrategy = computed(() => {
    return layoutManager.value.getCurrentStrategyInfo();
  });

  /**
   * Current canvas dimensions as computed
   */
  const currentCanvasDimensions = computed(() => ({
    width: canvasWidth.value,
    height: canvasHeight.value,
  }));

  return {
    // Core methods
    generateLayout,
    updateDeviceContext,
    updateCanvasDimensions,

    // Reactive state
    currentLayout: readonly(currentLayout),
    layoutWarnings: readonly(layoutWarnings),
    getCurrentStrategy,
    currentCanvasDimensions,

    // Layout manager access for advanced usage
    layoutManager: readonly(layoutManager),
  };
}
