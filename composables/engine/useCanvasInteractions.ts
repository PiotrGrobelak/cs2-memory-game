/**
 * useCanvasInteractions - Advanced interaction handling for memory game canvas
 *
 * This composable provides precise user interaction management:
 * - Multi-touch support for mobile devices
 * - Gesture handling (pinch, pan, tap)
 * - Event debouncing and throttling for performance
 * - Coordinate conversion between canvas and screen space
 * - Hit detection with pixel-perfect accuracy
 * - Accessibility support for keyboard navigation
 *
 * Key features:
 * - Touch and mouse event unification
 * - Gesture recognition with threshold detection
 * - Performance-optimized event handling
 * - Cross-device coordinate normalization
 * - Hover state management for cards
 * - Keyboard navigation support
 */
import { ref, reactive, readonly, computed } from "vue";

// Layout engine interface for type safety
interface LayoutEngineRef {
  getCardIndexAtPosition: (canvasX: number, canvasY: number) => number | null;
}

// Interaction types
type InteractionType = "click" | "touch" | "hover" | "keyboard" | "gesture";

// Touch/pointer state
interface PointerState {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  isActive: boolean;
  timestamp: number;
}

// Gesture types
type GestureType = "none" | "tap" | "longPress" | "pan" | "pinch" | "swipe";

// Gesture state
interface GestureState {
  type: GestureType;
  isActive: boolean;
  startTime: number;
  duration: number;
  distance: number;
  scale: number;
  direction: "up" | "down" | "left" | "right" | "none";
}

// Interaction event data
interface InteractionEvent {
  type: InteractionType;
  canvasX: number;
  canvasY: number;
  cardIndex: number | null;
  originalEvent: Event;
  gesture?: GestureState;
}

// Interaction handler callbacks
type InteractionCallback = (event: InteractionEvent) => void;

// Interaction engine state
interface InteractionEngineState {
  isInitialized: boolean;
  isEnabled: boolean;
  canvasElement: HTMLCanvasElement | null;
  devicePixelRatio: number;
  lastInteractionTime: number;
  hoverCardIndex: number | null;
  activePointers: Map<number, PointerState>;
  currentGesture: GestureState;
}

// Gesture configuration
interface GestureConfig {
  tapThreshold: number; // milliseconds
  longPressThreshold: number; // milliseconds
  panThreshold: number; // pixels
  pinchThreshold: number; // scale difference
  swipeThreshold: number; // pixels
  swipeVelocityThreshold: number; // pixels per millisecond
}

// Default gesture configuration
const DEFAULT_GESTURE_CONFIG: GestureConfig = {
  tapThreshold: 200, // 200ms
  longPressThreshold: 500, // 500ms
  panThreshold: 10, // 10px
  pinchThreshold: 0.1, // 10% scale change
  swipeThreshold: 50, // 50px minimum distance
  swipeVelocityThreshold: 0.5, // 0.5px per ms
};

// Event debounce/throttle configuration
const INTERACTION_THROTTLE_MS = 16; // ~60fps
const HOVER_DEBOUNCE_MS = 50;

