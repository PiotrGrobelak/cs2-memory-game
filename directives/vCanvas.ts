import type { DirectiveBinding, ObjectDirective } from "vue";
import { CanvasRenderer } from "~/services/CanvasRenderer";

interface GameEngine {
  init: (canvas: HTMLCanvasElement) => Promise<void>;
  start: () => void;
  stop?: () => void;
}

interface CanvasLayout {
  updateContainerSize?: (width: number, height: number) => void;
}

interface CanvasDirectiveValue {
  gameEngine?: GameEngine;
  canvasLayout?: CanvasLayout;
  onReady?: (renderer: CanvasRenderer) => void;
  onError?: (error: Error) => void;
  enableInteractions?: boolean;
  config?: {
    width?: number;
    height?: number;
    pixelRatio?: number;
  };
}

interface CanvasElement extends HTMLCanvasElement {
  _canvasRenderer?: CanvasRenderer;
  _canvasCleanup?: () => void;
}

const vCanvas: ObjectDirective<CanvasElement, CanvasDirectiveValue> = {
  async mounted(
    el: CanvasElement,
    binding: DirectiveBinding<CanvasDirectiveValue>,
  ) {
    try {
      const { gameEngine, canvasLayout, onReady, config } = binding.value || {};

      // Initialize canvas renderer
      const renderer = new CanvasRenderer(el, config);
      el._canvasRenderer = renderer;

      // Setup resize observer if canvasLayout is provided
      let resizeObserver: ResizeObserver | null = null;

      if (canvasLayout && typeof window !== "undefined") {
        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;

            // Update canvas size
            renderer.setSize(width, height);

            // Update layout if available
            if (canvasLayout.updateContainerSize) {
              canvasLayout.updateContainerSize(width, height);
            }
          }
        });

        // Observe the canvas element
        resizeObserver.observe(el);
      }

      // Initialize game engine if provided
      if (gameEngine) {
        await gameEngine.init(el);
        gameEngine.start();
      }

      // Store cleanup function
      el._canvasCleanup = () => {
        // Stop game engine
        if (gameEngine?.stop) {
          gameEngine.stop();
        }

        // Disconnect resize observer
        if (resizeObserver) {
          resizeObserver.disconnect();
        }

        // Cleanup renderer
        renderer.cleanup();

        // Clear references
        delete el._canvasRenderer;
        delete el._canvasCleanup;
      };

      // Call ready callback
      onReady?.(renderer);

      console.log("Canvas directive: Canvas initialized successfully");
    } catch (error) {
      const { onError } = binding.value || {};
      const errorMessage =
        error instanceof Error
          ? error
          : new Error("Unknown canvas initialization error");
      console.error(
        "Canvas directive: Failed to initialize canvas:",
        errorMessage,
      );
      onError?.(errorMessage);
    }
  },

  updated(el: CanvasElement, binding: DirectiveBinding<CanvasDirectiveValue>) {
    const { config } = binding.value || {};

    // Update canvas configuration if changed
    if (config && el._canvasRenderer) {
      if (config.width && config.height) {
        el._canvasRenderer.setSize(config.width, config.height);
      }
    }
  },

  beforeUnmount(el: CanvasElement) {
    // Call cleanup function if it exists
    if (el._canvasCleanup) {
      el._canvasCleanup();
    }
  },

  unmounted(el: CanvasElement) {
    // Ensure cleanup even if beforeUnmount didn't run
    if (el._canvasRenderer) {
      el._canvasRenderer.cleanup();
      delete el._canvasRenderer;
    }

    if (el._canvasCleanup) {
      delete el._canvasCleanup;
    }

    console.log("Canvas directive: Canvas unmounted and cleaned up");
  },
};

export default vCanvas;

// Export for plugin registration
export { vCanvas };
