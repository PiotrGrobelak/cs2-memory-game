import type { DeviceOrientation, DeviceType } from "../device";

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

export interface OrientationGridConfig {
  containerWidth: number;
  containerHeight: number;
  cardCount: number;
  constraints: GridConstraints;
  metadata: {
    deviceType: DeviceType;
    deviceOrientation: DeviceOrientation;
  };
}

export interface GridConstraints {
  minCardSize: number;
  maxCardSize: number;
  minSpacing: number;
  maxSpacing: number;
  padding: number;
}

export interface OrientationGridResult {
  cols: number;
  rows: number;
  cardWidth: number;
  cardHeight: number;
  spacingX: number;
  spacingY: number;
}

const ORIENTATION_THRESHOLDS = {
  PORTRAIT_MAX: 0.8,
  SQUARE_MIN: 0.8,
  SQUARE_MAX: 1.2,
  LANDSCAPE_MIN: 1.2,
} as const;

export type ScreenOrientation = "portrait" | "square" | "landscape";

/**
 * Pure functions for orientation-based grid calculations
 */

/**
 * Calculate aspect ratio from dimensions
 */
const calculateAspectRatio = (width: number, height: number): number =>
  width / height;

/**
 * Determine screen orientation based on aspect ratio
 */
const determineOrientation = (aspectRatio: number): ScreenOrientation => {
  if (aspectRatio < ORIENTATION_THRESHOLDS.PORTRAIT_MAX) return "portrait";
  if (aspectRatio <= ORIENTATION_THRESHOLDS.SQUARE_MAX) return "square";
  return "landscape";
};

/**
 * Calculate available space after padding
 */
const calculateAvailableSpace = (
  containerWidth: number,
  containerHeight: number,
  padding: number
) => ({
  width: containerWidth - padding * 2,
  height: containerHeight - padding * 2,
});

/**
 * Landscape-optimized grid strategy
 * Prefers more columns (horizontal layout)
 */
const landscapeStrategy = (
  cardCount: number,
  availableSpace: { width: number; height: number },
  constraints: GridConstraints
): OrientationGridResult => {
  const { width, height } = availableSpace;

  // Prefer more columns in landscape - optimize for better centering
  const aspectRatio = width / height;
  const idealCols = Math.ceil(Math.sqrt(cardCount * aspectRatio));

  // Try different column configurations to find the best fit
  let bestCols = idealCols;
  let bestEfficiency = 0;

  for (
    let testCols = Math.max(1, idealCols - 1);
    testCols <= idealCols + 1;
    testCols++
  ) {
    const testRows = Math.ceil(cardCount / testCols);
    const efficiency = cardCount / (testCols * testRows);
    if (efficiency > bestEfficiency) {
      bestEfficiency = efficiency;
      bestCols = testCols;
    }
  }

  const cols = bestCols;
  const rows = Math.ceil(cardCount / cols);

  const cardWidth = Math.min(
    constraints.maxCardSize,
    Math.max(
      constraints.minCardSize,
      (width - (cols - 1) * constraints.minSpacing) / cols
    )
  );

  const cardHeight = Math.min(
    constraints.maxCardSize,
    Math.max(
      constraints.minCardSize,
      (height - (rows - 1) * constraints.minSpacing) / rows
    )
  );

  // Adapt card proportions - slightly wider in landscape
  const adaptedCardWidth = cardWidth;
  const adaptedCardHeight = Math.min(cardHeight, cardWidth * 0.9);

  const spacingX =
    cols > 1
      ? Math.max(
          constraints.minSpacing,
          Math.min(
            constraints.maxSpacing,
            (width - cols * adaptedCardWidth) / (cols - 1)
          )
        )
      : 0;
  const spacingY =
    rows > 1
      ? Math.max(
          constraints.minSpacing,
          Math.min(
            constraints.maxSpacing,
            (height - rows * adaptedCardHeight) / (rows - 1)
          )
        )
      : 0;

  return {
    cols,
    rows,
    cardWidth: adaptedCardWidth,
    cardHeight: adaptedCardHeight,
    spacingX,
    spacingY,
  };
};

/**
 * Portrait-optimized grid strategy
 * Prefers more rows (vertical layout)
 */
