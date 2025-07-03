import { describe, it, expect } from "vitest";
import { useOrientationGrid } from "../useOrientationGrid";
import type {
  OrientationGridConfig,
  GridConstraints,
} from "../useOrientationGrid";

describe("useOrientationGrid", () => {
  const defaultConstraints: GridConstraints = {
    minCardSize: 40,
    maxCardSize: 120,
    minSpacing: 8,
    maxSpacing: 16,
    padding: 12,
  };

  const createConfig = (
    width: number,
    height: number,
    cardCount: number,
    constraints = defaultConstraints
  ): OrientationGridConfig => ({
    containerWidth: width,
    containerHeight: height,
    cardCount,
    constraints,
    metadata: {
      deviceType: "desktop",
      deviceOrientation: "landscape",
    },
  });

  describe("orientation detection and strategies", () => {
    it("should detect portrait orientation and prefer vertical layouts", () => {
      const config = createConfig(400, 800, 12); // 0.5 aspect ratio (portrait)
      const { calculateLayout, determineOrientation } =
        useOrientationGrid(config);

      const orientation = determineOrientation(400, 800);
      expect(orientation).toBe("portrait");

      const layout = calculateLayout();
      expect(layout).toBeTruthy();
      expect(layout!.rows).toBeGreaterThanOrEqual(layout!.cols); // More rows in portrait
    });

    it("should detect landscape orientation and prefer horizontal layouts", () => {
      const config = createConfig(800, 400, 12); // 2.0 aspect ratio (landscape)
      const { calculateLayout, determineOrientation } =
        useOrientationGrid(config);

      const orientation = determineOrientation(800, 400);
      expect(orientation).toBe("landscape");

      const layout = calculateLayout();
      expect(layout).toBeTruthy();
      expect(layout!.cols).toBeGreaterThanOrEqual(layout!.rows); // More cols in landscape
    });

    it("should detect square orientation and prefer symmetric layouts", () => {
      const config = createConfig(600, 600, 16); // 1.0 aspect ratio (square)
      const { calculateLayout, determineOrientation } =
        useOrientationGrid(config);

      const orientation = determineOrientation(600, 600);
      expect(orientation).toBe("square");

      const layout = calculateLayout();
      expect(layout).toBeTruthy();
      expect(Math.abs(layout!.cols - layout!.rows)).toBeLessThanOrEqual(1); // Nearly symmetric
    });
  });

  describe("layout calculations", () => {
    it("should calculate valid layout with proper grid dimensions", () => {
      const config = createConfig(800, 600, 12);
      const { calculateLayout } = useOrientationGrid(config);

      const layout = calculateLayout();

      expect(layout).toBeTruthy();
      expect(layout!.cols * layout!.rows).toBeGreaterThanOrEqual(12);
      expect(layout!.positions).toHaveLength(12);
      expect(layout!.cardDimensions.width).toBeGreaterThan(0);
      expect(layout!.cardDimensions.height).toBeGreaterThan(0);
      expect(layout!.efficiency).toBeGreaterThan(0);
      expect(layout!.efficiency).toBeLessThanOrEqual(1);
    });

    it("should respect minimum and maximum card size constraints", () => {
      const strictConstraints: GridConstraints = {
        minCardSize: 60,
        maxCardSize: 80,
        minSpacing: 10,
        maxSpacing: 20,
        padding: 15,
      };

      const config = createConfig(800, 600, 6, strictConstraints);
      const { calculateLayout } = useOrientationGrid(config);

      const layout = calculateLayout();

      expect(layout).toBeTruthy();
      expect(layout!.cardDimensions.width).toBeGreaterThanOrEqual(
        strictConstraints.minCardSize
      );
      expect(layout!.cardDimensions.width).toBeLessThanOrEqual(
        strictConstraints.maxCardSize
      );
      expect(layout!.cardDimensions.height).toBeGreaterThanOrEqual(
        strictConstraints.minCardSize
      );
      expect(layout!.cardDimensions.height).toBeLessThanOrEqual(
        strictConstraints.maxCardSize
      );
    });

    it("should handle zero container dimensions gracefully", () => {
      const config = createConfig(0, 0, 12);
      const { calculateLayout } = useOrientationGrid(config);

      const layout = calculateLayout();
      expect(layout).toBeNull();
    });

    it("should center card positions correctly", () => {
      const config = createConfig(800, 600, 4); // 2x2 grid
      const { calculateLayout } = useOrientationGrid(config);

      const layout = calculateLayout();

      expect(layout).toBeTruthy();

      // All positions should be positive and within container bounds
      layout!.positions.forEach((pos) => {
        expect(pos.x).toBeGreaterThan(0);
        expect(pos.y).toBeGreaterThan(0);
        expect(pos.x + pos.width / 2).toBeLessThanOrEqual(800);
        expect(pos.y + pos.height / 2).toBeLessThanOrEqual(600);
      });
    });
  });

  describe("layout validation", () => {
    it("should validate layout quality and provide warnings", () => {
      const config = createConfig(800, 600, 12);
      const { calculateLayout, validateLayout } = useOrientationGrid(config);

      const layout = calculateLayout()!;
      const validation = validateLayout(layout);

      expect(validation).toHaveProperty("warnings");
      expect(validation).toHaveProperty("isValid");
      expect(validation).toHaveProperty("efficiency");
      expect(validation).toHaveProperty("orientation");
      expect(typeof validation.isValid).toBe("boolean");
      expect(Array.isArray(validation.warnings)).toBe(true);
    });

    it("should warn about low efficiency layouts", () => {
      const config = createConfig(800, 600, 7); // Odd number causing low efficiency
      const { calculateLayout, validateLayout } = useOrientationGrid(config);

      const layout = calculateLayout()!;
      const validation = validateLayout(layout);

      if (layout.efficiency < 0.75) {
        expect(
          validation.warnings.some((warning) => warning.includes("efficiency"))
        ).toBe(true);
      }
    });
  });

  describe("layout comparison and transitions", () => {
    it("should compare layouts and detect differences", () => {
      const config1 = createConfig(800, 600, 12);
      const config2 = createConfig(600, 800, 12); // Different orientation

      const { calculateLayout: calc1, compareLayouts } =
        useOrientationGrid(config1);
      const { calculateLayout: calc2 } = useOrientationGrid(config2);

      const layout1 = calc1()!;
      const layout2 = calc2()!;

      const comparison = compareLayouts(layout1, layout2);

      expect(comparison).toHaveProperty("dimensionsChanged");
      expect(comparison).toHaveProperty("gridChanged");
      expect(comparison).toHaveProperty("orientationChanged");
      expect(comparison).toHaveProperty("efficiencyDelta");
      expect(typeof comparison.orientationChanged).toBe("boolean");
    });

    it("should calculate transition data for animations", () => {
      const config1 = createConfig(800, 600, 12);
      const config2 = createConfig(600, 800, 12);

      const { calculateLayout: calc1, calculateTransitionData } =
        useOrientationGrid(config1);
      const { calculateLayout: calc2 } = useOrientationGrid(config2);

      const layout1 = calc1()!;
      const layout2 = calc2()!;

      const transition = calculateTransitionData(layout1, layout2);

      expect(transition).toHaveProperty("recommendedDuration");
      expect(transition).toHaveProperty("easing");
      expect(transition).toHaveProperty("staggerDelay");
      expect(typeof transition.recommendedDuration).toBe("number");
      expect(transition.recommendedDuration).toBeGreaterThan(0);
    });
  });
});
