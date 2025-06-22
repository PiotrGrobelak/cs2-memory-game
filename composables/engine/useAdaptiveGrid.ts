import type { GameCard } from "~/types/game";

export interface CardPosition {
  x: number;
  y: number;
  cardId: string;
}

export interface CardDimensions {
  width: number;
  height: number;
  scale: number;
}

export interface GridLayout {
  rows: number;
  cols: number;
  positions: CardPosition[];
  cardDimensions: CardDimensions;
  totalWidth: number;
  totalHeight: number;
  spacing: {
    horizontal: number;
    vertical: number;
  };
}

export interface AdaptiveGridConfig {
  minCardSize: number;
  maxCardSize: number;
  aspectRatio: number; // width/height ratio for cards
  spacing: number; // Fixed spacing between cards
  paddingRatio: number; // percentage of canvas to use as padding
}

interface GridConfiguration {
  rows: number;
  cols: number;
  cardDimensions: CardDimensions;
  spacing: {
    horizontal: number;
    vertical: number;
  };
  totalWidth: number;
  totalHeight: number;
}

// Memory Game Layout Calculator - functional approach for optimal grid layouts

interface LayoutConfig {
  baseCardWidth: number;
  baseCardHeight: number;
  minCardWidth: number;
  minCardHeight: number;
  margin: number;
  cardGap: number;
  optimalAspectRatio: number;
}

const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  // Base card dimensions (3:4 aspect ratio)
  baseCardWidth: 80,
  baseCardHeight: 106,

  // Minimum card dimensions - reduced for better fit
  minCardWidth: 40,
  minCardHeight: 53,

  // Margin and spacing - dynamically adjusted based on card count
  margin: 15,
  cardGap: 8,

  // Optimal aspect ratio (7:5 = 1.4)
  optimalAspectRatio: 1.4,
};

// Find optimal grid layout for given card count
const findOptimalGrid = (
  cardCount: number,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG
): { rows: number; cols: number; ratio: number } => {
  const possibleLayouts: Array<{ rows: number; cols: number; ratio: number }> =
    [];

  // Check all possible combinations where rows * cols = cardCount
  for (let cols = 1; cols <= cardCount; cols++) {
    if (cardCount % cols === 0) {
      const rows = cardCount / cols;
      // Prefer aspect ratios close to optimal ratio (default 1.4 for 7:5)
      const ratio = Math.abs(cols / rows - config.optimalAspectRatio);
      possibleLayouts.push({ rows, cols, ratio });
    }
  }

  // Sort by closest to optimal aspect ratio
  possibleLayouts.sort((a, b) => a.ratio - b.ratio);
  return possibleLayouts[0];
};