export const useCanvasInteractions = (
  gestureConfig: Partial<GestureConfig> = {}
) => {
  // Merge configuration with defaults
  const config = { ...DEFAULT_GESTURE_CONFIG, ...gestureConfig };

  // Canvas layout engine reference (injected)
  const layoutEngine = ref<LayoutEngineRef | null>(null);

  // Interaction state
  const state = reactive<InteractionEngineState>({
    isInitialized: false,
    isEnabled: true,
    canvasElement: null,
    devicePixelRatio: 1,
    lastInteractionTime: 0,
    hoverCardIndex: null,
    activePointers: new Map(),
    currentGesture: {
      type: "none",
      isActive: false,
      startTime: 0,
      duration: 0,
      distance: 0,
      scale: 1,
      direction: "none",
    },
  });

  // Event callbacks
  const callbacks = reactive<Map<InteractionType, Set<InteractionCallback>>>(
    new Map()
  );

  // Throttle timers
  let hoverTimeout: number | null = null;
  let lastThrottledTime = 0;

  // Computed properties
  const hasActivePointers = computed(() => state.activePointers.size > 0);
  const isMultiTouch = computed(() => state.activePointers.size > 1);

  /**
   * Initialize interaction engine with canvas element
   */
  const initialize = (
    canvasElement: HTMLCanvasElement,
    layoutEngineRef?: LayoutEngineRef
  ): void => {
    if (state.isInitialized) {
      console.warn("Canvas interactions already initialized");
      return;
    }

    state.canvasElement = canvasElement;
    state.devicePixelRatio = window.devicePixelRatio || 1;

    if (layoutEngineRef) {
      layoutEngine.value = layoutEngineRef;
    }

    // Initialize callback maps
    initializeCallbacks();

    // Setup event listeners
    setupEventListeners(canvasElement);

    state.isInitialized = true;
    console.log("Canvas interactions initialized", {
      element: canvasElement.tagName,
      dpr: state.devicePixelRatio,
      hasLayoutEngine: !!layoutEngine.value,
    });
  };

  /**
   * Initialize callback maps for each interaction type
   */
  const initializeCallbacks = (): void => {
    const interactionTypes: InteractionType[] = [
      "click",
      "touch",
      "hover",
      "keyboard",
      "gesture",
    ];

    for (const type of interactionTypes) {
      callbacks.set(type, new Set());
    }
  };

  /**
   * Setup event listeners for canvas element
   */
  const setupEventListeners = (element: HTMLCanvasElement): void => {
    // Mouse events
    element.addEventListener("mousedown", handleMouseDown, { passive: false });
    element.addEventListener("mousemove", handleMouseMove, { passive: true });
    element.addEventListener("mouseup", handleMouseUp, { passive: false });
    element.addEventListener("mouseleave", handleMouseLeave, { passive: true });
    element.addEventListener("click", handleClick, { passive: false });

    // Touch events
    element.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    element.addEventListener("touchend", handleTouchEnd, { passive: false });
    element.addEventListener("touchcancel", handleTouchCancel, {
      passive: false,
    });

    // Keyboard events (for accessibility)
    element.addEventListener("keydown", handleKeyDown, { passive: false });
    element.addEventListener("keyup", handleKeyUp, { passive: false });

    // Prevent context menu on canvas
    element.addEventListener("contextmenu", (e) => e.preventDefault());

    // Focus events for keyboard navigation
    element.addEventListener("focus", handleFocus, { passive: true });
    element.addEventListener("blur", handleBlur, { passive: true });

    // Make canvas focusable for keyboard navigation
    if (!element.hasAttribute("tabindex")) {
      element.setAttribute("tabindex", "0");
    }
  };

  /**
   * Convert screen coordinates to canvas coordinates
   */
  const screenToCanvas = (
    screenX: number,
    screenY: number
  ): { x: number; y: number } => {
    if (!state.canvasElement) return { x: 0, y: 0 };

    const rect = state.canvasElement.getBoundingClientRect();
    const scaleX = state.canvasElement.width / rect.width;
    const scaleY = state.canvasElement.height / rect.height;

    return {
      x: (screenX - rect.left) * scaleX,
      y: (screenY - rect.top) * scaleY,
    };
  };

  /**
   * Get card index at canvas position using layout engine
   */
  const getCardIndexAtPosition = (
    canvasX: number,
    canvasY: number
  ): number | null => {
    if (!layoutEngine.value?.getCardIndexAtPosition) {
      console.warn("Layout engine not available for hit detection");
      return null;
    }

    return layoutEngine.value.getCardIndexAtPosition(canvasX, canvasY);
  };

  /**
   * Throttle interaction events for performance
   */
  const shouldThrottleEvent = (): boolean => {
    const now = performance.now();
    if (now - lastThrottledTime < INTERACTION_THROTTLE_MS) {
      return true;
    }
    lastThrottledTime = now;
    return false;
  };

  /**
   * Emit interaction event to registered callbacks
   */
  const emitInteractionEvent = (
    type: InteractionType,
    canvasX: number,
    canvasY: number,
    originalEvent: Event,
    gesture?: GestureState
  ): void => {
    const cardIndex = getCardIndexAtPosition(canvasX, canvasY);

    const event: InteractionEvent = {
      type,
      canvasX,
      canvasY,
      cardIndex,
      originalEvent,
      gesture,
    };

    const typeCallbacks = callbacks.get(type);
    if (typeCallbacks) {
      typeCallbacks.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error(`Error in ${type} callback:`, error);
        }
      });
    }

    state.lastInteractionTime = performance.now();
  };

  /**
   * Handle mouse down events
   */
  const handleMouseDown = (event: MouseEvent): void => {
    if (!state.isEnabled || shouldThrottleEvent()) return;

    const { x, y } = screenToCanvas(event.clientX, event.clientY);

    // Create pointer state for mouse
    const pointer: PointerState = {
      id: -1, // Mouse uses -1 as ID
      x,
      y,
      startX: x,
      startY: y,
      isActive: true,
      timestamp: performance.now(),
    };

    state.activePointers.set(-1, pointer);
    startGestureDetection("tap", pointer);

    emitInteractionEvent("click", x, y, event);
  };

  /**
   * Handle mouse move events
   */
  const handleMouseMove = (event: MouseEvent): void => {
    if (!state.isEnabled) return;

    const { x, y } = screenToCanvas(event.clientX, event.clientY);

    // Update pointer if active
    const pointer = state.activePointers.get(-1);
    if (pointer) {
      pointer.x = x;
      pointer.y = y;
      updateGestureDetection(pointer);
    }

    // Handle hover with debouncing
    handleHover(x, y, event);
  };

  /**
   * Handle mouse up events
   */
  const handleMouseUp = (event: MouseEvent): void => {
    if (!state.isEnabled) return;

    const pointer = state.activePointers.get(-1);
    if (pointer) {
      const { x, y } = screenToCanvas(event.clientX, event.clientY);

      pointer.x = x;
      pointer.y = y;
      pointer.isActive = false;

      endGestureDetection(pointer);
      state.activePointers.delete(-1);
    }
  };

  /**
   * Handle mouse leave events
   */
  const handleMouseLeave = (_event: MouseEvent): void => {
    // Clear hover state
    if (state.hoverCardIndex !== null) {
      state.hoverCardIndex = null;
    }

    // Clear active mouse pointer
    state.activePointers.delete(-1);
    resetGestureState();
  };

  /**
   * Handle click events
   */
  const handleClick = (event: MouseEvent): void => {
    if (!state.isEnabled) return;

    event.preventDefault();
    const { x, y } = screenToCanvas(event.clientX, event.clientY);
    emitInteractionEvent("click", x, y, event);
  };

  /**
   * Handle hover with debouncing
   */
  const handleHover = (
    canvasX: number,
    canvasY: number,
    event: Event
  ): void => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
    }

    hoverTimeout = setTimeout(() => {
      const cardIndex = getCardIndexAtPosition(canvasX, canvasY);

      if (cardIndex !== state.hoverCardIndex) {
        state.hoverCardIndex = cardIndex;
        emitInteractionEvent("hover", canvasX, canvasY, event);
      }
    }, HOVER_DEBOUNCE_MS) as unknown as number;
  };

  /**
   * Handle touch start events
   */
  const handleTouchStart = (event: TouchEvent): void => {
    if (!state.isEnabled) return;

    event.preventDefault();

    for (const touch of Array.from(event.changedTouches)) {
      const { x, y } = screenToCanvas(touch.clientX, touch.clientY);

      const pointer: PointerState = {
        id: touch.identifier,
        x,
        y,
        startX: x,
        startY: y,
        isActive: true,
        timestamp: performance.now(),
      };

      state.activePointers.set(touch.identifier, pointer);

      // Start gesture detection
      if (state.activePointers.size === 1) {
        startGestureDetection("tap", pointer);
      } else if (state.activePointers.size === 2) {
        startGestureDetection("pinch", pointer);
      }
    }

    const firstTouch = event.changedTouches[0];
    const { x, y } = screenToCanvas(firstTouch.clientX, firstTouch.clientY);
    emitInteractionEvent("touch", x, y, event);
  };

  /**
   * Handle touch move events
   */
  const handleTouchMove = (event: TouchEvent): void => {
    if (!state.isEnabled) return;

    event.preventDefault();

    for (const touch of Array.from(event.changedTouches)) {
      const pointer = state.activePointers.get(touch.identifier);
      if (pointer) {
        const { x, y } = screenToCanvas(touch.clientX, touch.clientY);
        pointer.x = x;
        pointer.y = y;
        updateGestureDetection(pointer);
      }
    }
  };

  /**
   * Handle touch end events
   */
  const handleTouchEnd = (event: TouchEvent): void => {
    if (!state.isEnabled) return;

    event.preventDefault();

    for (const touch of Array.from(event.changedTouches)) {
      const pointer = state.activePointers.get(touch.identifier);
      if (pointer) {
        const { x, y } = screenToCanvas(touch.clientX, touch.clientY);
        pointer.x = x;
        pointer.y = y;
        pointer.isActive = false;

        endGestureDetection(pointer);
        state.activePointers.delete(touch.identifier);
      }
    }

    // If no more active pointers, reset gesture state
    if (state.activePointers.size === 0) {
      resetGestureState();
    }
  };

  /**
   * Handle touch cancel events
   */
  const handleTouchCancel = (event: TouchEvent): void => {
    handleTouchEnd(event);
  };

  /**
   * Start gesture detection
   */
  const startGestureDetection = (
    type: GestureType,
    pointer: PointerState
  ): void => {
    state.currentGesture = {
      type,
      isActive: true,
      startTime: pointer.timestamp,
      duration: 0,
      distance: 0,
      scale: 1,
      direction: "none",
    };
  };

  /**
   * Update gesture detection
   */
  const updateGestureDetection = (pointer: PointerState): void => {
    if (!state.currentGesture.isActive) return;

    const now = performance.now();
    const duration = now - state.currentGesture.startTime;
    const distance = Math.sqrt(
      Math.pow(pointer.x - pointer.startX, 2) +
        Math.pow(pointer.y - pointer.startY, 2)
    );

    state.currentGesture.duration = duration;
    state.currentGesture.distance = distance;

    // Detect gesture type based on movement
    if (state.currentGesture.type === "tap") {
      if (distance > config.panThreshold) {
        // Convert tap to pan
        state.currentGesture.type = "pan";
        updatePanDirection(pointer);
      } else if (duration > config.longPressThreshold) {
        // Convert tap to long press
        state.currentGesture.type = "longPress";
      }
    } else if (state.currentGesture.type === "pan") {
      updatePanDirection(pointer);
    } else if (state.currentGesture.type === "pinch") {
      updatePinchScale();
    }
  };

  /**
   * Update pan gesture direction
   */
  const updatePanDirection = (pointer: PointerState): void => {
    const deltaX = pointer.x - pointer.startX;
    const deltaY = pointer.y - pointer.startY;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      state.currentGesture.direction = deltaX > 0 ? "right" : "left";
    } else {
      state.currentGesture.direction = deltaY > 0 ? "down" : "up";
    }
  };

  /**
   * Update pinch gesture scale
   */
  const updatePinchScale = (): void => {
    const pointers = Array.from(state.activePointers.values());
    if (pointers.length !== 2) return;

    const [p1, p2] = pointers;
    const currentDistance = Math.sqrt(
      Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)
    );
    const startDistance = Math.sqrt(
      Math.pow(p1.startX - p2.startX, 2) + Math.pow(p1.startY - p2.startY, 2)
    );

    state.currentGesture.scale = currentDistance / startDistance;
  };

  /**
   * End gesture detection
   */
  const endGestureDetection = (pointer: PointerState): void => {
    if (!state.currentGesture.isActive) return;

    const gesture = { ...state.currentGesture };

    // Detect swipe gesture
    if (gesture.type === "pan" && gesture.distance > config.swipeThreshold) {
      const velocity = gesture.distance / gesture.duration;
      if (velocity > config.swipeVelocityThreshold) {
        gesture.type = "swipe";
      }
    }

    // Emit gesture event
    emitInteractionEvent(
      "gesture",
      pointer.x,
      pointer.y,
      new CustomEvent("gesture"),
      gesture
    );

    resetGestureState();
  };

  /**
   * Reset gesture state
   */
  const resetGestureState = (): void => {
    state.currentGesture = {
      type: "none",
      isActive: false,
      startTime: 0,
      duration: 0,
      distance: 0,
      scale: 1,
      direction: "none",
    };
  };

  /**
   * Handle keyboard events for accessibility
   */
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (!state.isEnabled) return;

    // Basic keyboard navigation support
    switch (event.key) {
      case "Enter":
      case " ":
        // Simulate click on current focused card
        event.preventDefault();
        emitInteractionEvent("keyboard", 0, 0, event);
        break;
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
        // Navigation between cards
        event.preventDefault();
        emitInteractionEvent("keyboard", 0, 0, event);
        break;
    }
  };

  /**
   * Handle key up events
   */
  const handleKeyUp = (_event: KeyboardEvent): void => {
    if (!state.isEnabled) return;
    // Handle key release if needed
  };

  /**
   * Handle focus events
   */
  const handleFocus = (_event: FocusEvent): void => {
    // Canvas gained focus - enable keyboard navigation
  };

  /**
   * Handle blur events
   */
  const handleBlur = (_event: FocusEvent): void => {
    // Canvas lost focus - disable keyboard navigation
    resetGestureState();
    state.activePointers.clear();
  };

  /**
   * Add interaction callback
   */
  const addInteractionCallback = (
    type: InteractionType,
    callback: InteractionCallback
  ): void => {
    const typeCallbacks = callbacks.get(type);
    if (typeCallbacks) {
      typeCallbacks.add(callback);
    }
  };

  /**
   * Remove interaction callback
   */
  const removeInteractionCallback = (
    type: InteractionType,
    callback: InteractionCallback
  ): void => {
    const typeCallbacks = callbacks.get(type);
    if (typeCallbacks) {
      typeCallbacks.delete(callback);
    }
  };

  /**
   * Enable/disable interactions
   */
  const setEnabled = (enabled: boolean): void => {
    state.isEnabled = enabled;

    if (!enabled) {
      // Clear all active interactions
      state.activePointers.clear();
      resetGestureState();
      state.hoverCardIndex = null;
    }
  };

  /**
   * Set layout engine reference for hit detection
   */
  const setLayoutEngine = (engine: LayoutEngineRef): void => {
    layoutEngine.value = engine;
  };

  /**
   * Get interaction statistics
   */
  const getStats = () => ({
    activePointers: state.activePointers.size,
    currentGesture: readonly(state.currentGesture),
    hoverCardIndex: state.hoverCardIndex,
    lastInteractionTime: state.lastInteractionTime,
    isMultiTouch: isMultiTouch.value,
  });

  /**
   * Cleanup resources and event listeners
   */
  const cleanup = (): void => {
    if (state.canvasElement) {
      const element = state.canvasElement;

      // Remove all event listeners
      element.removeEventListener("mousedown", handleMouseDown);
      element.removeEventListener("mousemove", handleMouseMove);
      element.removeEventListener("mouseup", handleMouseUp);
      element.removeEventListener("mouseleave", handleMouseLeave);
      element.removeEventListener("click", handleClick);

      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("touchcancel", handleTouchCancel);

      element.removeEventListener("keydown", handleKeyDown);
      element.removeEventListener("keyup", handleKeyUp);
      element.removeEventListener("focus", handleFocus);
      element.removeEventListener("blur", handleBlur);
    }

    // Clear timeouts
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }

    // Clear state
    state.activePointers.clear();
    callbacks.clear();
    resetGestureState();

    state.isInitialized = false;
    state.canvasElement = null;
    layoutEngine.value = null;

    console.log("Canvas interactions cleaned up");
  };

  return {
    // State
    state: readonly(state),
    hasActivePointers,
    isMultiTouch,

    // Lifecycle
    initialize,
    cleanup,
    setEnabled,
    setLayoutEngine,

    // Event handling
    addInteractionCallback,
    removeInteractionCallback,

    // Utilities
    screenToCanvas,
    getCardIndexAtPosition,
    getStats,

    // Direct event handlers (for manual integration)
    handleClick,
    handleTouchStart,
    handleTouchEnd,
  };
};
