import { ref, computed, reactive } from "vue";
import type { GameCard } from "~/types/game";

// Object pool configuration
interface ObjectPoolConfig {
  initialSize: number;
  maxSize: number;
  growthFactor: number;
}

// Canvas object types with proper typing
interface CardObject {
  id: string;
  type: "card";
  position: { x: number; y: number };
  size: { width: number; height: number };
  visible: boolean;
  zIndex: number;
  active: boolean;
  card: GameCard;
  parallaxOffset: { x: number; y: number };
  flipAnimation: {
    isFlipping: boolean;
    progress: number;
    direction: "front" | "back";
  };
}

interface EffectObject {
  id: string;
  type: "effect";
  position: { x: number; y: number };
  size: { width: number; height: number };
  visible: boolean;
  zIndex: number;
  active: boolean;
  effectType: "sparkle" | "pulse" | "fade";
  progress: number;
  duration: number;
  color: string;
}

interface UIObject {
  id: string;
  type: "ui";
  position: { x: number; y: number };
  size: { width: number; height: number };
  visible: boolean;
  zIndex: number;
  active: boolean;
  text: string;
  font: string;
  color: string;
}

type CanvasObject = CardObject | EffectObject | UIObject;

// Object pools for different types
interface ObjectPools {
  cards: CardObject[];
  effects: EffectObject[];
  ui: UIObject[];
}

// Collision detection result
interface CollisionResult {
  object: CanvasObject;
  distance: number;
}

// Batch rendering groups
interface RenderBatch {
  cards: CardObject[];
  effects: EffectObject[];
  ui: UIObject[];
}

