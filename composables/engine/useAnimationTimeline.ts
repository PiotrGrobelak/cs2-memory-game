/**
 * useAnimationTimeline - Advanced animation timeline management system
 *
 * This composable provides sophisticated animation features:
 * - Complex animation sequencing and choreography
 * - Keyframe-based animations with multiple easing curves
 * - Timeline management with pause/resume/rewind functionality
 * - Performance-optimized animation batching
 * - Interactive animation callbacks and event handling
 * - Memory efficient animation pooling
 *
 * Key features:
 * - Multi-object synchronized animations
 * - Advanced easing functions and bezier curves
 * - Animation composition and sequencing
 * - Performance monitoring and optimization
 * - Event-driven animation system
 * - Smooth interpolation between keyframes
 */
import { reactive, readonly } from "vue";

// Timeline types
type TimelineEvent = "start" | "progress" | "complete" | "pause" | "resume";
type EasingFunction = (t: number) => number;

// Keyframe interface
interface Keyframe {
  time: number; // 0-1 progress
  value: number;
  easing: EasingFunction;
}

// Animation property interface
interface AnimationProperty {
  name: string;
  startValue: number;
  endValue: number;
  keyframes: Keyframe[];
  currentValue: number;
}

// Timeline entry interface
interface TimelineEntry {
  id: string;
  targetId: string;
  properties: Map<string, AnimationProperty>;
  duration: number;
  delay: number;
  startTime: number;
  progress: number;
  isActive: boolean;
  isComplete: boolean;
  repeatCount: number;
  currentRepeat: number;
  yoyo: boolean;
  callbacks: Map<TimelineEvent, (() => void)[]>;
}

// Timeline state interface
interface TimelineState {
  isInitialized: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  playbackRate: number;
  totalDuration: number;
  currentTime: number;
  lastUpdateTime: number;
  activeAnimations: number;
}

// Batch processing interface
interface AnimationBatch {
  entries: TimelineEntry[];
  priority: number;
  isProcessing: boolean;
  processingTime: number;
}

// Advanced easing functions (Bezier curves and complex easings)
const EASING_FUNCTIONS: Record<string, EasingFunction> = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => 1 - (1 - t) * (1 - t),
  easeInOut: (t: number) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,

  // Advanced cubic bezier easings
  ease: (t: number) => cubicBezier(0.25, 0.1, 0.25, 1)(t),
  easeInSine: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine: (t: number) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,

  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => 1 - (1 - t) * (1 - t),
  easeInOutQuad: (t: number) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,

  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,

  easeInBack: (t: number) => 2.70158 * t * t * t - 1.70158 * t * t,
  easeOutBack: (t: number) =>
    1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),

  easeInElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
  },

  easeOutElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },

  easeInBounce: (t: number) => 1 - EASING_FUNCTIONS.easeOutBounce(1 - t),
  easeOutBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;

    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
};

// Cubic bezier function generator
function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): EasingFunction {
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;

    // Binary search for the correct t value
    let low = 0;
    let high = 1;
    let mid = 0.5;

    for (let i = 0; i < 20; i++) {
      const x =
        3 * (1 - mid) * (1 - mid) * mid * x1 +
        3 * (1 - mid) * mid * mid * x2 +
        mid * mid * mid;
      if (Math.abs(x - t) < 0.001) break;

      if (x < t) {
        low = mid;
      } else {
        high = mid;
      }
      mid = (low + high) / 2;
    }

    return (
      3 * (1 - mid) * (1 - mid) * mid * y1 +
      3 * (1 - mid) * mid * mid * y2 +
      mid * mid * mid
    );
  };
}

// Animation performance settings
const ANIMATION_CONFIG = {
  maxConcurrentAnimations: 100,
  batchProcessingThreshold: 16, // milliseconds
  targetFPS: 60,
  enableBatching: true,
  enablePooling: true,
};