const portraitStrategy = (
  cardCount: number,
  availableSpace: { width: number; height: number },
  constraints: GridConstraints
): OrientationGridResult => {
  const { width, height } = availableSpace;

  // Prefer more rows in portrait - optimize for better centering
  const aspectRatio = height / width;
  const idealRows = Math.ceil(Math.sqrt(cardCount * aspectRatio));

  // Try different row configurations to find the best fit
  let bestRows = idealRows;
  let bestEfficiency = 0;

  for (
    let testRows = Math.max(1, idealRows - 1);
    testRows <= idealRows + 1;
    testRows++
  ) {
    const testCols = Math.ceil(cardCount / testRows);
    const efficiency = cardCount / (testCols * testRows);
    if (efficiency > bestEfficiency) {
      bestEfficiency = efficiency;
      bestRows = testRows;
    }
  }

  const rows = bestRows;
  const cols = Math.ceil(cardCount / rows);

  const cardWidth = Math.min(
    constraints.maxCardSize,
    Math.max(
      constraints.minCardSize,
      (width - (cols - 1) * constraints.minSpacing) / cols
    )
  );

  const cardHeight = Math.min(
    constraints.maxCardSize,
    Math.max(
      constraints.minCardSize,
      (height - (rows - 1) * constraints.minSpacing) / rows
    )
  );

  // Adapt card proportions - slightly taller in portrait
  const adaptedCardHeight = cardHeight;
  const adaptedCardWidth = Math.min(cardWidth, cardHeight * 0.9);

  const spacingX =
    cols > 1
      ? Math.max(
          constraints.minSpacing,
          Math.min(
            constraints.maxSpacing,
            (width - cols * adaptedCardWidth) / (cols - 1)
          )
        )
      : 0;
  const spacingY =
    rows > 1
      ? Math.max(
          constraints.minSpacing,
          Math.min(
            constraints.maxSpacing,
            (height - rows * adaptedCardHeight) / (rows - 1)
          )
        )
      : 0;

  return {
    cols,
    rows,
    cardWidth: adaptedCardWidth,
    cardHeight: adaptedCardHeight,
    spacingX,
    spacingY,
  };
};

/**
 * Square-optimized grid strategy
 * Prefers symmetric layouts
 */
const squareStrategy = (
  cardCount: number,
  availableSpace: { width: number; height: number },
  constraints: GridConstraints
): OrientationGridResult => {
  const { width, height } = availableSpace;

  // Prefer symmetric layouts for square screens
  const idealSide = Math.ceil(Math.sqrt(cardCount));
  const cols = idealSide;
  const rows = Math.ceil(cardCount / cols);

  const cardSize = Math.min(
    constraints.maxCardSize,
    Math.max(
      constraints.minCardSize,
      Math.min(
        (width - (cols - 1) * constraints.minSpacing) / cols,
        (height - (rows - 1) * constraints.minSpacing) / rows
      )
    )
  );

  // Square cards for square screens
  const cardWidth = cardSize;
  const cardHeight = cardSize;

  const spacingX =
    cols > 1
      ? Math.max(
          constraints.minSpacing,
          Math.min(
            constraints.maxSpacing,
            (width - cols * cardWidth) / (cols - 1)
          )
        )
      : 0;
  const spacingY =
    rows > 1
      ? Math.max(
          constraints.minSpacing,
          Math.min(
            constraints.maxSpacing,
            (height - rows * cardHeight) / (rows - 1)
          )
        )
      : 0;

  return {
    cols,
    rows,
    cardWidth,
    cardHeight,
    spacingX,
    spacingY,
  };
};

/**
 * Strategy selector based on orientation
 */
const selectStrategy = (
  orientation: ScreenOrientation
): ((
  cardCount: number,
  availableSpace: { width: number; height: number },
  constraints: GridConstraints
) => OrientationGridResult) => {
  const strategies = {
    landscape: landscapeStrategy,
    portrait: portraitStrategy,
    square: squareStrategy,
  };

  return strategies[orientation] || squareStrategy;
};

/**
 * Calculate card position within the grid
 */
const calculateCardPosition = (
  index: number,
  gridResult: OrientationGridResult,
  availableSpace: { width: number; height: number },
  padding: number,
  cardCount: number
): GridPosition => {
  const { cols, rows, cardWidth, cardHeight, spacingX, spacingY } = gridResult;
  const { width, height } = availableSpace;

  const col = index % cols;
  const row = Math.floor(index / cols);

  // Center the grid in available space
  const totalGridWidth = cols * cardWidth + (cols - 1) * spacingX;
  const totalGridHeight = rows * cardHeight + (rows - 1) * spacingY;

  const offsetX = (width - totalGridWidth) / 2;
  const offsetY = (height - totalGridHeight) / 2;

  // Handle centering of incomplete last row
  const isLastRow = row === rows - 1;
  const cardsInLastRow = cardCount - (rows - 1) * cols;
  const isIncompleteLastRow = isLastRow && cardsInLastRow < cols;

  let x: number;
  if (isIncompleteLastRow) {
    // Center the incomplete row
    const lastRowWidth =
      cardsInLastRow * cardWidth + (cardsInLastRow - 1) * spacingX;
    const lastRowOffsetX = (totalGridWidth - lastRowWidth) / 2;
    x = offsetX + lastRowOffsetX + col * (cardWidth + spacingX);
  } else {
    // Normal row positioning
    x = offsetX + col * (cardWidth + spacingX);
  }

  const y = offsetY + row * (cardHeight + spacingY);

  return {
    x: Math.round(x + cardWidth / 2 + padding),
    y: Math.round(y + cardHeight / 2 + padding),
    width: Math.round(cardWidth),
    height: Math.round(cardHeight),
  };
};

