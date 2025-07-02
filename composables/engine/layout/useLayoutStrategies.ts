import type { DeviceType, DeviceOrientation } from "../device";

/**
 * Parameters for the shared createLayout function
 */
export interface GridParams {
  cols: number;
  rows: number;
  cardWidth: number;
  cardHeight: number;
  gap: number;
  paddedWidth: number;
  paddedHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  cardCount: number;
  deviceType: DeviceType;
  orientation: DeviceOrientation;
}

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

/**
 * Layout Strategy Function Type
 */
export type LayoutStrategyFunction = (
  context: LayoutCalculationContext
) => GridParams | null;

/**
 * Shared layout creation logic extracted from all strategies.
 *
 * Handles:
 * - Grid dimension calculations
 * - Canvas centering
 * - Incomplete last row centering
 * - Position calculations for all cards
 * - Proper rounding for pixel-perfect positioning
 */
export const createLayout = (params: GridParams): GridLayout => {
  const {
    cols,
    rows,
    cardWidth,
    cardHeight,
    gap,
    canvasWidth,
    canvasHeight,
    cardCount,
    deviceType,
    orientation,
  } = params;

  // Calculate total grid dimensions
  const totalGridWidth = cols * cardWidth + (cols - 1) * gap;
  const totalGridHeight = rows * cardHeight + (rows - 1) * gap;

  // Center the grid within the canvas
  const offsetX = (canvasWidth - totalGridWidth) / 2;
  const offsetY = (canvasHeight - totalGridHeight) / 2;

  const positions: GridPosition[] = [];

  // Generate positions for all cards
  for (let i = 0; i < cardCount; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;

    let x: number;

    // Handle centering of incomplete last row
    const isLastRow = row === rows - 1;
    const cardsInLastRow = cardCount % cols;
    const isIncompleteLastRow = isLastRow && cardsInLastRow > 0;

    if (isIncompleteLastRow) {
      // Center the incomplete row
      const lastRowWidth =
        cardsInLastRow * cardWidth + (cardsInLastRow - 1) * gap;
      const lastRowOffsetX = (totalGridWidth - lastRowWidth) / 2;
      x = offsetX + lastRowOffsetX + col * (cardWidth + gap);
    } else {
      // Normal row positioning
      x = offsetX + col * (cardWidth + gap);
    }

    const y = offsetY + row * (cardHeight + gap);

    // Store position with card center coordinates and rounded dimensions
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
};

/**
 * Desktop Layout Strategy - Uses balanced approach
 */
export const calculateDesktopLayout: LayoutStrategyFunction = (context) => {
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
  let bestParams: GridParams | null = null;
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
          bestParams = {
            cols,
            rows,
            cardWidth: finalCardWidth,
            cardHeight: finalCardHeight,
            gap,
            paddedWidth,
            paddedHeight,
            canvasWidth,
            canvasHeight,
            cardCount,
            deviceType,
            orientation,
          };
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
  if (!bestParams) {
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

    bestParams = {
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
      orientation,
    };
  }

  return bestParams;
};

/**
 * Mobile Portrait Strategy - Optimizes for width first with card count awareness
 */
export const calculateMobilePortraitLayout: LayoutStrategyFunction = (
  context
) => {
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

  let bestParams: GridParams | null = null;
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
        sizeScore * 0.4 + gridEfficiency * 0.3 + spaceUsage * 0.2 + columnBonus;

      if (score > bestScore) {
        bestScore = score;
        bestParams = {
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
          orientation,
        };
      }
    }
  }

  // Enhanced fallback if no valid layout found
  if (!bestParams) {
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

    bestParams = {
      cols: fallbackCols,
      rows: fallbackRows,
      cardWidth,
      cardHeight,
      gap,
      paddedWidth,
      paddedHeight,
      canvasWidth,
      canvasHeight,
      cardCount,
      deviceType,
      orientation,
    };
  }

  return bestParams;
};

/**
 * Mobile Landscape Strategy - Optimizes for height first with card count awareness
 */
export const calculateMobileLandscapeLayout: LayoutStrategyFunction = (
  context
) => {
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

  let bestParams: GridParams | null = null;
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
        bestParams = {
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
          orientation,
        };
      }
    }
  }

  // Enhanced fallback if no valid layout found
  if (!bestParams) {
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
    const cardHeight = (paddedHeight - (fallbackRows - 1) * gap) / fallbackRows;
    let cardWidth = cardHeight / aspectRatio;
    cardWidth = Math.max(minCardSize, Math.min(cardWidth, maxCardSize));

    bestParams = {
      cols: fallbackCols,
      rows: fallbackRows,
      cardWidth,
      cardHeight,
      gap,
      paddedWidth,
      paddedHeight,
      canvasWidth,
      canvasHeight,
      cardCount,
      deviceType,
      orientation,
    };
  }

  return bestParams;
};

/**
 * Factory function for creating appropriate layout strategy based on device type and orientation
 */
export const getLayoutStrategy = (
  deviceType: DeviceType,
  orientation: DeviceOrientation
): LayoutStrategyFunction => {
  if (deviceType === "desktop") {
    return calculateDesktopLayout;
  }

  if (deviceType === "mobile" || deviceType === "tablet") {
    if (orientation === "portrait") {
      return calculateMobilePortraitLayout;
    } else {
      return calculateMobileLandscapeLayout;
    }
  }

  // Fallback to desktop strategy
  return calculateDesktopLayout;
};

/**
 * Get all available layout strategies for testing/debugging
 */
export const getAllLayoutStrategies = (): Record<
  string,
  LayoutStrategyFunction
> => {
  return {
    desktop: calculateDesktopLayout,
    mobilePortrait: calculateMobilePortraitLayout,
    mobileLandscape: calculateMobileLandscapeLayout,
  };
};