// Calculate layout dimensions for given screen
const calculateMemoryGameLayout = (
  cardCount: number,
  screenWidth: number,
  screenHeight: number,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG
) => {
  const grid = findOptimalGrid(cardCount, config);

  // Dynamic margin and gap adjustment based on card count and screen orientation
  const getDynamicSpacing = () => {
    // Detect landscape orientation for tablets/mobile
    const isLandscape = screenWidth > screenHeight;
    const aspectRatio = screenWidth / screenHeight;

    // Reduce margins significantly for landscape tablets to maximize card space
    const marginMultiplier = isLandscape && aspectRatio > 1.3 ? 0.4 : 1.0;

    if (cardCount <= 12) {
      // For few cards, use smaller margins to allow larger cards
      return {
        margin: config.margin * 0.5 * marginMultiplier,
        gap: config.cardGap * 1.2,
      };
    }
    if (cardCount <= 24) {
      return {
        margin: config.margin * 0.8 * marginMultiplier,
        gap: config.cardGap * 0.9,
      };
    }
    if (cardCount <= 36) {
      // Reduce gaps for medium-high card counts
      return {
        margin: config.margin * 0.9 * marginMultiplier,
        gap: config.cardGap * 0.6,
      };
    }
    if (cardCount <= 48) {
      // Minimal margins for high card counts
      return {
        margin: config.margin * 1.0 * marginMultiplier,
        gap: config.cardGap * 0.8,
      };
    }
    // For very many cards, minimal gaps and margins
    return {
      margin: config.margin * 1.2 * marginMultiplier,
      gap: config.cardGap * 0.3,
    };
  };

  const spacing = getDynamicSpacing();

  // Available space (minus dynamic margins)
  const availableWidth = screenWidth - 2 * spacing.margin;
  const availableHeight = screenHeight - 2 * spacing.margin;

  // Space for gaps between cards
  const totalGapWidth = (grid.cols - 1) * spacing.gap;
  const totalGapHeight = (grid.rows - 1) * spacing.gap;

  // Available space for cards
  const cardAreaWidth = availableWidth - totalGapWidth;
  const cardAreaHeight = availableHeight - totalGapHeight;

  // Maximum card dimensions based on screen constraints
  const maxCardWidth = cardAreaWidth / grid.cols;
  const maxCardHeight = cardAreaHeight / grid.rows;

  // Calculate card dimensions maintaining 3:4 aspect ratio
  let cardWidth: number, cardHeight: number;

  if (maxCardWidth / maxCardHeight > 3 / 4) {
    // Height is the limiting factor - use available height
    cardHeight = maxCardHeight;
    cardWidth = cardHeight * (3 / 4);
  } else {
    // Width is the limiting factor - use available width
    cardWidth = maxCardWidth;
    cardHeight = cardWidth * (4 / 3);
  }

  // Apply size constraints
  // Set maximum card size based on device type and card count
  const getMaxCardSize = () => {
    // For desktop with few cards, allow larger cards
    if (cardCount <= 12) return config.baseCardHeight * 2.5; // Up to 265px
    if (cardCount <= 24) return config.baseCardHeight * 1.8; // Up to 190px
    if (cardCount <= 36) return config.baseCardHeight * 1.4; // Up to 148px
    if (cardCount <= 48) return config.baseCardHeight * 1.0; // Up to 106px for high density
    return config.baseCardHeight * 0.8; // Up to 85px for very dense layouts
  };

  const maxAllowedHeight = getMaxCardSize();

  // Apply constraints
  cardHeight = Math.min(cardHeight, maxAllowedHeight);
  cardHeight = Math.max(cardHeight, config.minCardHeight);
  cardWidth = cardHeight * (3 / 4); // Maintain aspect ratio

  // Check if cards fit on screen
  const totalWidth = cardWidth * grid.cols + totalGapWidth + 2 * spacing.margin;
  const totalHeight =
    cardHeight * grid.rows + totalGapHeight + 2 * spacing.margin;

  // Scale down if exceeding screen bounds - be more aggressive for landscape
  if (totalWidth > screenWidth || totalHeight > screenHeight) {
    const scaleX = screenWidth / totalWidth;
    const scaleY = screenHeight / totalHeight;
    // Use more aggressive scaling for landscape tablets
    const isLandscape = screenWidth > screenHeight;
    const safetyMargin = isLandscape ? 0.92 : 0.95; // Less safety margin in landscape
    const scale = Math.min(scaleX, scaleY) * safetyMargin;

    cardWidth *= scale;
    cardHeight *= scale;

    // Recalculate totals after scaling
    const newTotalWidth =
      cardWidth * grid.cols + totalGapWidth + 2 * spacing.margin;
    const newTotalHeight =
      cardHeight * grid.rows + totalGapHeight + 2 * spacing.margin;

    // If still doesn't fit, reduce gap size and try again
    if (newTotalWidth > screenWidth || newTotalHeight > screenHeight) {
      console.log("⚠️ Still doesn't fit after scaling, reducing gaps...");

      spacing.gap = Math.max(spacing.gap * 0.5, 1); // Minimum 1px gap for tight layouts
      const finalTotalGapWidth = (grid.cols - 1) * spacing.gap;
      const finalTotalGapHeight = (grid.rows - 1) * spacing.gap;

      // Recalculate card size with reduced gaps
      const finalCardAreaWidth =
        screenWidth - 2 * spacing.margin - finalTotalGapWidth;
      const finalCardAreaHeight =
        screenHeight - 2 * spacing.margin - finalTotalGapHeight;

      const finalMaxCardWidth = finalCardAreaWidth / grid.cols;
      const finalMaxCardHeight = finalCardAreaHeight / grid.rows;

      if (finalMaxCardWidth / finalMaxCardHeight > 3 / 4) {
        cardHeight = finalMaxCardHeight * 0.98; // Tighter safety margin
        cardWidth = cardHeight * (3 / 4);
      } else {
        cardWidth = finalMaxCardWidth * 0.98; // Tighter safety margin
        cardHeight = cardWidth * (4 / 3);
      }

      if (process.env.NODE_ENV === "development") {
        console.log("🔧 After gap reduction:", {
          reducedGap: spacing.gap,
          finalCardSize: { width: cardWidth, height: cardHeight },
          finalTotalSize: {
            width: cardWidth * grid.cols + finalTotalGapWidth,
            height: cardHeight * grid.rows + finalTotalGapHeight,
          },
        });
      }
    }
  }

  // Final gap calculation after potential reductions
  const finalTotalGapWidth = (grid.cols - 1) * spacing.gap;
  const finalTotalGapHeight = (grid.rows - 1) * spacing.gap;

  const result = {
    rows: grid.rows,
    cols: grid.cols,
    cardWidth: Math.floor(cardWidth),
    cardHeight: Math.floor(cardHeight),
    totalWidth: Math.floor(cardWidth * grid.cols + finalTotalGapWidth),
    totalHeight: Math.floor(cardHeight * grid.rows + finalTotalGapHeight),
    gap: spacing.gap,
  };

  // Final debug logging
  if (process.env.NODE_ENV === "development") {
    console.log("✅ Final layout result:", {
      screenSize: { width: screenWidth, height: screenHeight },
      gridLayout: `${result.rows}x${result.cols}`,
      cardSize: { width: result.cardWidth, height: result.cardHeight },
      gridTotalSize: { width: result.totalWidth, height: result.totalHeight },
      marginsUsed: {
        horizontal: spacing.margin * 2,
        vertical: spacing.margin * 2,
      },
      spacing: result.gap,
      utilization: {
        width:
          (
            ((result.totalWidth + 2 * spacing.margin) / screenWidth) *
            100
          ).toFixed(1) + "%",
        height:
          (
            ((result.totalHeight + 2 * spacing.margin) / screenHeight) *
            100
          ).toFixed(1) + "%",
      },
    });
  }

  return result;
};

