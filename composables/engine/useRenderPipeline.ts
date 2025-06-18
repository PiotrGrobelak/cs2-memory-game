/**
 * useRenderPipeline - Advanced rendering pipeline for memory game canvas
 *
 * This composable provides efficient rendering system:
 * - Batched rendering for optimal performance
 * - Z-index management and layering system
 * - Object culling (renders only visible elements)
 * - Animation and transition management
 * - Texture cache management for performance
 * - Smart dirty region tracking
 *
 * Key features:
 * - High-performance batch rendering
 * - Layered rendering with z-index support
 * - Animation state management
 * - Memory efficient texture caching
 * - Viewport culling for large canvases
 * - Debug rendering mode for development
 */
import { ref, reactive, readonly } from "vue";
import type { GameCard } from "~/types/game";
import { useCardRenderer } from "~/composables/engine/useCardRenderer";

// Render object types
type RenderObjectType = "card" | "background" | "effect" | "ui" | "debug";

// Animation states
type AnimationState = "idle" | "flipping" | "revealing" | "hiding" | "matching";

// Render object interface
interface RenderObject {
  id: string;
  type: RenderObjectType;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  visible: boolean;
  opacity: number;
  rotation: number;
  scale: { x: number; y: number };
  animationState: AnimationState;
  animationProgress: number;
  data?: unknown; // Type-specific data
}

// Card render data
interface CardRenderData {
  card: GameCard;
  isFlipping: boolean;
  flipDirection: "front" | "back";
  hoverIntensity: number;
  matchGlow: number;
}

// Background render data
interface BackgroundRenderData {
  pattern: string;
  color: string;
  opacity: number;
}

// Effect render data
interface EffectRenderData {
  type: "particles" | "glow" | "ripple";
  intensity: number;
  color: string;
  radius: number;
}

// Render pipeline state
interface RenderPipelineState {
  isInitialized: boolean;
  isRendering: boolean;
  lastRenderTime: number;
  renderCount: number;
  objectCount: number;
  batchCount: number;
  culledObjects: number;
}

// Render layer configuration
interface RenderLayer {
  name: string;
  zIndexRange: [number, number];
  objects: Map<string, RenderObject>;
  isDirty: boolean;
}

// Animation configuration
interface AnimationConfig {
  duration: number;
  easing: "linear" | "easeIn" | "easeOut" | "easeInOut";
  delay: number;
}

// Default animations
const ANIMATION_CONFIGS: Record<AnimationState, AnimationConfig> = {
  idle: { duration: 0, easing: "linear", delay: 0 },
  flipping: { duration: 600, easing: "easeInOut", delay: 0 },
  revealing: { duration: 300, easing: "easeOut", delay: 0 },
  hiding: { duration: 300, easing: "easeIn", delay: 0 },
  matching: { duration: 800, easing: "easeOut", delay: 100 },
};

// Render layers (ordered by z-index)
const RENDER_LAYERS: Record<string, [number, number]> = {
  background: [0, 99],
  cards: [100, 199],
  effects: [200, 299],
  ui: [300, 399],
  debug: [400, 499],
};