export const useAnimationTimeline = () => {
  // Timeline state
  const state = reactive<TimelineState>({
    isInitialized: false,
    isPlaying: false,
    isPaused: false,
    playbackRate: 1.0,
    totalDuration: 0,
    currentTime: 0,
    lastUpdateTime: 0,
    activeAnimations: 0,
  });

  // Animation entries (main timeline)
  const timeline = reactive<Map<string, TimelineEntry>>(new Map());

  // Animation batches for performance optimization
  const batches = reactive<Map<number, AnimationBatch>>(new Map());

  // Animation object pool for memory efficiency
  const entryPool: TimelineEntry[] = [];
  const propertyPool: AnimationProperty[] = [];

  // Global timeline callbacks
  const globalCallbacks = reactive<Map<TimelineEvent, (() => void)[]>>(
    new Map()
  );

  /**
   * Initialize animation timeline
   */
  const initialize = (): void => {
    if (state.isInitialized) {
      console.warn("Animation timeline already initialized");
      return;
    }

    // Initialize global callback maps
    const events: TimelineEvent[] = [
      "start",
      "progress",
      "complete",
      "pause",
      "resume",
    ];
    events.forEach((event) => {
      globalCallbacks.set(event, []);
    });

    // Initialize animation batches by priority
    for (let priority = 0; priority < 5; priority++) {
      batches.set(priority, {
        entries: [],
        priority,
        isProcessing: false,
        processingTime: 0,
      });
    }

    state.isInitialized = true;
    console.log("Animation timeline initialized", {
      maxConcurrent: ANIMATION_CONFIG.maxConcurrentAnimations,
      enableBatching: ANIMATION_CONFIG.enableBatching,
    });
  };

  /**
   * Create animation entry from pool or new instance
   */
  const createAnimationEntry = (
    id: string,
    targetId: string,
    duration: number,
    delay: number = 0
  ): TimelineEntry => {
    let entry = entryPool.pop();

    if (!entry) {
      entry = {
        id: "",
        targetId: "",
        properties: new Map(),
        duration: 0,
        delay: 0,
        startTime: 0,
        progress: 0,
        isActive: false,
        isComplete: false,
        repeatCount: 1,
        currentRepeat: 0,
        yoyo: false,
        callbacks: new Map(),
      };

      // Initialize callbacks
      const events: TimelineEvent[] = [
        "start",
        "progress",
        "complete",
        "pause",
        "resume",
      ];
      events.forEach((event) => {
        entry!.callbacks.set(event, []);
      });
    }

    // Reset and configure entry
    entry.id = id;
    entry.targetId = targetId;
    entry.duration = duration;
    entry.delay = delay;
    entry.startTime = 0;
    entry.progress = 0;
    entry.isActive = false;
    entry.isComplete = false;
    entry.repeatCount = 1;
    entry.currentRepeat = 0;
    entry.yoyo = false;
    entry.properties.clear();

    // Clear callbacks
    entry.callbacks.forEach((callbackArray) => (callbackArray.length = 0));

    return entry;
  };

  /**
   * Create animation property from pool or new instance
   */
  const createAnimationProperty = (
    name: string,
    startValue: number,
    endValue: number,
    keyframes: Keyframe[] = []
  ): AnimationProperty => {
    let property = propertyPool.pop();

    if (!property) {
      property = {
        name: "",
        startValue: 0,
        endValue: 0,
        keyframes: [],
        currentValue: 0,
      };
    }

    property.name = name;
    property.startValue = startValue;
    property.endValue = endValue;
    property.keyframes = [...keyframes];
    property.currentValue = startValue;

    return property;
  };

  /**
   * Add animation to timeline
   */
  const addAnimation = (
    id: string,
    targetId: string,
    properties: Record<
      string,
      { from: number; to: number; keyframes?: Keyframe[] }
    >,
    options: {
      duration: number;
      delay?: number;
      easing?: string | EasingFunction;
      repeat?: number;
      yoyo?: boolean;
      priority?: number;
    }
  ): void => {
    const {
      duration,
      delay = 0,
      easing = "easeInOut",
      repeat = 1,
      yoyo = false,
      priority = 2,
    } = options;

    // Create animation entry
    const entry = createAnimationEntry(id, targetId, duration, delay);
    entry.repeatCount = repeat;
    entry.yoyo = yoyo;

    // Add properties
    for (const [propName, propConfig] of Object.entries(properties)) {
      const easingFunc =
        typeof easing === "string"
          ? EASING_FUNCTIONS[easing] || EASING_FUNCTIONS.linear
          : easing;

      const keyframes = propConfig.keyframes || [
        { time: 0, value: propConfig.from, easing: easingFunc },
        { time: 1, value: propConfig.to, easing: easingFunc },
      ];

      const property = createAnimationProperty(
        propName,
        propConfig.from,
        propConfig.to,
        keyframes
      );
      entry.properties.set(propName, property);
    }

    // Add to timeline
    timeline.set(id, entry);

    // Add to appropriate batch
    const batch = batches.get(priority);
    if (batch) {
      batch.entries.push(entry);
    }

    state.activeAnimations++;
    console.log(
      `Added animation "${id}" for target "${targetId}" (${duration}ms)`
    );
  };

  /**
   * Start specific animation
   */
  const startAnimation = (id: string, callback?: () => void): void => {
    const entry = timeline.get(id);
    if (!entry) {
      console.warn(`Animation "${id}" not found`);
      return;
    }

    entry.startTime = performance.now() + entry.delay;
    entry.isActive = true;
    entry.isComplete = false;
    entry.progress = 0;

    if (callback) {
      entry.callbacks.get("complete")?.push(callback);
    }

    // Emit start event
    entry.callbacks.get("start")?.forEach((cb) => cb());
    globalCallbacks.get("start")?.forEach((cb) => cb());
  };

  /**
   * Stop specific animation
   */
  const stopAnimation = (id: string): void => {
    const entry = timeline.get(id);
    if (!entry) return;

    entry.isActive = false;
    entry.isComplete = true;

    // Remove from batches
    batches.forEach((batch) => {
      const index = batch.entries.indexOf(entry);
      if (index !== -1) {
        batch.entries.splice(index, 1);
      }
    });

    // Return to pool
    returnEntryToPool(entry);
    timeline.delete(id);
    state.activeAnimations--;
  };

  /**
   * Update animation timeline
   */
  const update = (currentTime: number): Map<string, Record<string, number>> => {
    const results = new Map<string, Record<string, number>>();

    if (!state.isPlaying || state.isPaused) return results;

    state.currentTime = currentTime;
    state.lastUpdateTime = currentTime;

    // Process batches by priority
    if (ANIMATION_CONFIG.enableBatching) {
      for (const batch of batches.values()) {
        if (batch.entries.length > 0) {
          processBatch(batch, currentTime, results);
        }
      }
    } else {
      // Process all animations directly
      for (const entry of timeline.values()) {
        if (entry.isActive) {
          updateSingleAnimation(entry, currentTime, results);
        }
      }
    }

    // Emit global progress event
    globalCallbacks.get("progress")?.forEach((cb) => cb());

    return results;
  };

  /**
   * Process animation batch
   */
  const processBatch = (
    batch: AnimationBatch,
    currentTime: number,
    results: Map<string, Record<string, number>>
  ): void => {
    if (batch.isProcessing) return;

    batch.isProcessing = true;
    const startTime = performance.now();

    for (const entry of batch.entries) {
      if (entry.isActive) {
        updateSingleAnimation(entry, currentTime, results);
      }
    }

    batch.processingTime = performance.now() - startTime;
    batch.isProcessing = false;
  };

  /**
   * Update single animation entry
   */
  const updateSingleAnimation = (
    entry: TimelineEntry,
    currentTime: number,
    results: Map<string, Record<string, number>>
  ): void => {
    // Check if animation should start
    if (currentTime < entry.startTime) return;

    // Calculate progress
    const elapsed = currentTime - entry.startTime;
    let progress = Math.min(elapsed / entry.duration, 1);

    // Handle yoyo effect
    if (entry.yoyo && entry.currentRepeat % 2 === 1) {
      progress = 1 - progress;
    }

    entry.progress = progress;

    // Update property values
    const propertyValues: Record<string, number> = {};

    for (const property of entry.properties.values()) {
      property.currentValue = interpolateWithKeyframes(property, progress);
      propertyValues[property.name] = property.currentValue;
    }

    results.set(entry.targetId, propertyValues);

    // Check if animation is complete
    if (progress >= 1) {
      entry.currentRepeat++;

      if (entry.currentRepeat >= entry.repeatCount) {
        // Animation complete
        entry.isActive = false;
        entry.isComplete = true;

        // Emit complete callbacks
        entry.callbacks.get("complete")?.forEach((cb) => cb());

        // Schedule cleanup
        setTimeout(() => stopAnimation(entry.id), 0);
      } else {
        // Reset for next repeat
        entry.startTime = currentTime;
      }
    } else {
      // Emit progress callbacks
      entry.callbacks.get("progress")?.forEach((cb) => cb());
    }
  };

  /**
   * Interpolate value with keyframes
   */
  const interpolateWithKeyframes = (
    property: AnimationProperty,
    progress: number
  ): number => {
    if (property.keyframes.length < 2) {
      return (
        property.startValue +
        (property.endValue - property.startValue) * progress
      );
    }

    // Find surrounding keyframes
    let prevKeyframe = property.keyframes[0];
    let nextKeyframe = property.keyframes[property.keyframes.length - 1];

    for (let i = 0; i < property.keyframes.length - 1; i++) {
      if (
        progress >= property.keyframes[i].time &&
        progress <= property.keyframes[i + 1].time
      ) {
        prevKeyframe = property.keyframes[i];
        nextKeyframe = property.keyframes[i + 1];
        break;
      }
    }

    // Calculate local progress between keyframes
    const keyframeDuration = nextKeyframe.time - prevKeyframe.time;
    const localProgress =
      keyframeDuration > 0
        ? (progress - prevKeyframe.time) / keyframeDuration
        : 0;

    // Apply easing
    const easedProgress = nextKeyframe.easing(localProgress);

    // Interpolate value
    return (
      prevKeyframe.value +
      (nextKeyframe.value - prevKeyframe.value) * easedProgress
    );
  };

  /**
   * Return animation entry to pool
   */
  const returnEntryToPool = (entry: TimelineEntry): void => {
    if (!ANIMATION_CONFIG.enablePooling) return;

    // Return properties to pool
    for (const property of entry.properties.values()) {
      propertyPool.push(property);
    }

    // Return entry to pool
    entryPool.push(entry);
  };

  /**
   * Play timeline
   */
  const play = (): void => {
    if (!state.isInitialized) {
      console.error("Animation timeline not initialized");
      return;
    }

    state.isPlaying = true;
    state.isPaused = false;
    state.lastUpdateTime = performance.now();

    // Start all active animations
    for (const entry of timeline.values()) {
      if (!entry.isActive && !entry.isComplete) {
        startAnimation(entry.id);
      }
    }

    globalCallbacks.get("start")?.forEach((cb) => cb());
    console.log("Animation timeline started");
  };

  /**
   * Pause timeline
   */
  const pause = (): void => {
    state.isPaused = true;
    globalCallbacks.get("pause")?.forEach((cb) => cb());
    console.log("Animation timeline paused");
  };

  /**
   * Resume timeline
   */
  const resume = (): void => {
    if (!state.isPlaying) return;

    state.isPaused = false;
    state.lastUpdateTime = performance.now();

    globalCallbacks.get("resume")?.forEach((cb) => cb());
    console.log("Animation timeline resumed");
  };

  /**
   * Stop timeline
   */
  const stop = (): void => {
    state.isPlaying = false;
    state.isPaused = false;

    // Stop all animations
    const animationIds = Array.from(timeline.keys());
    animationIds.forEach((id) => stopAnimation(id));

    globalCallbacks.get("complete")?.forEach((cb) => cb());
    console.log("Animation timeline stopped");
  };

  /**
   * Add global callback
   */
  const addGlobalCallback = (
    event: TimelineEvent,
    callback: () => void
  ): void => {
    globalCallbacks.get(event)?.push(callback);
  };

  /**
   * Remove global callback
   */
  const removeGlobalCallback = (
    event: TimelineEvent,
    callback: () => void
  ): void => {
    const callbacks = globalCallbacks.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  };

  /**
   * Get easing function by name
   */
  const getEasingFunction = (name: string): EasingFunction => {
    return EASING_FUNCTIONS[name] || EASING_FUNCTIONS.linear;
  };

  /**
   * Create custom easing function
   */
  const createCustomEasing = (
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): EasingFunction => {
    return cubicBezier(x1, y1, x2, y2);
  };

  /**
   * Get timeline performance stats
   */
  const getStats = () => ({
    state: readonly(state),
    activeAnimations: timeline.size,
    batchCount: batches.size,
    pooledEntries: entryPool.length,
    pooledProperties: propertyPool.length,
    batchStats: Array.from(batches.values()).map((batch) => ({
      priority: batch.priority,
      entries: batch.entries.length,
      processingTime: batch.processingTime,
    })),
  });

  /**
   * Cleanup timeline
   */
  const cleanup = (): void => {
    stop();

    // Clear all collections
    timeline.clear();
    batches.clear();
    globalCallbacks.clear();
    entryPool.length = 0;
    propertyPool.length = 0;

    state.isInitialized = false;
    console.log("Animation timeline cleaned up");
  };

  return {
    // State
    state: readonly(state),

    // Lifecycle
    initialize,
    cleanup,

    // Playback control
    play,
    pause,
    resume,
    stop,

    // Animation management
    addAnimation,
    startAnimation,
    stopAnimation,
    update,

    // Callbacks
    addGlobalCallback,
    removeGlobalCallback,

    // Utilities
    getEasingFunction,
    createCustomEasing,
    getStats,
  };
};
