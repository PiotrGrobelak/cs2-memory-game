import { describe, it, expect } from "vitest";
import {
  useOrientationMapper,
  getConstraintsForDevice,
  getEnhancedConstraints,
  mapDeviceOrientationToScreen,
  getOptimalGridConfig,
  validateDeviceConfig,
  getPerformanceOptimizedConstraints,
} from "../useOrientationMapper";
import type { DeviceCapabilities } from "../../device/useDeviceDetection";

describe("useOrientationMapper", () => {
  const mockCapabilities: DeviceCapabilities = {
    pixelRatio: 2,
    isTouchDevice: true,
    hasHover: false,
    hasMouseSupport: false,
    prefersReducedMotion: false,
    userAgent: "test-agent",
    os: undefined,
    browser: undefined,
  };

  describe("getConstraintsForDevice", () => {
    it("should return correct constraints for mobile devices", () => {
      const constraints = getConstraintsForDevice("mobile");

      expect(constraints).toEqual({
        minCardSize: 40,
        maxCardSize: 120,
        minSpacing: 6,
        maxSpacing: 16,
        padding: 12,
      });
    });

    it("should return correct constraints for tablet devices", () => {
      const constraints = getConstraintsForDevice("tablet");

      expect(constraints).toEqual({
        minCardSize: 70,
        maxCardSize: 140,
        minSpacing: 10,
        maxSpacing: 20,
        padding: 16,
      });
    });

    it("should return correct constraints for desktop devices", () => {
      const constraints = getConstraintsForDevice("desktop");

      expect(constraints).toEqual({
        minCardSize: 40,
        maxCardSize: 180,
        minSpacing: 16,
        maxSpacing: 32,
        padding: 24,
      });
    });
  });

  describe("getEnhancedConstraints", () => {
    it("should apply performance adjustments for high pixel ratio devices", () => {
      const highPixelRatioCapabilities: DeviceCapabilities = {
        ...mockCapabilities,
        pixelRatio: 3,
        isTouchDevice: false, // Disable touch multiplier to isolate performance effect
      };

      const baseConstraints = getConstraintsForDevice("mobile");
      const enhanced = getEnhancedConstraints(
        "mobile",
        highPixelRatioCapabilities,
        "portrait"
      );

      // Should reduce sizes for high pixel ratio (performance optimization)
      // Performance multiplier is 0.9 for pixelRatio > 2
      expect(enhanced.minCardSize).toBeLessThan(baseConstraints.minCardSize);
      expect(enhanced.maxCardSize).toBeLessThan(baseConstraints.maxCardSize);
    });

    it("should apply touch device adjustments", () => {
      const touchCapabilities: DeviceCapabilities = {
        ...mockCapabilities,
        pixelRatio: 1,
        isTouchDevice: true,
      };

      const baseConstraints = getConstraintsForDevice("mobile");
      const enhanced = getEnhancedConstraints(
        "mobile",
        touchCapabilities,
        "portrait"
      );

      // Should increase sizes for touch devices (better usability)
      expect(enhanced.minCardSize).toBeGreaterThanOrEqual(
        baseConstraints.minCardSize
      );
      expect(enhanced.maxCardSize).toBeGreaterThanOrEqual(
        baseConstraints.maxCardSize
      );
    });

    it("should apply landscape orientation adjustments", () => {
      const enhanced = getEnhancedConstraints(
        "desktop",
        mockCapabilities,
        "landscape"
      );
      const base = getConstraintsForDevice("desktop");

      // Landscape should allow larger cards and more spacing
      expect(enhanced.maxCardSize).toBeGreaterThanOrEqual(base.maxCardSize);
    });

    it("should apply square orientation adjustments", () => {
      const enhanced = getEnhancedConstraints(
        "desktop",
        mockCapabilities,
        "square"
      );
      const base = getConstraintsForDevice("desktop");

      // Square should slightly increase card sizes for symmetry
      expect(enhanced.minCardSize).toBeGreaterThanOrEqual(base.minCardSize);
    });
  });

  describe("mapDeviceOrientationToScreen", () => {
    it("should map based on aspect ratio primarily", () => {
      // Very portrait aspect ratio should always return portrait
      expect(mapDeviceOrientationToScreen("landscape", 0.5)).toBe("portrait");

      // Very landscape aspect ratio should always return landscape
      expect(mapDeviceOrientationToScreen("portrait", 2.0)).toBe("landscape");

      // Aspect ratio of 1.0 falls in the 0.8-1.2 range, so it uses device orientation
      expect(mapDeviceOrientationToScreen("landscape", 1.0)).toBe("landscape");

      // For square to be returned, we need an unknown device orientation
      // @ts-expect-error Testing fallback to square for unknown orientation
      expect(mapDeviceOrientationToScreen("unknown", 1.0)).toBe("square");
    });

    it("should use device orientation as fallback for borderline aspect ratios", () => {
      // Borderline aspect ratio (0.9) should use device orientation
      expect(mapDeviceOrientationToScreen("portrait", 0.9)).toBe("portrait");
      expect(mapDeviceOrientationToScreen("landscape", 0.9)).toBe("landscape");

      // Another borderline case (1.1)
      expect(mapDeviceOrientationToScreen("portrait", 1.1)).toBe("portrait");
      expect(mapDeviceOrientationToScreen("landscape", 1.1)).toBe("landscape");
    });

    it("should default to square for unknown orientations", () => {
      // @ts-expect-error Testing invalid orientation
      expect(mapDeviceOrientationToScreen("unknown", 1.0)).toBe("square");
    });
  });

  describe("getOptimalGridConfig", () => {
    it("should return complete configuration object", () => {
      const config = getOptimalGridConfig(
        "desktop",
        "landscape",
        800,
        600,
        12,
        mockCapabilities
      );

      expect(config).toHaveProperty("containerWidth", 800);
      expect(config).toHaveProperty("containerHeight", 600);
      expect(config).toHaveProperty("cardCount", 12);
      expect(config).toHaveProperty("constraints");
      expect(config).toHaveProperty("metadata");

      expect(config.metadata).toHaveProperty("deviceType", "desktop");
      expect(config.metadata).toHaveProperty("deviceOrientation", "landscape");
      expect(config.metadata).toHaveProperty("screenOrientation");
      expect(config.metadata).toHaveProperty("aspectRatio");
      expect(config.metadata).toHaveProperty("capabilities");
    });

    it("should calculate correct aspect ratio and screen orientation", () => {
      const config = getOptimalGridConfig(
        "mobile",
        "portrait",
        400,
        800,
        8,
        mockCapabilities
      );

      expect(config.metadata.aspectRatio).toBe(0.5);
      expect(config.metadata.screenOrientation).toBe("portrait");
    });
  });

  describe("validateDeviceConfig", () => {
    it("should pass validation for valid configuration", () => {
      const validation = validateDeviceConfig("desktop", 800, 600, 12);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.recommendedCardCount).toBeGreaterThan(0);
    });

    it("should detect invalid container dimensions", () => {
      const validation = validateDeviceConfig("desktop", 0, 600, 12);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain("Invalid container dimensions");
    });

    it("should detect invalid card count", () => {
      const validation1 = validateDeviceConfig("desktop", 800, 600, 0);
      const validation2 = validateDeviceConfig("desktop", 800, 600, 150);

      expect(validation1.isValid).toBe(false);
      expect(validation2.isValid).toBe(false);
      expect(validation1.errors[0]).toContain(
        "Card count must be between 1 and 100"
      );
      expect(validation2.errors[0]).toContain(
        "Card count must be between 1 and 100"
      );
    });

    it("should warn about problematic mobile configurations", () => {
      const validation = validateDeviceConfig("mobile", 1000, 200, 12); // Very wide

      expect(
        validation.warnings.some((warning) =>
          warning.includes("Very wide aspect ratio")
        )
      ).toBe(true);
    });

    it("should warn about small desktop containers", () => {
      const validation = validateDeviceConfig("desktop", 500, 400, 12);

      expect(
        validation.warnings.some((warning) =>
          warning.includes("Small container width for desktop")
        )
      ).toBe(true);
    });

    it("should detect impossible card configurations", () => {
      const validation = validateDeviceConfig("mobile", 100, 100, 50); // Too many cards

      expect(validation.isValid).toBe(false);
      expect(
        validation.errors.some((error) => error.includes("Cannot fit"))
      ).toBe(true);
    });
  });

  describe("getPerformanceOptimizedConstraints", () => {
    it("should reduce constraints for high pixel ratio devices", () => {
      const baseConstraints = getConstraintsForDevice("desktop");
      const highPixelCapabilities: DeviceCapabilities = {
        ...mockCapabilities,
        pixelRatio: 3,
      };

      const optimized = getPerformanceOptimizedConstraints(
        baseConstraints,
        highPixelCapabilities,
        12
      );

      expect(optimized.minCardSize).toBeLessThan(baseConstraints.minCardSize);
      expect(optimized.maxCardSize).toBeLessThan(baseConstraints.maxCardSize);
    });

    it("should reduce constraints for high card counts", () => {
      const baseConstraints = getConstraintsForDevice("desktop");
      const lowPixelCapabilities: DeviceCapabilities = {
        ...mockCapabilities,
        pixelRatio: 1,
      };

      const optimized = getPerformanceOptimizedConstraints(
        baseConstraints,
        lowPixelCapabilities,
        30 // High card count
      );

      expect(optimized.minCardSize).toBeLessThan(baseConstraints.minCardSize);
      expect(optimized.maxCardSize).toBeLessThan(baseConstraints.maxCardSize);
    });

    it("should not reduce constraints for optimal conditions", () => {
      const baseConstraints = getConstraintsForDevice("desktop");
      const optimalCapabilities: DeviceCapabilities = {
        ...mockCapabilities,
        pixelRatio: 1,
      };

      const optimized = getPerformanceOptimizedConstraints(
        baseConstraints,
        optimalCapabilities,
        10 // Low card count
      );

      expect(optimized.minCardSize).toBe(baseConstraints.minCardSize);
      expect(optimized.maxCardSize).toBe(baseConstraints.maxCardSize);
    });
  });
});