export const useCanvasObjects = () => {
  // Object pools for recycling
  const objectPools = reactive<ObjectPools>({
    cards: [],
    effects: [],
    ui: [],
  });

  // Active objects currently in use
  const activeObjects = ref<Map<string, CanvasObject>>(new Map());

  // Object pool configuration
  const poolConfig: Record<string, ObjectPoolConfig> = {
    cards: { initialSize: 50, maxSize: 200, growthFactor: 1.5 },
    effects: { initialSize: 20, maxSize: 100, growthFactor: 2.0 },
    ui: { initialSize: 10, maxSize: 50, growthFactor: 1.5 },
  };

  // Performance tracking
  const stats = reactive({
    totalObjects: 0,
    activeObjects: 0,
    pooledObjects: 0,
    frameTime: 0,
    batchCount: 0,
  });

  // Computed properties for easy access
  const activeCards = computed(() =>
    Array.from(activeObjects.value.values()).filter(
      (obj): obj is CardObject => obj.type === "card" && obj.active
    )
  );

  const activeEffects = computed(() =>
    Array.from(activeObjects.value.values()).filter(
      (obj): obj is EffectObject => obj.type === "effect" && obj.active
    )
  );

  const activeUI = computed(() =>
    Array.from(activeObjects.value.values()).filter(
      (obj): obj is UIObject => obj.type === "ui" && obj.active
    )
  );

  /**
   * Initialize object pools with default objects
   */
  const initializePools = (): void => {
    // Initialize card pool
    for (let i = 0; i < poolConfig.cards.initialSize; i++) {
      objectPools.cards.push(createCardObject(`pool-card-${i}`));
    }

    // Initialize effect pool
    for (let i = 0; i < poolConfig.effects.initialSize; i++) {
      objectPools.effects.push(createEffectObject(`pool-effect-${i}`));
    }

    // Initialize UI pool
    for (let i = 0; i < poolConfig.ui.initialSize; i++) {
      objectPools.ui.push(createUIObject(`pool-ui-${i}`));
    }

    updateStats();
    console.log("Object pools initialized:", {
      cards: objectPools.cards.length,
      effects: objectPools.effects.length,
      ui: objectPools.ui.length,
    });
  };

  /**
   * Create a new card object
   */
  const createCardObject = (id: string): CardObject => ({
    id,
    type: "card",
    position: { x: 0, y: 0 },
    size: { width: 100, height: 140 },
    visible: false,
    zIndex: 1,
    active: false,
    card: {
      id: "",
      pairId: "",
      cs2Item: {
        id: "",
        name: "Placeholder",
        imageUrl: "",
        rarity: "consumer",
        category: "weapon",
      },
      state: "hidden",
      position: { x: 0, y: 0 },
    },
    parallaxOffset: { x: 0, y: 0 },
    flipAnimation: {
      isFlipping: false,
      progress: 0,
      direction: "back",
    },
  });

  /**
   * Create a new effect object
   */
  const createEffectObject = (id: string): EffectObject => ({
    id,
    type: "effect",
    position: { x: 0, y: 0 },
    size: { width: 50, height: 50 },
    visible: false,
    zIndex: 10,
    active: false,
    effectType: "sparkle",
    progress: 0,
    duration: 1000,
    color: "#ffffff",
  });

  /**
   * Create a new UI object
   */
  const createUIObject = (id: string): UIObject => ({
    id,
    type: "ui",
    position: { x: 0, y: 0 },
    size: { width: 200, height: 30 },
    visible: false,
    zIndex: 100,
    active: false,
    text: "",
    font: "16px Arial",
    color: "#ffffff",
  });

  /**
   * Get object from pool or create new one
   */
  const acquireObject = <T extends CanvasObject>(
    type: T["type"],
    id: string
  ): T | null => {
    let object: CanvasObject | undefined;

    // Try to get from pool first
    switch (type) {
      case "card":
        object = objectPools.cards.find((obj) => !obj.active);
        if (!object && objectPools.cards.length < poolConfig.cards.maxSize) {
          const newCard = createCardObject(
            `pool-card-${objectPools.cards.length}`
          );
          objectPools.cards.push(newCard);
          object = newCard;
        }
        break;

      case "effect":
        object = objectPools.effects.find((obj) => !obj.active);
        if (
          !object &&
          objectPools.effects.length < poolConfig.effects.maxSize
        ) {
          const newEffect = createEffectObject(
            `pool-effect-${objectPools.effects.length}`
          );
          objectPools.effects.push(newEffect);
          object = newEffect;
        }
        break;

      case "ui":
        object = objectPools.ui.find((obj) => !obj.active);
        if (!object && objectPools.ui.length < poolConfig.ui.maxSize) {
          const newUI = createUIObject(`pool-ui-${objectPools.ui.length}`);
          objectPools.ui.push(newUI);
          object = newUI;
        }
        break;

      default:
        console.warn(`Unknown object type: ${type}`);
        return null;
    }

    if (!object) {
      console.warn(`No available objects in pool for type: ${type}`);
      return null;
    }

    // Reset and activate object
    object.id = id;
    object.active = true;
    object.visible = true;

    // Add to active objects
    activeObjects.value.set(id, object);
    updateStats();

    return object as T;
  };

  /**
   * Return object to pool
   */
  const releaseObject = (id: string): void => {
    const object = activeObjects.value.get(id);
    if (!object) {
      console.warn(`Object not found: ${id}`);
      return;
    }

    // Reset object properties
    object.active = false;
    object.visible = false;
    object.position = { x: 0, y: 0 };

    // Remove from active objects
    activeObjects.value.delete(id);
    updateStats();
  };

  /**
   * Update all active objects
   */
  const updateObjects = (deltaTime: number): void => {
    const startTime = performance.now();

    for (const [_objectId, object] of activeObjects.value) {
      if (!object.active) continue;

      switch (object.type) {
        case "card":
          updateCardObject(object, deltaTime);
          break;
        case "effect":
          updateEffectObject(object, deltaTime);
          break;
        case "ui":
          updateUIObject(object, deltaTime);
          break;
      }
    }

    stats.frameTime = performance.now() - startTime;
  };

  /**
   * Update card object
   */
  const updateCardObject = (card: CardObject, deltaTime: number): void => {
    // Update flip animation
    if (card.flipAnimation.isFlipping) {
      const flipSpeed = 0.003; // Animation speed
      card.flipAnimation.progress += deltaTime * flipSpeed;

      if (card.flipAnimation.progress >= 1) {
        card.flipAnimation.progress = 1;
        card.flipAnimation.isFlipping = false;
      }
    }
  };

  /**
   * Update effect object
   */
  const updateEffectObject = (
    effect: EffectObject,
    deltaTime: number
  ): void => {
    effect.progress += deltaTime / effect.duration;

    if (effect.progress >= 1) {
      // Effect completed, release it
      releaseObject(effect.id);
    }
  };

  /**
   * Update UI object
   */
  const updateUIObject = (_ui: UIObject, _deltaTime: number): void => {
    // UI objects typically don't need frame-by-frame updates
    // This is here for consistency and future features
  };

  /**
   * Create render batches for optimized rendering
   */
  const createRenderBatch = (): RenderBatch => {
    // Sort objects by z-index for proper layering
    const sortedObjects = Array.from(activeObjects.value.values())
      .filter((obj) => obj.active && obj.visible)
      .sort((a, b) => a.zIndex - b.zIndex);

    const batch: RenderBatch = {
      cards: [],
      effects: [],
      ui: [],
    };

    // Group objects by type for batch rendering
    for (const object of sortedObjects) {
      switch (object.type) {
        case "card":
          batch.cards.push(object);
          break;
        case "effect":
          batch.effects.push(object);
          break;
        case "ui":
          batch.ui.push(object);
          break;
      }
    }

    stats.batchCount =
      batch.cards.length + batch.effects.length + batch.ui.length;
    return batch;
  };

  /**
   * Collision detection for point vs object
   */
  const getObjectAtPosition = (x: number, y: number): CanvasObject | null => {
    // Check from highest z-index to lowest
    const sortedObjects = Array.from(activeObjects.value.values())
      .filter((obj) => obj.active && obj.visible)
      .sort((a, b) => b.zIndex - a.zIndex);

    for (const object of sortedObjects) {
      if (isPointInObject(x, y, object)) {
        return object;
      }
    }

    return null;
  };

  /**
   * Get all objects within a radius
   */
  const getObjectsInRadius = (
    x: number,
    y: number,
    radius: number
  ): CollisionResult[] => {
    const results: CollisionResult[] = [];

    for (const [_objectId, object] of activeObjects.value) {
      if (!object.active || !object.visible) continue;

      const distance = getDistanceToObject(x, y, object);
      if (distance <= radius) {
        results.push({ object, distance });
      }
    }

    // Sort by distance (closest first)
    return results.sort((a, b) => a.distance - b.distance);
  };

  /**
   * Check if point is inside object bounds
   */
  const isPointInObject = (
    x: number,
    y: number,
    object: CanvasObject
  ): boolean => {
    return (
      x >= object.position.x &&
      x <= object.position.x + object.size.width &&
      y >= object.position.y &&
      y <= object.position.y + object.size.height
    );
  };

  /**
   * Calculate distance from point to object center
   */
  const getDistanceToObject = (
    x: number,
    y: number,
    object: CanvasObject
  ): number => {
    const centerX = object.position.x + object.size.width / 2;
    const centerY = object.position.y + object.size.height / 2;

    return Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
  };

  /**
   * Clear all active objects
   */
  const clearAllObjects = (): void => {
    for (const [objectId] of activeObjects.value) {
      releaseObject(objectId);
    }
    updateStats();
  };

  /**
   * Update performance statistics
   */
  const updateStats = (): void => {
    stats.totalObjects =
      objectPools.cards.length +
      objectPools.effects.length +
      objectPools.ui.length;
    stats.activeObjects = activeObjects.value.size;
    stats.pooledObjects = stats.totalObjects - stats.activeObjects;
  };

  /**
   * Get object pool statistics for debugging
   */
  const getPoolStats = () => ({
    pools: {
      cards: {
        total: objectPools.cards.length,
        active: objectPools.cards.filter((obj) => obj.active).length,
        available: objectPools.cards.filter((obj) => !obj.active).length,
      },
      effects: {
        total: objectPools.effects.length,
        active: objectPools.effects.filter((obj) => obj.active).length,
        available: objectPools.effects.filter((obj) => !obj.active).length,
      },
      ui: {
        total: objectPools.ui.length,
        active: objectPools.ui.filter((obj) => obj.active).length,
        available: objectPools.ui.filter((obj) => !obj.active).length,
      },
    },
    performance: { ...stats },
  });

  /**
   * Force garbage collection of unused pool objects
   */
  const cleanupPools = (): void => {
    // Remove excess objects from pools if they exceed optimal size
    const optimalSize = Math.ceil(poolConfig.cards.initialSize * 1.2);

    if (objectPools.cards.length > optimalSize) {
      objectPools.cards = objectPools.cards.slice(0, optimalSize);
    }

    if (objectPools.effects.length > optimalSize) {
      objectPools.effects = objectPools.effects.slice(0, optimalSize);
    }

    if (objectPools.ui.length > optimalSize) {
      objectPools.ui = objectPools.ui.slice(0, optimalSize);
    }

    updateStats();
    console.log("Object pools cleaned up");
  };

  return {
    // State
    activeObjects,
    objectPools,
    stats,

    // Computed
    activeCards,
    activeEffects,
    activeUI,

    // Core methods
    initializePools,
    acquireObject,
    releaseObject,
    updateObjects,
    createRenderBatch,

    // Collision detection
    getObjectAtPosition,
    getObjectsInRadius,
    isPointInObject,
    getDistanceToObject,

    // Utility methods
    clearAllObjects,
    getPoolStats,
    cleanupPools,
  };
};
