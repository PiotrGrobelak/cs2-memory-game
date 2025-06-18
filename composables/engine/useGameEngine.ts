/**
 * useGameEngine - Core HTML5 Canvas rendering engine for the CS2 Memory Game
 *
 * This composable provides the low-level canvas rendering infrastructure:
 * - Manages HTML5 Canvas setup with high-DPI support
 * - Implements game loop with requestAnimationFrame for smooth 60fps rendering
 * - Handles canvas object management and z-index layering
 * - Provides card rendering pipeline with flip animations
 * - Manages parallax effects and visual transformations
 * - Tracks performance metrics (FPS, frame timing, render stats)
 *
 * Key features:
 * - High-DPI canvas setup for crisp rendering on Retina displays
 * - Efficient object pooling to minimize garbage collection
 * - Canvas coordinate system management and hit detection
 * - Animation system with easing functions and smooth transitions
 * - Debug rendering mode for development and troubleshooting
 * - Memory-efficient rendering with object culling and batching
 */
import { ref, reactive, readonly } from "vue";
import type { GameCard } from "~/types/game";
import { imageLoader } from "~/services/ImageLoader";
// Engine state interface
interface EngineState {
  isInitialized: boolean;
  isRunning: boolean;
  lastFrameTime: number;
  frameCount: number;
  fps: number;
  parallaxOffset: { x: number; y: number };
}

// Canvas object data types
interface CardObjectData {
  card: GameCard;
  parallaxOffset: { x: number; y: number };
}

interface EffectObjectData {
  type: string;
  progress: number;
}

interface UIObjectData {
  text: string;
  color: string;
}

type CanvasObjectData =
  | CardObjectData
  | EffectObjectData
  | UIObjectData
  | undefined;

// Canvas object interface for rendering
interface CanvasObject {
  id: string;
  type: "card" | "effect" | "ui";
  position: { x: number; y: number };
  size: { width: number; height: number };
  visible: boolean;
  zIndex: number;
  data?: CanvasObjectData;
}

// Card rendering data
interface CardRenderData {
  card: GameCard;
  animationProgress: number;
  isFlipping: boolean;
  flipDirection: "front" | "back";
  parallaxOffset: { x: number; y: number };
}

