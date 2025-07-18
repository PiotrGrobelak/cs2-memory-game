import type { DeviceType, DeviceOrientation } from "../device";
import type { DeviceCapabilities } from "../device/useDeviceDetection";
import type { GridConstraints, ScreenOrientation } from "./useOrientationGrid";

/**
 * Map device type to orientation-based constraints
 */
export const getConstraintsForDevice = (
  deviceType: DeviceType,
): GridConstraints => {
  const constraintMap: Record<DeviceType, GridConstraints> = {
    mobile: {
      minCardSize: 40,
      maxCardSize: 120,
      minSpacing: 6,
      maxSpacing: 16,
      padding: 12,
    },
    tablet: {
      minCardSize: 70,
      maxCardSize: 140,
      minSpacing: 10,
      maxSpacing: 20,
      padding: 16,
    },
    desktop: {
      minCardSize: 40,
      maxCardSize: 180,
      minSpacing: 16,
      maxSpacing: 32,
      padding: 24,
    },
  };

  return constraintMap[deviceType];
};

/**
 * Enhanced constraints with performance considerations
 */
export const getEnhancedConstraints = (
  deviceType: DeviceType,
  capabilities: DeviceCapabilities,
  screenOrientation: ScreenOrientation,
): GridConstraints => {
  const baseConstraints = getConstraintsForDevice(deviceType);

  // Adjust constraints based on device capabilities
  const performanceMultiplier = capabilities.pixelRatio > 2 ? 0.9 : 1.0;
  const touchDeviceMultiplier = capabilities.isTouchDevice ? 1.1 : 1.0;

  // Orientation-specific adjustments
  const orientationAdjustments = {
    portrait: {
      minCardSizeMultiplier: 1.0,
      maxCardSizeMultiplier: 1.0,
      spacingMultiplier: 1.0,
      paddingMultiplier: 1.0,
    },
    landscape: {
      minCardSizeMultiplier: 0.95,
      maxCardSizeMultiplier: 1.1,
      spacingMultiplier: 1.1,
      paddingMultiplier: 0.8,
    },
    square: {
      minCardSizeMultiplier: 1.05,
      maxCardSizeMultiplier: 1.05,
      spacingMultiplier: 1.0,
      paddingMultiplier: 1.0,
    },
  };

  const adjustments = orientationAdjustments[screenOrientation];

  return {
    minCardSize: Math.round(
      baseConstraints.minCardSize *
        adjustments.minCardSizeMultiplier *
        performanceMultiplier *
        touchDeviceMultiplier,
    ),
    maxCardSize: Math.round(
      baseConstraints.maxCardSize *
        adjustments.maxCardSizeMultiplier *
        performanceMultiplier *
        touchDeviceMultiplier,
    ),
    minSpacing: Math.round(
      baseConstraints.minSpacing *
        adjustments.spacingMultiplier *
        touchDeviceMultiplier,
    ),
    maxSpacing: Math.round(
      baseConstraints.maxSpacing *
        adjustments.spacingMultiplier *
        touchDeviceMultiplier,
    ),
    padding: Math.round(
      baseConstraints.padding * adjustments.paddingMultiplier,
    ),
  };
};

/**
 * Map legacy device orientation to screen orientation
 */
export const mapDeviceOrientationToScreen = (
  deviceOrientation: DeviceOrientation,
  aspectRatio: number,
): ScreenOrientation => {
  // First, check aspect ratio for more accurate orientation detection
  if (aspectRatio < 0.8) return "portrait";
  if (aspectRatio > 1.2) return "landscape";

  // For aspect ratios between 0.8-1.2, use device orientation as fallback
  if (deviceOrientation === "portrait") return "portrait";
  if (deviceOrientation === "landscape") return "landscape";

  // Default to square for unknown orientations
  return "square";
};

/**
 * Determine optimal grid configuration based on device and screen properties
 */
export const getOptimalGridConfig = (
  deviceType: DeviceType,
  deviceOrientation: DeviceOrientation,
  containerWidth: number,
  containerHeight: number,
  cardCount: number,
  capabilities: DeviceCapabilities,
) => {
  const aspectRatio = containerWidth / containerHeight;
  const screenOrientation = mapDeviceOrientationToScreen(
    deviceOrientation,
    aspectRatio,
  );
  const constraints = getEnhancedConstraints(
    deviceType,
    capabilities,
    screenOrientation,
  );

  return {
    containerWidth,
    containerHeight,
    cardCount,
    constraints,
    metadata: {
      deviceType,
      deviceOrientation,
      screenOrientation,
      aspectRatio,
      capabilities,
    },
  };
};

/**
 * Validate device configuration for grid generation
 */
export const validateDeviceConfig = (
  deviceType: DeviceType,
  containerWidth: number,
  containerHeight: number,
  cardCount: number,
) => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation
  if (containerWidth <= 0 || containerHeight <= 0) {
    errors.push("Invalid container dimensions");
  }

  if (cardCount <= 0 || cardCount > 100) {
    errors.push("Card count must be between 1 and 100");
  }

  // Device-specific warnings
  const constraints = getConstraintsForDevice(deviceType);
  const aspectRatio = containerWidth / containerHeight;

  if (deviceType === "mobile" && aspectRatio > 2.5) {
    warnings.push(
      "Very wide aspect ratio on mobile device may cause layout issues",
    );
  }

  if (deviceType === "desktop" && containerWidth < 800) {
    warnings.push("Small container width for desktop device");
  }

  // Check if minimum card size is achievable
  const maxCardsPerRow = Math.floor(containerWidth / constraints.minCardSize);
  const maxCardsPerCol = Math.floor(containerHeight / constraints.minCardSize);

  if (maxCardsPerRow * maxCardsPerCol < cardCount) {
    errors.push(
      `Cannot fit ${cardCount} cards with minimum size ${constraints.minCardSize}px in container ${containerWidth}x${containerHeight}`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    recommendedCardCount: Math.floor(maxCardsPerRow * maxCardsPerCol * 0.8),
  };
};

/**
 * Performance-aware constraint adjustment
 */
export const getPerformanceOptimizedConstraints = (
  baseConstraints: GridConstraints,
  capabilities: DeviceCapabilities,
  cardCount: number,
): GridConstraints => {
  // Reduce constraints for high card counts on low-performance devices
  const performanceFactor = capabilities.pixelRatio > 2 ? 0.9 : 1.0;
  const cardCountFactor = cardCount > 20 ? 0.95 : 1.0;
  const combinedFactor = performanceFactor * cardCountFactor;

  return {
    minCardSize: Math.round(baseConstraints.minCardSize * combinedFactor),
    maxCardSize: Math.round(baseConstraints.maxCardSize * combinedFactor),
    minSpacing: Math.round(baseConstraints.minSpacing * combinedFactor),
    maxSpacing: Math.round(baseConstraints.maxSpacing * combinedFactor),
    padding: Math.round(baseConstraints.padding * combinedFactor),
  };
};

/**
 * Create orientation mapper composable
 */
export const useOrientationMapper = () => {
  return {
    getConstraintsForDevice,
    getEnhancedConstraints,
    mapDeviceOrientationToScreen,
    getOptimalGridConfig,
    validateDeviceConfig,
    getPerformanceOptimizedConstraints,
  };
};
