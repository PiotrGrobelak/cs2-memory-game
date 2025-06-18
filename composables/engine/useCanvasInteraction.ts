import { ref, type Ref, onUnmounted } from "vue";
import type { CanvasRenderer } from "~/services/CanvasRenderer";

interface MousePosition {
  x: number;
  y: number;
}

interface InteractionCallbacks {
  onCanvasClick?: (coords: MousePosition, cardId?: string) => void;
  onMouseMove?: (
    coords: MousePosition,
    normalizedCoords: MousePosition,
  ) => void;
  onTouchStart?: (coords: MousePosition) => void;
  onTouchEnd?: (coords: MousePosition) => void;
}

export const useCanvasInteraction = (
  canvas: Ref<HTMLCanvasElement | null>,
  renderer: Ref<CanvasRenderer | null>,
  callbacks: InteractionCallbacks = {},
) => {
  // State
  const mousePosition = ref<MousePosition>({ x: 0, y: 0 });
  const normalizedMousePosition = ref<MousePosition>({ x: 0, y: 0 });
  const isMouseDown = ref(false);
  const touchActive = ref(false);

  // Event listeners storage for cleanup
  const eventListeners: Array<{
    element: HTMLElement | Document;
    event: string;
    handler: EventListener;
  }> = [];

  /**
   * Add event listener and store reference for cleanup
   */
  const addEventListener = (
    element: HTMLElement | Document,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ) => {
    element.addEventListener(event, handler, options);
    eventListeners.push({ element, event, handler });
  };

  /**
   * Get canvas coordinates from screen coordinates
   */
  const getCanvasCoordinates = (
    screenX: number,
    screenY: number,
  ): MousePosition => {
    if (!canvas.value || !renderer.value) {
      return { x: 0, y: 0 };
    }

    return renderer.value.screenToCanvas(screenX, screenY);
  };

  /**
   * Get normalized coordinates (-1 to 1) for parallax effects
   */
  const getNormalizedCoordinates = (
    screenX: number,
    screenY: number,
  ): MousePosition => {
    if (!canvas.value) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.value.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    return {
      x: (screenX - rect.left - centerX) / centerX,
      y: (screenY - rect.top - centerY) / centerY,
    };
  };

  /**
   * Handle canvas click events
   */
  const handleCanvasClick = (event: MouseEvent) => {
    if (!canvas.value || !renderer.value) return;

    event.preventDefault();
    const coords = getCanvasCoordinates(event.clientX, event.clientY);

    if (renderer.value.isPointInCanvas(coords.x, coords.y)) {
      callbacks.onCanvasClick?.(coords);
    }
  };

  /**
   * Handle mouse move events
   */
  const handleMouseMove = (event: MouseEvent) => {
    if (!canvas.value || !renderer.value) return;

    const coords = getCanvasCoordinates(event.clientX, event.clientY);
    const normalizedCoords = getNormalizedCoordinates(
      event.clientX,
      event.clientY,
    );

    mousePosition.value = coords;
    normalizedMousePosition.value = normalizedCoords;

    callbacks.onMouseMove?.(coords, normalizedCoords);
  };

  /**
   * Handle mouse down events
   */
  const handleMouseDown = (event: MouseEvent) => {
    if (!canvas.value) return;

    event.preventDefault();
    isMouseDown.value = true;
  };

  /**
   * Handle mouse up events
   */
  const handleMouseUp = (event: MouseEvent) => {
    if (!canvas.value) return;

    event.preventDefault();
    isMouseDown.value = false;
  };

  /**
   * Handle touch start events
   */
  const handleTouchStart = (event: TouchEvent) => {
    if (!canvas.value || !renderer.value) return;

    event.preventDefault();
    touchActive.value = true;

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const coords = getCanvasCoordinates(touch.clientX, touch.clientY);

      if (renderer.value.isPointInCanvas(coords.x, coords.y)) {
        callbacks.onTouchStart?.(coords);

        // Simulate click for touch devices
        callbacks.onCanvasClick?.(coords);
      }
    }
  };

  /**
   * Handle touch end events
   */
  const handleTouchEnd = (event: TouchEvent) => {
    if (!canvas.value) return;

    event.preventDefault();
    touchActive.value = false;

    callbacks.onTouchEnd?.({ x: 0, y: 0 });
  };

  /**
   * Handle touch move events
   */
  const handleTouchMove = (event: TouchEvent) => {
    if (!canvas.value || !renderer.value || !touchActive.value) return;

    event.preventDefault();

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
      const normalizedCoords = getNormalizedCoordinates(
        touch.clientX,
        touch.clientY,
      );

      mousePosition.value = coords;
      normalizedMousePosition.value = normalizedCoords;

      callbacks.onMouseMove?.(coords, normalizedCoords);
    }
  };

  /**
   * Setup event listeners on canvas
   */
  const setupEventListeners = () => {
    if (!canvas.value) return;

    // Mouse events
    addEventListener(canvas.value, "click", handleCanvasClick as EventListener);
    addEventListener(
      canvas.value,
      "mousemove",
      handleMouseMove as EventListener,
    );
    addEventListener(
      canvas.value,
      "mousedown",
      handleMouseDown as EventListener,
    );
    addEventListener(canvas.value, "mouseup", handleMouseUp as EventListener);

    // Touch events
    addEventListener(
      canvas.value,
      "touchstart",
      handleTouchStart as unknown as EventListener,
      { passive: false },
    );
    addEventListener(
      canvas.value,
      "touchend",
      handleTouchEnd as unknown as EventListener,
      { passive: false },
    );
    addEventListener(
      canvas.value,
      "touchmove",
      handleTouchMove as unknown as EventListener,
      { passive: false },
    );

    // Prevent context menu on canvas
    addEventListener(canvas.value, "contextmenu", (e) => e.preventDefault());

    // Global mouse up to handle mouse leaving canvas
    addEventListener(document, "mouseup", handleMouseUp as EventListener);
  };

  /**
   * Remove all event listeners
   */
  const cleanupEventListeners = () => {
    eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    eventListeners.length = 0;
  };

  /**
   * Check if point is within canvas bounds
   */
  const isPointInCanvas = (x: number, y: number): boolean => {
    return renderer.value?.isPointInCanvas(x, y) ?? false;
  };

  /**
   * Get current interaction state
   */
  const getInteractionState = () => {
    return {
      mousePosition: mousePosition.value,
      normalizedMousePosition: normalizedMousePosition.value,
      isMouseDown: isMouseDown.value,
      touchActive: touchActive.value,
    };
  };

  // Cleanup on unmount
  onUnmounted(() => {
    cleanupEventListeners();
  });

  return {
    // State
    mousePosition,
    normalizedMousePosition,
    isMouseDown,
    touchActive,

    // Methods
    getCanvasCoordinates,
    getNormalizedCoordinates,
    setupEventListeners,
    cleanupEventListeners,
    isPointInCanvas,
    getInteractionState,

    // Direct event handlers (for manual setup)
    handleCanvasClick,
    handleMouseMove,
    handleTouchStart,
    handleTouchEnd,
  };
};