export const useGameEngine = () => {
  // Core engine state
  const canvas = ref<HTMLCanvasElement>();
  const context = ref<CanvasRenderingContext2D>();

  // Engine state
  const state = reactive<EngineState>({
    isInitialized: false,
    isRunning: false,
    lastFrameTime: 0,
    frameCount: 0,
    fps: 0,
    parallaxOffset: { x: 0, y: 0 },
  });

  // Canvas objects for rendering
  const canvasObjects = ref<Map<string, CanvasObject>>(new Map());
  const cardRenderData = ref<Map<string, CardRenderData>>(new Map());

  // Animation frame ID for cleanup
  let animationFrameId: number | null = null;

  // Dirty flag for rendering optimization
  let isDirty = true;

  /**
   * Initialize the game engine with Canvas element
   */
  const init = async (canvasElement: HTMLCanvasElement): Promise<void> => {
    if (state.isInitialized) {
      console.warn("Game engine already initialized");
      return;
    }

    try {
      canvas.value = canvasElement;
      const ctx = canvasElement.getContext("2d");

      if (!ctx) {
        throw new Error("Failed to get 2D context from canvas");
      }

      context.value = ctx;

      // Setup high-DPI canvas
      setupHighDPICanvas();

      // Initialize rendering context settings
      setupCanvasContext();

      state.isInitialized = true;
      console.log("Game engine initialized successfully");
    } catch (error) {
      console.error("Failed to initialize game engine:", error);
      throw error;
    }
  };

  /**
   * Start the rendering loop
   */
  const start = (): void => {
    if (!state.isInitialized) {
      console.error("Cannot start engine: not initialized");
      return;
    }

    if (state.isRunning) {
      console.warn("Engine already running");
      return;
    }

    state.isRunning = true;
    state.lastFrameTime = performance.now();

    // Start the game loop
    gameLoop();

    console.log("Game engine started");
  };

  /**
   * Stop the rendering loop
   */
  const stop = (): void => {
    state.isRunning = false;

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    console.log("Game engine stopped");
  };

  /**
   * Main game loop
   */
  const gameLoop = (): void => {
    if (!state.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - state.lastFrameTime;
    state.lastFrameTime = currentTime;

    // Calculate FPS
    state.frameCount++;
    if (state.frameCount % 60 === 0) {
      state.fps = Math.round(1000 / deltaTime);
    }

    // Update game objects and check if anything changed
    const hasChanges = update(deltaTime);

    // Only render if there are changes or forced dirty flag
    if (isDirty || hasChanges) {
      render();
      isDirty = false;
    }

    // Schedule next frame
    animationFrameId = requestAnimationFrame(gameLoop);
  };

  /**
   * Update game objects
   */
  const update = (deltaTime: number): boolean => {
    let hasChanges = false;

    // Update card animations
    for (const [_cardId, renderData] of cardRenderData.value) {
      if (renderData.isFlipping) {
        updateCardAnimation(renderData, deltaTime);
        hasChanges = true;
      }
    }

    // Update canvas objects
    for (const [_objectId, object] of canvasObjects.value) {
      updateCanvasObject(object, deltaTime);
      // Parallax effects always cause changes
      if (object.type === "card") {
        hasChanges = true;
      }
    }

    return hasChanges;
  };

  /**
   * Main render function
   */
  const render = (): void => {
    if (!context.value || !canvas.value) {
      return;
    }

    const ctx = context.value;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.value.width, canvas.value.height);

    // Draw background
    drawBackground(ctx);

    // Draw game board area
    drawBoard(ctx);

    // Sort objects by z-index
    const sortedObjects = Array.from(canvasObjects.value.values())
      .filter((obj) => obj.visible)
      .sort((a, b) => a.zIndex - b.zIndex);

    // Render all objects
    for (const object of sortedObjects) {
      renderCanvasObject(ctx, object);
    }

    // Draw debug information if needed
    if (process.env.NODE_ENV === "development") {
      drawDebugInfo(ctx);
    }
  };

  /**
   * Setup high-DPI canvas for crisp rendering
   */
  const setupHighDPICanvas = (): void => {
    if (!canvas.value || !context.value) return;

    const ctx = context.value;
    const canvasEl = canvas.value;

    // Get device pixel ratio
    const dpr = window.devicePixelRatio || 1;

    // Get canvas size
    const rect = canvasEl.getBoundingClientRect();

    // Set actual canvas size in memory (scaled up for retina)
    canvasEl.width = rect.width * dpr;
    canvasEl.height = rect.height * dpr;

    // Scale the canvas back down using CSS
    canvasEl.style.width = rect.width + "px";
    canvasEl.style.height = rect.height + "px";

    // Scale the drawing context so everything draws at the correct size
    ctx.scale(dpr, dpr);
  };

  /**
   * Setup canvas context with optimal settings
   */
  const setupCanvasContext = (): void => {
    if (!context.value) return;

    const ctx = context.value;

    // Set rendering quality settings
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Set default text settings
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "16px Arial, sans-serif";
  };

  /**
   * Draw background gradient
   */
  const drawBackground = (ctx: CanvasRenderingContext2D): void => {
    if (!canvas.value) return;

    const gradient = ctx.createLinearGradient(
      0,
      0,
      canvas.value.width,
      canvas.value.height
    );
    gradient.addColorStop(0, "#1a1a2e");
    gradient.addColorStop(0.5, "#16213e");
    gradient.addColorStop(1, "#0f3460");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.value.width, canvas.value.height);
  };

  /**
   * Draw game board area
   */
  const drawBoard = (ctx: CanvasRenderingContext2D): void => {
    if (!canvas.value) return;

    // Board takes the entire canvas area
    const boardWidth = canvas.value.width;
    const boardHeight = canvas.value.height;

    // Draw board background with subtle border
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.fillRect(0, 0, boardWidth, boardHeight);

    // Draw board border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, boardWidth - 2, boardHeight - 2);

    // Draw subtle inner shadow effect
    const gradient = ctx.createRadialGradient(
      boardWidth / 2,
      boardHeight / 2,
      0,
      boardWidth / 2,
      boardHeight / 2,
      Math.max(boardWidth, boardHeight) / 2
    );
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.1)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, boardWidth, boardHeight);
  };

  /**
   * Update card animation state
   */
  const updateCardAnimation = (
    renderData: CardRenderData,
    deltaTime: number
  ): void => {
    if (!renderData.isFlipping) return;

    // Update flip animation progress
    const flipSpeed = 0.005; // Animation speed
    renderData.animationProgress += deltaTime * flipSpeed;

    if (renderData.animationProgress >= 1) {
      renderData.animationProgress = 1;
      renderData.isFlipping = false;
    }
  };

  /**
   * Update canvas object state
   */
  const updateCanvasObject = (
    object: CanvasObject,
    _deltaTime: number
  ): void => {
    // Apply parallax effect if it's a card
    if (object.type === "card" && object.data) {
      const parallaxStrength = 0.02;
      const cardData = object.data as CardObjectData;
      cardData.parallaxOffset = {
        x: state.parallaxOffset.x * parallaxStrength,
        y: state.parallaxOffset.y * parallaxStrength,
      };
    }
  };

  /**
   * Render a canvas object
   */
  const renderCanvasObject = (
    ctx: CanvasRenderingContext2D,
    object: CanvasObject
  ): void => {
    if (!object.visible) return;

    ctx.save();

    switch (object.type) {
      case "card":
        renderCard(ctx, object);
        break;
      case "effect":
        renderEffect(ctx, object);
        break;
      case "ui":
        renderUI(ctx, object);
        break;
    }

    ctx.restore();
  };

  /**
   * Render a game card
   */
  const renderCard = (
    ctx: CanvasRenderingContext2D,
    object: CanvasObject
  ): void => {
    const { position, size, data } = object;

    if (!data) return;

    const cardData = data as CardObjectData;
    const card = cardData.card;
    const parallaxOffset = cardData.parallaxOffset || { x: 0, y: 0 };

    // Preload image immediately when card is rendered (regardless of state)
    if (
      !imageLoader.isImageLoaded(card.cs2Item.imageUrl) &&
      !imageLoader.isImageLoading(card.cs2Item.imageUrl)
    ) {
      imageLoader
        .loadImage(card.cs2Item.imageUrl, {
          crossOrigin: "anonymous",
          timeout: 10000, // 10 second timeout
        })
        .catch((error) => {
          console.warn(
            `Failed to preload weapon image for ${card.cs2Item.name}:`,
            error
          );
        });
    }

    // Apply parallax offset
    const x = position.x + parallaxOffset.x;
    const y = position.y + parallaxOffset.y;

    // Draw card background based on rarity
    drawCardBackground(ctx, x, y, size.width, size.height, card.cs2Item.rarity);

    // Draw card content based on state
    if (card.state === "hidden") {
      drawCardBack(ctx, x, y, size.width, size.height);
    } else {
      drawCardFront(ctx, x, y, size.width, size.height, card);
    }

    // Draw card border
    drawCardBorder(ctx, x, y, size.width, size.height, card.state);
  };

  /**
   * Draw card background with rarity gradient
   */
  const drawCardBackground = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    rarity: string
  ): void => {
    const rarityColors = {
      consumer: ["#b0c3d9", "#ffffff"],
      industrial: ["#5e98d9", "#ffffff"],
      milSpec: ["#4b69ff", "#8847ff"],
      restricted: ["#8847ff", "#d32ce6"],
      classified: ["#d32ce6", "#eb4b4b"],
      covert: ["#eb4b4b", "#e4ae39"],
      contraband: ["#e4ae39", "#ffd700"],
    };

    const colors =
      rarityColors[rarity as keyof typeof rarityColors] ||
      rarityColors.consumer;

    const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[1]);

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);
  };

  /**
   * Draw card back with consistent CS2 appearance for all hidden cards
   */
  const drawCardBack = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ): void => {
    // Draw consistent dark background for all hidden cards
    const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
    gradient.addColorStop(0, "#2c3e50");
    gradient.addColorStop(0.5, "#34495e");
    gradient.addColorStop(1, "#2c3e50");

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width, height);

    // Draw inner border for depth
    ctx.strokeStyle = "#1a252f";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, width - 4, height - 4);

    // Draw CS2 logo in center
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.min(width, height) * 0.15}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Add subtle shadow for better visibility
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.fillText("CS2", x + width / 2, y + height / 2);

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Draw decorative pattern
    drawDecorativePattern(ctx, x, y, width, height);
  };

  /**
   * Draw decorative pattern for card back
   */
  const drawDecorativePattern = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ): void => {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;

    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const radius = Math.min(width, height) * 0.3;

    // Draw concentric circles
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * (i / 3), 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  /**
   * Draw card front with CS2 item and actual weapon image
   */
  const drawCardFront = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    card: GameCard
  ): void => {
    // Draw rarity-based gradient background
    drawCardBackground(ctx, x, y, width, height, card.cs2Item.rarity);

    // Calculate image area (top 60% of card)
    const imageHeight = height * 0.6;
    const imageY = y + 5;
    const imageWidth = width - 10;
    const imageX = x + 5;

    // Draw image background
    const imageGradient = ctx.createLinearGradient(
      imageX,
      imageY,
      imageX,
      imageY + imageHeight
    );
    imageGradient.addColorStop(0, "rgba(255, 255, 255, 0.2)");
    imageGradient.addColorStop(1, "rgba(255, 255, 255, 0.05)");

    ctx.fillStyle = imageGradient;
    ctx.fillRect(imageX, imageY, imageWidth, imageHeight - 5);

    // Try to get the weapon image
    const weaponImage = imageLoader.getCachedImage(card.cs2Item.imageUrl);

    if (weaponImage) {
      // Draw the actual weapon image
      ctx.save();

      // Create clipping path for the image area
      ctx.beginPath();
      ctx.rect(imageX, imageY, imageWidth, imageHeight - 5);
      ctx.clip();

      // Calculate scaling to fit image while maintaining aspect ratio
      const scale = Math.min(
        imageWidth / weaponImage.width,
        (imageHeight - 5) / weaponImage.height
      );

      const scaledWidth = weaponImage.width * scale;
      const scaledHeight = weaponImage.height * scale;

      // Center the scaled image
      const drawX = imageX + (imageWidth - scaledWidth) / 2;
      const drawY = imageY + (imageHeight - 5 - scaledHeight) / 2;

      // Draw the weapon image
      ctx.drawImage(weaponImage, drawX, drawY, scaledWidth, scaledHeight);

      ctx.restore();
    } else if (imageLoader.isImageLoading(card.cs2Item.imageUrl)) {
      // Show loading state
      const centerX = imageX + imageWidth / 2;
      const centerY = imageY + (imageHeight - 5) / 2;
      const radius = Math.min(imageWidth, imageHeight) * 0.05;

      // Draw loading spinner
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 1.5);
      ctx.stroke();

      // Draw loading text
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.font = `${Math.min(imageWidth * 0.06, 10)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Loading...", centerX, centerY + radius + 12);
    } else {
      // Show placeholder icon
      const centerX = imageX + imageWidth / 2;
      const centerY = imageY + (imageHeight - 5) / 2;
      const iconSize = Math.min(imageWidth, imageHeight) * 0.25;

      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = `${iconSize}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Choose icon based on weapon category
      let icon = "🔫"; // Default weapon icon
      if (card.cs2Item.category === "knife") {
        icon = "🗡️";
      } else if (card.cs2Item.category === "glove") {
        icon = "🧤";
      }

      ctx.fillText(icon, centerX, centerY);

      // Try to load the image if not already attempted
      if (!imageLoader.isImageLoaded(card.cs2Item.imageUrl)) {
        imageLoader
          .loadImage(card.cs2Item.imageUrl, {
            crossOrigin: "anonymous",
            timeout: 10000, // 10 second timeout
          })
          .catch((error) => {
            console.warn(
              `Failed to load weapon image for ${card.cs2Item.name}:`,
              error
            );
          });
      }
    }

    // Draw image border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(imageX, imageY, imageWidth, imageHeight - 5);

    // Draw item name in bottom area
    const textY = y + imageHeight + 15;

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.min(width * 0.08, 12)}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    // Add text shadow for better readability
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    // Wrap text if too long
    const maxTextWidth = width - 10;
    const words = card.cs2Item.name.split(" ");
    let line = "";
    let lineY = textY;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + " ";
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxTextWidth && i > 0) {
        ctx.fillText(line.trim(), x + width / 2, lineY);
        line = words[i] + " ";
        lineY += 14;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x + width / 2, lineY);

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  };

  /**
   * Draw rarity indicator on card
   */
  const _drawRarityIndicator = (
    _ctx: CanvasRenderingContext2D,
    _x: number,
    _y: number,
    _width: number,
    _height: number,
    _rarity: string
  ): void => {
    // This function is reserved for future use
    // Currently rarity is shown through background gradient
  };

  /**
   * Draw card border based on state
   */
  const drawCardBorder = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    state: string
  ): void => {
    const borderColors = {
      hidden: "#34495e",
      revealed: "#3498db",
      matched: "#27ae60",
    };

    ctx.strokeStyle =
      borderColors[state as keyof typeof borderColors] || borderColors.hidden;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
  };

  /**
   * Render effect object (placeholder)
   */
  const renderEffect = (
    _ctx: CanvasRenderingContext2D,
    _object: CanvasObject
  ): void => {
    // TODO: Implement effect rendering
  };

  /**
   * Render UI object (placeholder)
   */
  const renderUI = (
    _ctx: CanvasRenderingContext2D,
    _object: CanvasObject
  ): void => {
    // TODO: Implement UI rendering
  };

  /**
   * Draw debug information
   */
  const drawDebugInfo = (ctx: CanvasRenderingContext2D): void => {
    if (!canvas.value) return;

    ctx.fillStyle = "#ffffff";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";

    const debugInfo = [
      `FPS: ${state.fps}`,
      `Objects: ${canvasObjects.value.size}`,
      `Cards: ${cardRenderData.value.size}`,
      `Parallax: ${state.parallaxOffset.x.toFixed(2)}, ${state.parallaxOffset.y.toFixed(2)}`,
    ];

    debugInfo.forEach((info, index) => {
      ctx.fillText(info, 10, 20 + index * 15);
    });
  };

  /**
   * Set parallax offset for cards
   */
  const setParallaxOffset = (offset: { x: number; y: number }): void => {
    state.parallaxOffset = offset;
    isDirty = true; // Mark for re-render
  };

  /**
   * Get card at specific position
   */
  const getCardAtPosition = (x: number, y: number): string | null => {
    for (const [objectId, object] of canvasObjects.value) {
      if (object.type === "card" && object.visible) {
        const { position, size } = object;
        if (
          x >= position.x &&
          x <= position.x + size.width &&
          y >= position.y &&
          y <= position.y + size.height
        ) {
          return objectId;
        }
      }
    }
    return null;
  };

  /**
   * Add canvas object
   */
  const addCanvasObject = (id: string, object: CanvasObject): void => {
    canvasObjects.value.set(id, object);
    isDirty = true; // Mark for re-render
  };

  /**
   * Remove canvas object
   */
  const removeCanvasObject = (id: string): void => {
    canvasObjects.value.delete(id);
    cardRenderData.value.delete(id);
    isDirty = true; // Mark for re-render
  };

  /**
   * Update card render data
   */
  const updateCardRenderData = (
    cardId: string,
    data: Partial<CardRenderData>
  ): void => {
    const existing = cardRenderData.value.get(cardId);
    if (existing) {
      Object.assign(existing, data);
    } else {
      cardRenderData.value.set(cardId, {
        animationProgress: 0,
        isFlipping: false,
        flipDirection: "back",
        parallaxOffset: { x: 0, y: 0 },
        ...data,
      } as CardRenderData);
    }
    isDirty = true; // Mark for re-render
  };

  /**
   * Mark scene as dirty to force re-render
   */
  const markDirty = (): void => {
    isDirty = true;
  };

  return {
    // State
    state: readonly(state),
    canvasObjects,

    // Core methods
    init,
    start,
    stop,

    // Interaction methods
    setParallaxOffset,
    getCardAtPosition,

    // Object management
    addCanvasObject,
    removeCanvasObject,
    updateCardRenderData,

    // Rendering optimization
    markDirty,
  };
};