const DEFAULT_CONFIG: AdaptiveGridConfig = {
  minCardSize: 60,
  maxCardSize: 180,
  aspectRatio: 0.75, // 3:4 ratio (width:height)
  spacing: 20,
  paddingRatio: 0.05, // 5% padding
};

export const useAdaptiveGrid = (config: Partial<AdaptiveGridConfig> = {}) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Calculate optimal grid layout based on canvas size and card count
  const calculateOptimalLayout = (
    canvasWidth: number,
    canvasHeight: number,
    cardCount: number,
    deviceType: "mobile" | "tablet" | "desktop" = "desktop"
  ): GridLayout => {
    // Use the new optimized algorithm
    const layout = calculateMemoryGameLayout(
      cardCount,
      canvasWidth,
      canvasHeight
    );

    // Convert to our interface format
    const cardDimensions: CardDimensions = {
      width: layout.cardWidth,
      height: layout.cardHeight,
      scale: layout.cardHeight / 106, // Scale relative to base height
    };

    const spacing = {
      horizontal: layout.gap,
      vertical: layout.gap,
    };

    // Calculate card positions
    const positions = calculateCardPositions(
      {
        rows: layout.rows,
        cols: layout.cols,
        cardDimensions,
        spacing,
        totalWidth: layout.totalWidth,
        totalHeight: layout.totalHeight,
      },
      canvasWidth,
      canvasHeight,
      cardCount
    );

    // Debug logging for development
    if (process.env.NODE_ENV === "development") {
      console.log("🔍 New Grid Algorithm Debug:", {
        deviceType,
        cardCount,
        canvasSize: { width: canvasWidth, height: canvasHeight },
        optimalGrid: `${layout.rows}x${layout.cols}`,
        cardSize: `${layout.cardWidth}x${layout.cardHeight}px`,
        totalGridSize: `${layout.totalWidth}x${layout.totalHeight}px`,
        spacing: `${layout.gap}px`,
        aspectRatio: (layout.cols / layout.rows).toFixed(2),
        fitsInCanvas: {
          width: layout.totalWidth <= canvasWidth,
          height: layout.totalHeight <= canvasHeight,
        },
      });
    }

    return {
      rows: layout.rows,
      cols: layout.cols,
      positions,
      cardDimensions,
      totalWidth: layout.totalWidth,
      totalHeight: layout.totalHeight,
      spacing,
    };
  };

  // Calculate exact card positions with centering
  const calculateCardPositions = (
    grid: GridConfiguration,
    canvasWidth: number,
    canvasHeight: number,
    _cardCount: number
  ): CardPosition[] => {
    const positions: CardPosition[] = [];

    // Calculate starting position to center the grid
    const startX = (canvasWidth - grid.totalWidth) / 2;
    const startY = (canvasHeight - grid.totalHeight) / 2;

    // Debug logging for centering calculation
    if (process.env.NODE_ENV === "development") {
      console.log("🎯 Card Centering Debug:", {
        canvasSize: { width: canvasWidth, height: canvasHeight },
        gridTotalSize: { width: grid.totalWidth, height: grid.totalHeight },
        startPosition: { x: startX, y: startY },
        gridConfig: `${grid.rows}x${grid.cols}`,
        cardDimensions: grid.cardDimensions,
        spacing: grid.spacing,
      });
    }

    // Generate positions for each card
    for (let i = 0; i < _cardCount; i++) {
      const col = i % grid.cols;
      const row = Math.floor(i / grid.cols);

      const x =
        startX +
        col * (grid.cardDimensions.width + grid.spacing.horizontal) +
        grid.cardDimensions.width / 2;
      const y =
        startY +
        row * (grid.cardDimensions.height + grid.spacing.vertical) +
        grid.cardDimensions.height / 2;

      positions.push({
        x,
        y,
        cardId: `card-${i}`, // This will be replaced with actual card IDs
      });
    }

    return positions;
  };

  // Generate layout for specific cards
  const generateCardLayout = (
    cards: GameCard[],
    canvasWidth: number,
    canvasHeight: number,
    deviceType: "mobile" | "tablet" | "desktop" = "desktop"
  ): GridLayout => {
    const layout = calculateOptimalLayout(
      canvasWidth,
      canvasHeight,
      cards.length,
      deviceType
    );

    // Map actual card IDs to positions
    layout.positions = layout.positions.map((pos, index) => ({
      ...pos,
      cardId: cards[index]?.id || pos.cardId,
    }));

    return layout;
  };

  // Get device-specific constraints (simplified for new algorithm)
  const getDeviceConstraints = (
    deviceType: "mobile" | "tablet" | "desktop",
    _cardCount: number = 24
  ) => {
    const baseConstraints = {
      minCardSize: finalConfig.minCardSize,
      maxCardSize: finalConfig.maxCardSize,
      spacing: finalConfig.spacing,
      minPadding: 16,
    };

    switch (deviceType) {
      case "mobile":
        return {
          ...baseConstraints,
          minCardSize: Math.max(baseConstraints.minCardSize * 0.8, 45),
          maxCardSize: Math.min(baseConstraints.maxCardSize * 0.6, 110),
          spacing: Math.max(baseConstraints.spacing * 0.5, 6),
          minPadding: 6,
        };
      case "tablet":
        return {
          ...baseConstraints,
          minCardSize: Math.max(baseConstraints.minCardSize * 0.85, 50),
          maxCardSize: Math.min(baseConstraints.maxCardSize * 0.65, 120),
          spacing: Math.max(baseConstraints.spacing * 0.6, 8),
          minPadding: 8,
        };
      default: // desktop
        return baseConstraints;
    }
  };

  // Calculate optimal grid configuration (kept for backward compatibility)
  const calculateOptimalGridConfig = (
    cardCount: number,
    _deviceType: "mobile" | "tablet" | "desktop" = "desktop"
  ): { rows: number; cols: number; efficiency: number } => {
    const optimalGrid = findOptimalGrid(cardCount);
    return {
      rows: optimalGrid.rows,
      cols: optimalGrid.cols,
      efficiency: 1.0 - optimalGrid.ratio, // Convert ratio to efficiency score
    };
  };

  return {
    calculateOptimalLayout,
    generateCardLayout,
    getDeviceConstraints,
    calculateOptimalGridConfig,
  };
};