/**
 * Main orientation grid composable
 */
export const useOrientationGrid = (config: OrientationGridConfig) => {
  /**
   * Calculate optimal grid layout based on orientation
   */
  const calculateLayout = (): GridLayout | null => {
    const { containerWidth, containerHeight, cardCount, constraints } = config;

    if (containerWidth === 0 || containerHeight === 0) {
      console.warn(
        "Container dimensions not available. Cannot generate layout."
      );
      return null;
    }

    // Determine orientation and strategy
    const aspectRatio = calculateAspectRatio(containerWidth, containerHeight);
    const orientation = determineOrientation(aspectRatio);
    const strategy = selectStrategy(orientation);

    // Calculate available space
    const availableSpace = calculateAvailableSpace(
      containerWidth,
      containerHeight,
      constraints.padding
    );

    // Get grid parameters from strategy
    const gridResult = strategy(cardCount, availableSpace, constraints);

    // Generate positions for all cards
    const positions: GridPosition[] = [];
    for (let i = 0; i < cardCount; i++) {
      positions.push(
        calculateCardPosition(
          i,
          gridResult,
          availableSpace,
          constraints.padding,
          cardCount
        )
      );
    }

    // Calculate efficiency
    const efficiency = cardCount / (gridResult.cols * gridResult.rows);

    return {
      positions,
      cardDimensions: {
        width: Math.round(gridResult.cardWidth),
        height: Math.round(gridResult.cardHeight),
      },
      cols: gridResult.cols,
      rows: gridResult.rows,
      totalGridWidth:
        gridResult.cols * gridResult.cardWidth +
        (gridResult.cols - 1) * gridResult.spacingX,
      totalGridHeight:
        gridResult.rows * gridResult.cardHeight +
        (gridResult.rows - 1) * gridResult.spacingY,
      efficiency,
      deviceType: config.metadata.deviceType,
      orientation: config.metadata.deviceOrientation,
    };
  };

  /**
   * Validate layout quality
   */
  const validateLayout = (layout: GridLayout) => {
    const warnings: string[] = [];
    const { constraints } = config;

    // Check card size constraints
    if (layout.cardDimensions.width < constraints.minCardSize) {
      warnings.push(
        `Cards are smaller than minimum size (${constraints.minCardSize}px)`
      );
    }

    if (layout.cardDimensions.width > constraints.maxCardSize) {
      warnings.push(`Cards exceed maximum size (${constraints.maxCardSize}px)`);
    }

    // Check grid efficiency
    if (layout.efficiency < 0.75) {
      warnings.push(
        `Grid efficiency is low (${Math.round(layout.efficiency * 100)}%) - consider adjusting card count`
      );
    }

    return {
      warnings,
      isValid: warnings.length === 0,
      efficiency: layout.efficiency,
      orientation: layout.orientation,
    };
  };

  /**
   * Compare two layouts for transition planning
   */
  const compareLayouts = (layout1: GridLayout, layout2: GridLayout) => {
    return {
      dimensionsChanged:
        layout1.cardDimensions.width !== layout2.cardDimensions.width ||
        layout1.cardDimensions.height !== layout2.cardDimensions.height,
      gridChanged:
        layout1.cols !== layout2.cols || layout1.rows !== layout2.rows,
      orientationChanged: layout1.orientation !== layout2.orientation,
      efficiencyDelta: layout2.efficiency - layout1.efficiency,
    };
  };

  /**
   * Calculate transition data for animations
   */
  const calculateTransitionData = (from: GridLayout, to: GridLayout) => {
    const comparison = compareLayouts(from, to);

    return {
      ...comparison,
      recommendedDuration: comparison.orientationChanged ? 400 : 200,
      easing: comparison.gridChanged ? "easeInOut" : "linear",
      staggerDelay: Math.min(
        20,
        200 / Math.max(from.positions.length, to.positions.length)
      ),
    };
  };

  return {
    calculateLayout,
    validateLayout,
    compareLayouts,
    calculateTransitionData,
    // Utility functions for external use
    determineOrientation: (width: number, height: number) =>
      determineOrientation(calculateAspectRatio(width, height)),
  };
};