export const useRenderPipeline = () => {
  // Canvas context reference
  const canvasContext = ref<CanvasRenderingContext2D>();

  // Initialize the card renderer
  const cardRenderer = useCardRenderer();

  // Pipeline state
  const state = reactive<RenderPipelineState>({
    isInitialized: false,
    isRendering: false,
    lastRenderTime: 0,
    renderCount: 0,
    objectCount: 0,
    batchCount: 0,
    culledObjects: 0,
  });

  // Render layers
  const layers = reactive<Map<string, RenderLayer>>(new Map());

  // Animation timers
  const animations = reactive<Map<string, number>>(new Map());

  // Texture cache for performance
  const textureCache = new Map<string, HTMLImageElement | HTMLCanvasElement>();

  // Viewport for culling
  const viewport = ref({ x: 0, y: 0, width: 0, height: 0 });

  // Debug mode
  const debugMode = ref(false);

  // Dirty flag for full re-render
  const isFullyDirty = ref(true);

  /**
   * Initialize render pipeline with canvas context
   */
  const initialize = (context: CanvasRenderingContext2D): void => {
    if (state.isInitialized) {
      console.warn("Render pipeline already initialized");
      return;
    }

    canvasContext.value = context;

    // Initialize render layers
    initializeLayers();

    // Setup viewport
    updateViewport(context.canvas.width, context.canvas.height);

    state.isInitialized = true;
    console.log("Render pipeline initialized", {
      layers: layers.size,
      viewport: viewport.value,
    });
  };

  /**
   * Initialize render layers
   */
  const initializeLayers = (): void => {
    for (const [name, zIndexRange] of Object.entries(RENDER_LAYERS)) {
      layers.set(name, {
        name,
        zIndexRange,
        objects: new Map(),
        isDirty: false,
      });
    }
  };

  /**
   * Update viewport size for culling
   */
  const updateViewport = (width: number, height: number): void => {
    viewport.value = { x: 0, y: 0, width, height };
  };

  /**
   * Add render object to appropriate layer
   */
  const addRenderObject = (object: RenderObject): void => {
    const layer = findLayerForObject(object);
    if (layer) {
      layer.objects.set(object.id, object);
      layer.isDirty = true;
      state.objectCount++;

      console.log(
        `➕ Added render object ${object.id} (type: ${object.type}) to layer ${layer.name}, total objects: ${state.objectCount}`
      );

      // Special logging for cards
      if (object.type === "card") {
        const cardData = object.data as CardRenderData;
        console.log(`🃏 Card added:`, {
          id: object.id,
          state: cardData?.card?.state,
          position: object.position,
          visible: object.visible,
        });
      }
    } else {
      console.warn(
        `❌ No suitable layer found for object ${object.id} with zIndex ${object.zIndex}`
      );
    }
  };

  /**
   * Remove render object
   */
  const removeRenderObject = (objectId: string): void => {
    for (const layer of layers.values()) {
      if (layer.objects.has(objectId)) {
        layer.objects.delete(objectId);
        layer.isDirty = true;
        state.objectCount--;

        console.log(
          `Removed render object ${objectId} from layer ${layer.name}`
        );
        break;
      }
    }
  };

  /**
   * Update render object
   */
  const updateRenderObject = (
    objectId: string,
    updates: Partial<RenderObject>
  ): void => {
    let updated = false;
    for (const layer of layers.values()) {
      const object = layer.objects.get(objectId);
      if (object) {
        // Log the update for debugging
        console.log(`🔄 Updating render object ${objectId}:`, updates);

        Object.assign(object, updates);
        layer.isDirty = true;
        updated = true;

        console.log(
          `✅ Updated object ${objectId}, layer ${layer.name} marked dirty`
        );
        break;
      }
    }

    if (!updated) {
      console.warn(
        `❌ Failed to update render object ${objectId} - object not found`
      );
      return;
    }

    // Auto-trigger render only for important objects (cards, effects), not for background/parallax
    // Background updates happen frequently with mouse movement and should be handled by the main render loop
    const isBackgroundObject =
      objectId === "background" || objectId.startsWith("bg_");

    if (!state.isRendering && !isBackgroundObject) {
      console.log(`🎨 Auto-triggering render after updating ${objectId}`);
      state.isRendering = true;
      requestAnimationFrame(() => {
        render();
        state.isRendering = false;
      });
    }
  };

  /**
   * Find appropriate layer for render object based on z-index
   */
  const findLayerForObject = (object: RenderObject): RenderLayer | null => {
    for (const layer of layers.values()) {
      const [min, max] = layer.zIndexRange;
      if (object.zIndex >= min && object.zIndex <= max) {
        return layer;
      }
    }
    return null;
  };

  /**
   * Start animation for object
   */
  const startAnimation = (
    objectId: string,
    animationState: AnimationState,
    onComplete?: () => void
  ): void => {
    const config = ANIMATION_CONFIGS[animationState];
    const startTime = performance.now() + config.delay;

    // Update object animation state
    updateRenderObject(objectId, {
      animationState,
      animationProgress: 0,
    });

    // Store animation timer
    animations.set(objectId, startTime);

    console.log(
      `Started animation ${animationState} for object ${objectId}`,
      config
    );

    // Schedule completion callback if provided
    if (onComplete && config.duration > 0) {
      setTimeout(onComplete, config.duration + config.delay);
    }
  };

  /**
   * Update animations
   */
  const updateAnimations = (currentTime: number): boolean => {
    let hasChanges = false;

    for (const [objectId, startTime] of animations.entries()) {
      const object = findObjectById(objectId);
      if (!object) {
        animations.delete(objectId);
        continue;
      }

      const config = ANIMATION_CONFIGS[object.animationState];
      const elapsed = currentTime - startTime;

      if (elapsed < 0) {
        // Animation hasn't started yet (delay)
        continue;
      }

      if (elapsed >= config.duration) {
        // Animation complete
        object.animationProgress = 1;
        object.animationState = "idle";
        animations.delete(objectId);
        hasChanges = true;
      } else {
        // Animation in progress
        const progress = elapsed / config.duration;
        object.animationProgress = applyEasing(progress, config.easing);
        hasChanges = true;
      }

      // Mark layer as dirty
      const layer = findLayerForObject(object);
      if (layer) {
        layer.isDirty = true;
      }
    }

    return hasChanges;
  };

  /**
   * Apply easing function to animation progress
   */
  const applyEasing = (
    progress: number,
    easing: AnimationConfig["easing"]
  ): number => {
    switch (easing) {
      case "linear":
        return progress;
      case "easeIn":
        return progress * progress;
      case "easeOut":
        return 1 - Math.pow(1 - progress, 2);
      case "easeInOut":
        return progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      default:
        return progress;
    }
  };

  /**
   * Find object by ID across all layers
   */
  const findObjectById = (objectId: string): RenderObject | null => {
    for (const layer of layers.values()) {
      const object = layer.objects.get(objectId);
      if (object) return object;
    }
    return null;
  };

  /**
   * Perform viewport culling
   */
  const cullObjects = (objects: RenderObject[]): RenderObject[] => {
    const { x: vx, y: vy, width: vw, height: vh } = viewport.value;
    const culled: RenderObject[] = [];

    for (const object of objects) {
      if (!object.visible) continue;

      const { x: ox, y: oy } = object.position;
      const { width: ow, height: oh } = object.size;

      // Simple AABB intersection test
      if (ox + ow >= vx && ox <= vx + vw && oy + oh >= vy && oy <= vy + vh) {
        culled.push(object);
      }
    }

    state.culledObjects = objects.length - culled.length;
    return culled;
  };

  /**
   * Render all layers
   */
  const render = (): void => {
    if (!canvasContext.value) {
      console.warn("🚫 Render called but no canvas context!");
      return;
    }

    const ctx = canvasContext.value;
    const currentTime = performance.now();

    // Update animations
    const animationsChanged = updateAnimations(currentTime);

    // Check if any layer needs re-rendering
    const needsRender =
      isFullyDirty.value ||
      animationsChanged ||
      Array.from(layers.values()).some((layer) => layer.isDirty);

    if (!needsRender) {
      return;
    }

    console.log("🎨 RENDER CYCLE", {
      layers: layers.size,
      totalObjects: state.objectCount,
      isFullyDirty: isFullyDirty.value,
    });

    // Clear canvas if fully dirty
    if (isFullyDirty.value) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    // Render layers in order
    let batchCount = 0;
    let totalObjectsRendered = 0;
    for (const layer of layers.values()) {
      if (layer.isDirty || isFullyDirty.value) {
        console.log(`📂 Layer: ${layer.name}, objects: ${layer.objects.size}`);
        const rendered = renderLayer(ctx, layer);
        batchCount += rendered;
        totalObjectsRendered += layer.objects.size;
        layer.isDirty = false;
      }
    }

    console.log(
      `✅ RENDER DONE - batches: ${batchCount}, objects: ${totalObjectsRendered}`
    );

    // Update state
    state.lastRenderTime = currentTime;
    state.renderCount++;
    state.batchCount = batchCount;
    isFullyDirty.value = false;

    // Render debug info if enabled
    if (debugMode.value) {
      renderDebugInfo(ctx);
    }
  };

  /**
   * Render single layer
   */
  const renderLayer = (
    ctx: CanvasRenderingContext2D,
    layer: RenderLayer
  ): number => {
    const objects = Array.from(layer.objects.values());

    // Sort by z-index within layer
    objects.sort((a, b) => a.zIndex - b.zIndex);

    // Perform culling
    const visibleObjects = cullObjects(objects);

    // Render objects
    let batchCount = 0;
    for (const object of visibleObjects) {
      renderObject(ctx, object);
      batchCount++;
    }

    return batchCount;
  };

  /**
   * Render single object
   */
  const renderObject = (
    ctx: CanvasRenderingContext2D,
    object: RenderObject
  ): void => {
    const { position, size, opacity, rotation, scale } = object;

    // Save context state
    ctx.save();

    // Apply transformations for most objects, but handle cards specially
    if (object.type === "card") {
      // For cards, just apply opacity and let the card renderer handle positioning
      ctx.globalAlpha = opacity;
      renderCard(ctx, object);
    } else {
      // For other objects, apply full transforms
      ctx.globalAlpha = opacity;
      ctx.translate(position.x + size.width / 2, position.y + size.height / 2);

      if (rotation !== 0) {
        ctx.rotate(rotation);
      }

      if (scale.x !== 1 || scale.y !== 1) {
        ctx.scale(scale.x, scale.y);
      }

      // Render based on object type
      switch (object.type) {
        case "background":
          renderBackground(ctx, object);
          break;
        case "effect":
          renderEffect(ctx, object);
          break;
        case "ui":
          renderUI(ctx, object);
          break;
        case "debug":
          renderDebugObject(ctx, object);
          break;
      }
    }

    // Restore context state
    ctx.restore();
  };

  /**
   * Render card object
   */
  const renderCard = (
    ctx: CanvasRenderingContext2D,
    object: RenderObject
  ): void => {
    const data = object.data as CardRenderData;
    if (!data) {
      console.warn("No card data found for object:", object.id);
      return;
    }

    console.log("🎮 Rendering card:", object.id, {
      cardState: data.card.state,
      isFlipping: data.isFlipping,
      flipDirection: data.flipDirection,
      position: object.position,
      size: object.size,
      visible: object.visible,
      opacity: object.opacity,
    });

    // Create visual state for the card renderer
    const visualState = cardRenderer.createCardVisualState(
      object.animationProgress,
      data.isFlipping,
      { x: 0, y: 0 } // No parallax offset for individual cards
    );

    // Override the visual state properties with render pipeline data
    visualState.scale = object.scale.x; // Use the same scale for both x and y
    visualState.opacity = object.opacity;
    visualState.rotation = object.rotation;
    visualState.flipProgress = object.animationProgress;
    visualState.isFlipping = data.isFlipping;
    visualState.flipDirection = data.flipDirection;

    // Calculate absolute position (the card renderer expects absolute coordinates)
    const { width, height } = object.size;
    const absolutePosition = {
      x: object.position.x,
      y: object.position.y,
    };

    console.log("🎨 Card render params:", {
      cardId: object.id,
      cardState: data.card.state,
      absolutePosition,
      size: { width, height },
      visualState: {
        isFlipping: visualState.isFlipping,
        flipProgress: visualState.flipProgress,
        flipDirection: visualState.flipDirection,
        scale: visualState.scale,
        opacity: visualState.opacity,
      },
    });

    // Use the sophisticated CS2 card renderer
    cardRenderer.renderCard(
      ctx,
      data.card,
      absolutePosition,
      { width, height },
      visualState,
      performance.now()
    );

    console.log("✅ Card rendered:", object.id);
  };

  /**
   * Render background object
   */
  const renderBackground = (
    ctx: CanvasRenderingContext2D,
    object: RenderObject
  ): void => {
    const data = object.data as BackgroundRenderData;
    if (!data) return;

    const { width, height } = object.size;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    ctx.fillStyle = data.color;
    ctx.fillRect(-halfWidth, -halfHeight, width, height);
  };

  /**
   * Render effect object
   */
  const renderEffect = (
    ctx: CanvasRenderingContext2D,
    object: RenderObject
  ): void => {
    const data = object.data as EffectRenderData;
    if (!data) return;

    switch (data.type) {
      case "glow":
        renderGlowEffect(ctx, object, data);
        break;
      case "particles":
        renderParticleEffect(ctx, object, data);
        break;
      case "ripple":
        renderRippleEffect(ctx, object, data);
        break;
    }
  };

  /**
   * Render UI object (placeholder)
   */
  const renderUI = (
    ctx: CanvasRenderingContext2D,
    object: RenderObject
  ): void => {
    // UI rendering will be implemented later
    console.log("UI rendering not implemented", object.id);
  };

  /**
   * Render debug object
   */
  const renderDebugObject = (
    ctx: CanvasRenderingContext2D,
    object: RenderObject
  ): void => {
    const { width, height } = object.size;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // Draw debug outline
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = 1;
    ctx.strokeRect(-halfWidth, -halfHeight, width, height);

    // Draw debug info
    ctx.fillStyle = "#ff0000";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(object.id, 0, 0);
  };

  /**
   * Render glow effect
   */
  const renderGlowEffect = (
    ctx: CanvasRenderingContext2D,
    object: RenderObject,
    data: EffectRenderData
  ): void => {
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, data.radius);
    gradient.addColorStop(0, data.color);
    gradient.addColorStop(1, "transparent");

    ctx.fillStyle = gradient;
    ctx.fillRect(-data.radius, -data.radius, data.radius * 2, data.radius * 2);
  };

  /**
   * Render particle effect (placeholder)
   */
  const renderParticleEffect = (
    ctx: CanvasRenderingContext2D,
    object: RenderObject,
    data: EffectRenderData
  ): void => {
    // Particle effect rendering will be implemented later
    console.log("Particle effect rendering not implemented", object.id, data);
  };

  /**
   * Render ripple effect (placeholder)
   */
  const renderRippleEffect = (
    ctx: CanvasRenderingContext2D,
    object: RenderObject,
    data: EffectRenderData
  ): void => {
    // Ripple effect rendering will be implemented later
    console.log("Ripple effect rendering not implemented", object.id, data);
  };

  /**
   * Get card background color based on state
   */
  const _getCardBackgroundColor = (state: GameCard["state"]): string => {
    switch (state) {
      case "hidden":
        return "#2a2a2a";
      case "revealed":
        return "#ffffff";
      case "matched":
        return "#90EE90";
      default:
        return "#2a2a2a";
    }
  };

  /**
   * Get card border color based on state
   */
  const _getCardBorderColor = (state: GameCard["state"]): string => {
    switch (state) {
      case "hidden":
        return "#555555";
      case "revealed":
        return "#0080ff";
      case "matched":
        return "#00ff00";
      default:
        return "#555555";
    }
  };

  /**
   * Draw card content (placeholder)
   */
  const _drawCardContent = (
    ctx: CanvasRenderingContext2D,
    card: GameCard,
    _width: number,
    _height: number
  ): void => {
    // Card content rendering will be implemented later with actual CS2 items
    ctx.fillStyle = "#333333";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(card.cs2Item.name.substring(0, 8), 0, 0);
  };

  /**
   * Draw card back
   */
  const _drawCardBack = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void => {
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // Draw CS2 logo or pattern
    ctx.fillStyle = "#ff6600";
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(halfWidth, halfHeight) * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Draw "CS2" text
    ctx.fillStyle = "#ffffff";
    ctx.font = `${Math.min(width, height) * 0.2}px bold sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("CS2", 0, 0);
  };

  /**
   * Render debug information
   */
  const renderDebugInfo = (ctx: CanvasRenderingContext2D): void => {
    ctx.save();

    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(10, 10, 200, 120);

    ctx.fillStyle = "#00ff00";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";

    const lines = [
      `Objects: ${state.objectCount}`,
      `Renders: ${state.renderCount}`,
      `Batches: ${state.batchCount}`,
      `Culled: ${state.culledObjects}`,
      `Animations: ${animations.size}`,
      `FPS: ${Math.round(1000 / (performance.now() - state.lastRenderTime))}`,
    ];

    lines.forEach((line, index) => {
      ctx.fillText(line, 15, 30 + index * 15);
    });

    ctx.restore();
  };

  /**
   * Mark pipeline for full re-render
   */
  const markDirty = (): void => {
    isFullyDirty.value = true;
    for (const layer of layers.values()) {
      layer.isDirty = true;
    }
  };

  /**
   * Toggle debug mode
   */
  const toggleDebugMode = (): void => {
    debugMode.value = !debugMode.value;
    markDirty();
  };

  /**
   * Clear all render objects
   */
  const clearAll = (): void => {
    for (const layer of layers.values()) {
      layer.objects.clear();
      layer.isDirty = true;
    }

    animations.clear();
    textureCache.clear();
    state.objectCount = 0;
    markDirty();
  };

  /**
   * Get render statistics
   */
  const getStats = () => readonly(state);

  /**
   * Get render object by ID
   */
  const getRenderObject = (objectId: string): RenderObject | null => {
    return findObjectById(objectId);
  };

  /**
   * Cleanup resources
   */
  const cleanup = (): void => {
    clearAll();
    canvasContext.value = undefined;
    state.isInitialized = false;

    console.log("Render pipeline cleaned up");
  };

  return {
    // State
    state: getStats(),
    debugMode: readonly(debugMode),

    // Lifecycle
    initialize,
    cleanup,

    // Object management
    addRenderObject,
    removeRenderObject,
    updateRenderObject,
    getRenderObject,

    // Animation
    startAnimation,

    // Rendering
    render,
    markDirty,

    // Utilities
    updateViewport,
    toggleDebugMode,
    clearAll,
  };
};
