import { ref, reactive } from "vue";
import type { GameCard, ItemRarity } from "~/types/game";

// Card rendering configuration
interface CardRenderConfig {
  flipDuration: number;
  parallaxStrength: number;
  borderRadius: number;
  shadowBlur: number;
  gradientAngle: number;
}

// Card visual state
interface CardVisualState {
  flipProgress: number;
  isFlipping: boolean;
  flipDirection: "front" | "back";
  parallaxOffset: { x: number; y: number };
  scale: number;
  rotation: number;
  opacity: number;
}

// Rarity gradient configuration
interface RarityGradient {
  colors: [string, string];
  glowColor: string;
  borderColor: string;
  animation?: {
    type: "pulse" | "shift" | "glow";
    duration: number;
  };
}

// Pre-computed gradient cache
interface GradientCache {
  [key: string]: CanvasGradient;
}

// Card animation easing functions
type EasingFunction = (t: number) => number;

export const useCardRenderer = () => {
  // Rendering configuration
  const config = reactive<CardRenderConfig>({
    flipDuration: 300, // ms
    parallaxStrength: 0.02,
    borderRadius: 8,
    shadowBlur: 4,
    gradientAngle: 45, // degrees
  });

  // Gradient cache for performance
  const gradientCache = ref<Map<string, GradientCache>>(new Map());

  // Canvas context cache for reuse
  const contextCache = ref<Map<string, CanvasRenderingContext2D>>(new Map());

  // Rarity gradient definitions
  const rarityGradients: Record<ItemRarity, RarityGradient> = {
    consumer: {
      colors: ["#b0c3d9", "#ffffff"],
      glowColor: "#b0c3d9",
      borderColor: "#7f8c8d",
    },
    industrial: {
      colors: ["#5e98d9", "#ffffff"],
      glowColor: "#3498db",
      borderColor: "#2980b9",
    },
    milSpec: {
      colors: ["#4b69ff", "#8847ff"],
      glowColor: "#6c5ce7",
      borderColor: "#5f3dc4",
      animation: {
        type: "pulse",
        duration: 2000,
      },
    },
    restricted: {
      colors: ["#8847ff", "#d32ce6"],
      glowColor: "#e84393",
      borderColor: "#d63031",
      animation: {
        type: "shift",
        duration: 3000,
      },
    },
    classified: {
      colors: ["#d32ce6", "#eb4b4b"],
      glowColor: "#fd79a8",
      borderColor: "#e84393",
      animation: {
        type: "glow",
        duration: 1500,
      },
    },
    covert: {
      colors: ["#eb4b4b", "#e4ae39"],
      glowColor: "#fdcb6e",
      borderColor: "#e17055",
      animation: {
        type: "shift",
        duration: 2500,
      },
    },
    contraband: {
      colors: ["#e4ae39", "#ffd700"],
      glowColor: "#fdcb6e",
      borderColor: "#f39c12",
      animation: {
        type: "glow",
        duration: 1000,
      },
    },
  };

  // Animation easing functions
  const easingFunctions: Record<string, EasingFunction> = {
    easeInOut: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
    easeIn: (t: number) => t * t * t,
    bounce: (t: number) => {
      if (t < 1 / 2.75) {
        return 7.5625 * t * t;
      } else if (t < 2 / 2.75) {
        return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
      } else if (t < 2.5 / 2.75) {
        return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
      } else {
        return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
      }
    },
  };

  // Performance metrics
  const renderStats = reactive({
    cardsRendered: 0,
    averageRenderTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    frameTime: 0,
  });

  /**
   * Render a single card with all visual effects
   */
  const renderCard = (
    ctx: CanvasRenderingContext2D,
    card: GameCard,
    position: { x: number; y: number },
    size: { width: number; height: number },
    visualState: CardVisualState,
    timestamp: number = performance.now()
  ): void => {
    const startTime = performance.now();

    ctx.save();

    // Apply transforms
    applyCardTransforms(ctx, position, size, visualState);

    // Render based on card state
    if (
      card.state === "hidden" ||
      (visualState.isFlipping && visualState.flipProgress < 0.5)
    ) {
      renderCardBack(ctx, size, card.cs2Item.rarity, timestamp);
    } else {
      renderCardFront(ctx, card, size, timestamp);
    }

    ctx.restore();

    // Update performance stats
    const renderTime = performance.now() - startTime;
    updateRenderStats(renderTime);
  };

  /**
   * Apply card transforms (scale, rotation, position)
   */
  const applyCardTransforms = (
    ctx: CanvasRenderingContext2D,
    position: { x: number; y: number },
    size: { width: number; height: number },
    visualState: CardVisualState
  ): void => {
    const centerX = position.x + size.width / 2;
    const centerY = position.y + size.height / 2;

    // Translate to card center
    ctx.translate(centerX, centerY);

    // Apply parallax offset
    ctx.translate(visualState.parallaxOffset.x, visualState.parallaxOffset.y);

    // Apply scale
    ctx.scale(visualState.scale, visualState.scale);

    // Apply rotation
    ctx.rotate((visualState.rotation * Math.PI) / 180);

    // Apply flip transformation
    if (visualState.isFlipping) {
      const flipScale = Math.cos((visualState.flipProgress * Math.PI) / 2);
      ctx.scale(Math.abs(flipScale), 1);
    }

    // Set opacity
    ctx.globalAlpha = visualState.opacity;

    // Translate back to top-left for drawing
    ctx.translate(-size.width / 2, -size.height / 2);
  };

  /**
   * Render card back with CS2 branding
   */
  const renderCardBack = (
    ctx: CanvasRenderingContext2D,
    size: { width: number; height: number },
    rarity: ItemRarity,
    timestamp: number
  ): void => {
    // Draw background with animated rarity gradient
    drawRarityBackground(ctx, 0, 0, size.width, size.height, rarity, timestamp);

    // Draw card back pattern
    drawCardBackPattern(ctx, size);

    // Draw CS2 logo
    drawCS2Logo(ctx, size);

    // Draw border
    drawCardBorder(ctx, 0, 0, size.width, size.height, rarity, false);
  };

  /**
   * Render card front with CS2 item
   */
  const renderCardFront = (
    ctx: CanvasRenderingContext2D,
    card: GameCard,
    size: { width: number; height: number },
    timestamp: number
  ): void => {
    // Draw background
    drawRarityBackground(
      ctx,
      0,
      0,
      size.width,
      size.height,
      card.cs2Item.rarity,
      timestamp
    );

    // Draw item content area
    drawItemContent(ctx, card, size);

    // Draw item name
    drawItemName(ctx, card.cs2Item.name, size);

    // Draw rarity indicator
    drawRarityIndicator(ctx, card.cs2Item.rarity, size);

    // Draw border (highlighted for revealed/matched)
    const isHighlighted = card.state === "revealed" || card.state === "matched";
    drawCardBorder(
      ctx,
      0,
      0,
      size.width,
      size.height,
      card.cs2Item.rarity,
      isHighlighted
    );
  };

  /**
   * Draw rarity-based background gradient
   */
  const drawRarityBackground = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    rarity: ItemRarity,
    timestamp: number
  ): void => {
    const rarityConfig = rarityGradients[rarity];

    // Get or create gradient
    const gradientKey = `${rarity}-${width}-${height}`;
    let gradient = getGradientFromCache(ctx, gradientKey);

    if (!gradient) {
      gradient = createRarityGradient(ctx, x, y, width, height, rarity);
      cacheGradient(gradientKey, gradient);
    }

    // Apply animation if configured
    if (rarityConfig.animation) {
      const animationOffset = calculateAnimationOffset(
        timestamp,
        rarityConfig.animation
      );
      ctx.save();
      ctx.globalAlpha = 0.8 + 0.2 * animationOffset;
    }

    ctx.fillStyle = gradient;
    drawRoundedRect(ctx, x, y, width, height, config.borderRadius);
    ctx.fill();

    if (rarityConfig.animation) {
      ctx.restore();
    }
  };

  /**
   * Create rarity gradient
   */
  const createRarityGradient = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    rarity: ItemRarity
  ): CanvasGradient => {
    const rarityConfig = rarityGradients[rarity];
    const angle = (config.gradientAngle * Math.PI) / 180;

    const endX = x + Math.cos(angle) * width;
    const endY = y + Math.sin(angle) * height;

    const gradient = ctx.createLinearGradient(x, y, endX, endY);
    gradient.addColorStop(0, rarityConfig.colors[0]);
    gradient.addColorStop(1, rarityConfig.colors[1]);

    return gradient;
  };

  /**
   * Draw card back pattern
   */
  const drawCardBackPattern = (
    ctx: CanvasRenderingContext2D,
    size: { width: number; height: number }
  ): void => {
    const patternSize = Math.min(size.width, size.height) * 0.6;
    const centerX = size.width / 2;
    const centerY = size.height / 2;

    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";

    // Draw geometric pattern
    for (let i = 0; i < 3; i++) {
      const radius = (patternSize / 3) * (i + 1);
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  /**
   * Draw CS2 logo
   */
  const drawCS2Logo = (
    ctx: CanvasRenderingContext2D,
    size: { width: number; height: number }
  ): void => {
    const centerX = size.width / 2;
    const centerY = size.height / 2;

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.min(size.width, size.height) * 0.15}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Add shadow for better visibility
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.fillText("CS2", centerX, centerY);

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  };

  /**
   * Draw item content area
   */
  const drawItemContent = (
    ctx: CanvasRenderingContext2D,
    card: GameCard,
    size: { width: number; height: number }
  ): void => {
    const contentMargin = 8;
    const contentWidth = size.width - contentMargin * 2;
    const contentHeight = size.height * 0.6;
    const contentX = contentMargin;
    const contentY = contentMargin;

    // Draw content background
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    drawRoundedRect(ctx, contentX, contentY, contentWidth, contentHeight, 4);
    ctx.fill();

    // For now, draw placeholder item image
    // TODO: Replace with actual CS2 item image rendering
    ctx.fillStyle = "#34495e";
    const imageSize = Math.min(contentWidth, contentHeight) * 0.8;
    const imageX = contentX + (contentWidth - imageSize) / 2;
    const imageY = contentY + (contentHeight - imageSize) / 2;

    drawRoundedRect(ctx, imageX, imageY, imageSize, imageSize, 4);
    ctx.fill();

    // Draw placeholder item icon
    ctx.fillStyle = "#ffffff";
    ctx.font = `${imageSize * 0.3}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🔫", imageX + imageSize / 2, imageY + imageSize / 2);
  };

  /**
   * Draw item name
   */
  const drawItemName = (
    ctx: CanvasRenderingContext2D,
    itemName: string,
    size: { width: number; height: number }
  ): void => {
    const textY = size.height - 20;
    const maxWidth = size.width - 16;

    ctx.fillStyle = "#ffffff";
    ctx.font = `${Math.min(12, size.width * 0.08)}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Add shadow for better readability
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 2;

    // Truncate text if too long
    const truncatedName = truncateText(ctx, itemName, maxWidth);
    ctx.fillText(truncatedName, size.width / 2, textY);

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  };

  /**
   * Draw rarity indicator
   */
  const drawRarityIndicator = (
    ctx: CanvasRenderingContext2D,
    rarity: ItemRarity,
    size: { width: number; height: number }
  ): void => {
    const indicatorSize = 8;
    const indicatorX = size.width - indicatorSize - 4;
    const indicatorY = 4;

    const rarityConfig = rarityGradients[rarity];

    ctx.fillStyle = rarityConfig.glowColor;
    ctx.beginPath();
    ctx.arc(
      indicatorX + indicatorSize / 2,
      indicatorY + indicatorSize / 2,
      indicatorSize / 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
  };

  /**
   * Draw card border with rarity colors
   */
  const drawCardBorder = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    rarity: ItemRarity,
    highlighted: boolean
  ): void => {
    const rarityConfig = rarityGradients[rarity];

    ctx.strokeStyle = highlighted
      ? rarityConfig.glowColor
      : rarityConfig.borderColor;
    ctx.lineWidth = highlighted ? 3 : 2;

    if (highlighted) {
      ctx.shadowColor = rarityConfig.glowColor;
      ctx.shadowBlur = 8;
    }

    drawRoundedRect(ctx, x, y, width, height, config.borderRadius);
    ctx.stroke();

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  };

  /**
   * Draw rounded rectangle
   */
  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  /**
   * Calculate animation offset for rarity effects
   */
  const calculateAnimationOffset = (
    timestamp: number,
    animation: { type: string; duration: number }
  ): number => {
    const progress = (timestamp % animation.duration) / animation.duration;

    switch (animation.type) {
      case "pulse":
        return (Math.sin(progress * Math.PI * 2) + 1) / 2;
      case "glow":
        return Math.abs(Math.sin(progress * Math.PI));
      case "shift":
        return easingFunctions.easeInOut(progress);
      default:
        return 0;
    }
  };

  /**
   * Create card visual state with animation
   */
  const createCardVisualState = (
    flipProgress: number = 0,
    isFlipping: boolean = false,
    parallaxOffset: { x: number; y: number } = { x: 0, y: 0 }
  ): CardVisualState => ({
    flipProgress,
    isFlipping,
    flipDirection: flipProgress < 0.5 ? "back" : "front",
    parallaxOffset,
    scale: 1,
    rotation: 0,
    opacity: 1,
  });

  /**
   * Update flip animation
   */
  const updateFlipAnimation = (
    visualState: CardVisualState,
    deltaTime: number,
    easingType: string = "easeInOut"
  ): void => {
    if (!visualState.isFlipping) return;

    const progress = Math.min(
      1,
      visualState.flipProgress + deltaTime / config.flipDuration
    );
    visualState.flipProgress = easingFunctions[easingType](progress);

    if (visualState.flipProgress >= 1) {
      visualState.isFlipping = false;
      visualState.flipProgress = 1;
    }
  };

  /**
   * Start flip animation
   */
  const startFlipAnimation = (visualState: CardVisualState): void => {
    visualState.isFlipping = true;
    visualState.flipProgress = 0;
  };

  /**
   * Truncate text to fit width
   */
  const truncateText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string => {
    const metrics = ctx.measureText(text);
    if (metrics.width <= maxWidth) return text;

    let truncated = text;
    while (
      ctx.measureText(truncated + "...").width > maxWidth &&
      truncated.length > 0
    ) {
      truncated = truncated.slice(0, -1);
    }

    return truncated + "...";
  };

  /**
   * Gradient caching utilities
   */
  const getGradientFromCache = (
    ctx: CanvasRenderingContext2D,
    key: string
  ): CanvasGradient | null => {
    const canvasKey = getCanvasKey(ctx);
    const canvasCache = gradientCache.value.get(canvasKey);

    if (canvasCache && canvasCache[key]) {
      renderStats.cacheHits++;
      return canvasCache[key];
    }

    renderStats.cacheMisses++;
    return null;
  };

  const cacheGradient = (_key: string, _gradient: CanvasGradient): void => {
    // Implementation would require canvas context identification
    // For now, skip caching to avoid complexity
  };

  const getCanvasKey = (_ctx: CanvasRenderingContext2D): string => {
    // Simple canvas identification - in real implementation would use WeakMap
    return "default";
  };

  /**
   * Update render statistics
   */
  const updateRenderStats = (renderTime: number): void => {
    renderStats.cardsRendered++;
    renderStats.averageRenderTime =
      (renderStats.averageRenderTime + renderTime) / 2;
    renderStats.frameTime = renderTime;
  };

  /**
   * Clear render cache
   */
  const clearCache = (): void => {
    gradientCache.value.clear();
    contextCache.value.clear();
    console.log("Card renderer cache cleared");
  };

  /**
   * Get rendering statistics
   */
  const getRenderStats = () => ({
    ...renderStats,
    cacheSize: gradientCache.value.size,
    cacheEfficiency:
      renderStats.cacheHits /
        (renderStats.cacheHits + renderStats.cacheMisses) || 0,
  });

  return {
    // Configuration
    config,
    rarityGradients,

    // Core rendering
    renderCard,
    renderCardBack,
    renderCardFront,

    // Visual state management
    createCardVisualState,
    updateFlipAnimation,
    startFlipAnimation,

    // Utility functions
    drawRoundedRect,
    truncateText,

    // Performance and caching
    clearCache,
    getRenderStats,
    renderStats,

    // Animation easing
    easingFunctions,
  };
};
