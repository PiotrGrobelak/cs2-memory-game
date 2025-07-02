import { ref, computed, onUnmounted } from "vue";
import type { Container, Sprite, FederatedPointerEvent } from "pixi.js";

export interface ParallaxTarget {
  sprite: Container | Sprite;
  originalX: number;
  originalY: number;
  depth: number; // 0-1, where 1 is maximum parallax effect
  isActive: boolean; // Whether parallax is currently applied to this card
}

export interface ParallaxState {
  enabled: boolean;
  strength: number;
}

export const useParallaxEffect = ({
  deviceType,
  isTouchDevice,
}: {
  deviceType: string;
  isTouchDevice: boolean;
}) => {
  const parallaxTargets = ref<Map<string, ParallaxTarget>>(new Map());
  const parallaxState = ref<ParallaxState>({
    enabled: true,
    strength: 1.0,
  });

  // Device orientation for mobile parallax
  const deviceOrientation = ref({
    alpha: 0, // Z-axis rotation
    beta: 0, // X-axis rotation (tilt forward/backward)
    gamma: 0, // Y-axis rotation (tilt left/right)
  });

  const isDesktop = computed(() => deviceType === "desktop");
  const isMobile = computed(() => deviceType === "mobile");
  const shouldUseMouseParallax = computed(
    () => isDesktop.value && !isTouchDevice
  );
  const shouldUseOrientationParallax = computed(
    () => isMobile.value && isTouchDevice
  );

  const initializeParallax = () => {
    if (shouldUseOrientationParallax.value) {
      setupOrientationParallax();
    }
  };

  const addParallaxTarget = (
    id: string,
    sprite: Container | Sprite,
    depth: number = 0.5
  ) => {
    parallaxTargets.value.set(id, {
      sprite,
      originalX: sprite.x,
      originalY: sprite.y,
      depth: Math.max(0, Math.min(1, depth)), // Clamp between 0-1
      isActive: false,
    });
  };

  const removeParallaxTarget = (id: string) => {
    const target = parallaxTargets.value.get(id);
    if (target) {
      // Reset position before removing
      target.sprite.x = target.originalX;
      target.sprite.y = target.originalY;
      parallaxTargets.value.delete(id);
    }
  };

  const applyParallaxToCard = (
    cardId: string,
    offsetX: number,
    offsetY: number
  ) => {
    const target = parallaxTargets.value.get(cardId);
    if (!target || !parallaxState.value.enabled) return;

    const effectiveStrength = target.depth * parallaxState.value.strength;

    // Calculate final offset
    const finalOffsetX = offsetX * effectiveStrength;
    const finalOffsetY = offsetY * effectiveStrength;

    // Apply offset to sprite position
    target.sprite.x = target.originalX + finalOffsetX;
    target.sprite.y = target.originalY + finalOffsetY;
    target.isActive = true;
  };

  const resetCardParallax = (cardId: string) => {
    const target = parallaxTargets.value.get(cardId);
    if (!target) return;

    // Reset to original position
    target.sprite.x = target.originalX;
    target.sprite.y = target.originalY;
    target.isActive = false;
  };

  const handleCardMouseMove = (
    cardId: string,
    event: MouseEvent,
    cardElement: HTMLElement | Container
  ) => {
    if (!shouldUseMouseParallax.value || !parallaxState.value.enabled) return;

    let bounds: DOMRect;

    // Get bounds depending on element type
    if (cardElement instanceof HTMLElement) {
      bounds = cardElement.getBoundingClientRect();
    } else {
      // For PIXI Container, we need to get canvas bounds and calculate card bounds
      const canvas = cardElement.parent?.parent as unknown as {
        canvas?: HTMLCanvasElement;
      };
      if (!canvas?.canvas) return;

      const canvasBounds = canvas.canvas.getBoundingClientRect();
      const target = parallaxTargets.value.get(cardId);
      if (!target) return;

      // Estimate card bounds (this is approximate for PIXI sprites)
      const cardWidth = 100; // Approximate card width
      const cardHeight = 140; // Approximate card height

      bounds = {
        left: canvasBounds.left + target.originalX - cardWidth / 2,
        top: canvasBounds.top + target.originalY - cardHeight / 2,
        width: cardWidth,
        height: cardHeight,
        right: canvasBounds.left + target.originalX + cardWidth / 2,
        bottom: canvasBounds.top + target.originalY + cardHeight / 2,
      } as DOMRect;
    }

    const mouseX = event.clientX - bounds.left;
    const mouseY = event.clientY - bounds.top;

    // Convert mouse position to parallax values (-1 to 1)
    const centerX = bounds.width / 2;
    const centerY = bounds.height / 2;
    const normalizedX = (mouseX - centerX) / centerX;
    const normalizedY = (mouseY - centerY) / centerY;

    // Apply subtle parallax effect (max 8px movement for individual cards)
    const maxOffset = 8;
    const offsetX = normalizedX * maxOffset;
    const offsetY = normalizedY * maxOffset;

    applyParallaxToCard(cardId, offsetX, offsetY);
  };

  const handlePixiPointerMove = (
    cardId: string,
    event: FederatedPointerEvent,
    cardElement: Container
  ) => {
    if (!parallaxState.value.enabled) return;

    // For mobile, only apply parallax if card is actively being touched
    if (isMobile.value) {
      const target = parallaxTargets.value.get(cardId);
      if (!target || !target.isActive) return;
    }

    // Get global position from PIXI pointer event
    const globalPos = event.global;

    // Get card bounds from container
    const cardBounds = cardElement.getLocalBounds();
    const cardGlobalPos = cardElement.toGlobal(cardBounds);

    // Calculate relative pointer position within the card
    const pointerX = globalPos.x - cardGlobalPos.x;
    const pointerY = globalPos.y - cardGlobalPos.y;

    // Convert to normalized coordinates (-1 to 1)
    const centerX = cardBounds.width / 2;
    const centerY = cardBounds.height / 2;
    const normalizedX = (pointerX - centerX) / centerX;
    const normalizedY = (pointerY - centerY) / centerY;

    // Apply subtle parallax effect
    const maxOffset = isMobile.value ? 6 : 8; // Slightly less on mobile
    const offsetX = normalizedX * maxOffset;
    const offsetY = normalizedY * maxOffset;

    applyParallaxToCard(cardId, offsetX, offsetY);
  };

  const handleCardTouchMove = (
    cardId: string,
    event: TouchEvent,
    cardElement: HTMLElement | Container
  ) => {
    if (!event.touches.length) return;

    // Convert touch to mouse event
    const touch = event.touches[0];
    const mouseEvent = new MouseEvent("mousemove", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    });

    handleCardMouseMove(cardId, mouseEvent, cardElement);
  };

  const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
    if (!shouldUseOrientationParallax.value || !parallaxState.value.enabled)
      return;

    // Update device orientation values
    deviceOrientation.value = {
      alpha: event.alpha || 0,
      beta: event.beta || 0,
      gamma: event.gamma || 0,
    };

    // Apply orientation-based parallax to all active cards
    const maxTilt = 20; // Maximum tilt angle to use for parallax
    const maxOffset = 6; // Maximum parallax offset for mobile

    const normalizedX = Math.max(
      -1,
      Math.min(1, deviceOrientation.value.gamma / maxTilt)
    );
    const normalizedY = Math.max(
      -1,
      Math.min(1, deviceOrientation.value.beta / maxTilt)
    );

    const offsetX = normalizedX * maxOffset;
    const offsetY = normalizedY * maxOffset;

    // Apply to all cards (global effect for mobile orientation)
    parallaxTargets.value.forEach((target, cardId) => {
      applyParallaxToCard(cardId, offsetX, offsetY);
    });
  };

  const setupOrientationParallax = () => {
    if (typeof window === "undefined") return;

    // Check if device orientation is supported
    if (typeof DeviceOrientationEvent !== "undefined") {
      // Request permission on iOS 13+
      const DeviceOrientationEventTyped =
        DeviceOrientationEvent as DeviceOrientationEventConstructor;
      if (
        typeof (
          DeviceOrientationEventTyped as unknown as DeviceOrientationEventWithPermission
        ).requestPermission === "function"
      ) {
        (
          DeviceOrientationEventTyped as unknown as DeviceOrientationEventWithPermission
        )
          .requestPermission()
          .then((response: string) => {
            if (response === "granted") {
              window.addEventListener(
                "deviceorientation",
                handleDeviceOrientation
              );
            }
          })
          .catch((error: Error) => {
            console.warn("Device orientation permission denied:", error);
          });
      } else {
        // Non-iOS devices
        window.addEventListener("deviceorientation", handleDeviceOrientation);
      }
    }
  };

  const setupCardEventListeners = (
    cardId: string,
    cardElement: Container | HTMLElement
  ) => {
    if (!parallaxState.value.enabled) return;

    const handleMouseEnter = () => {
      // Card hover started - no immediate parallax, wait for mouse move
    };

    const handleMouseLeave = () => {
      // Reset parallax when mouse leaves card
      resetCardParallax(cardId);
    };

    const handleMouseMove = (event: MouseEvent) => {
      handleCardMouseMove(cardId, event, cardElement);
    };

    const handleTouchStart = (event: TouchEvent) => {
      // Touch started - prepare for parallax, set initial position
      if (event.touches.length > 0) {
        const touch = event.touches[0];
        // Store initial touch position for potential parallax calculation
        const target = parallaxTargets.value.get(cardId);
        if (target) {
          target.isActive = true;
        }
      }
    };

    const handleTouchEnd = () => {
      // Reset parallax when touch ends
      resetCardParallax(cardId);
    };

    const handleTouchMove = (event: TouchEvent) => {
      event.preventDefault(); // Prevent scrolling
      handleCardTouchMove(cardId, event, cardElement);
    };

    // For PIXI Container
    if (cardElement && typeof (cardElement as Container).on === "function") {
      const pixiContainer = cardElement as Container;
      pixiContainer.interactive = true;

      // Basic pointer events that work for both mouse and touch
      pixiContainer.on("pointerover", handleMouseEnter);
      pixiContainer.on("pointerout", handleMouseLeave);
      pixiContainer.on("pointermove", (event: FederatedPointerEvent) => {
        handlePixiPointerMove(cardId, event, pixiContainer);
      });

      // Simple touch support - pointerdown/up works for both mouse and touch
      pixiContainer.on("pointerdown", (event: FederatedPointerEvent) => {
        const target = parallaxTargets.value.get(cardId);
        if (target && isMobile.value) {
          target.isActive = true;
        }
      });

      pixiContainer.on("pointerup", () => {
        if (isMobile.value) {
          resetCardParallax(cardId);
        }
      });

      pixiContainer.on("pointerupoutside", () => {
        if (isMobile.value) {
          resetCardParallax(cardId);
        }
      });
    }
    // For HTML Element
    else if (cardElement instanceof HTMLElement) {
      cardElement.addEventListener("mouseenter", handleMouseEnter);
      cardElement.addEventListener("mouseleave", handleMouseLeave);
      cardElement.addEventListener("mousemove", handleMouseMove);
      cardElement.addEventListener("touchstart", handleTouchStart, {
        passive: true,
      });
      cardElement.addEventListener("touchend", handleTouchEnd);
      cardElement.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
    }

    return () => {
      // Cleanup function
      if (cardElement && typeof (cardElement as Container).off === "function") {
        const pixiContainer = cardElement as Container;
        pixiContainer.off("pointerover", handleMouseEnter);
        pixiContainer.off("pointerout", handleMouseLeave);
        pixiContainer.off("pointermove");
        pixiContainer.off("pointerdown");
        pixiContainer.off("pointerup");
        pixiContainer.off("pointerupoutside");
      } else if (cardElement instanceof HTMLElement) {
        cardElement.removeEventListener("mouseenter", handleMouseEnter);
        cardElement.removeEventListener("mouseleave", handleMouseLeave);
        cardElement.removeEventListener("mousemove", handleMouseMove);
        cardElement.removeEventListener("touchstart", handleTouchStart);
        cardElement.removeEventListener("touchend", handleTouchEnd);
        cardElement.removeEventListener("touchmove", handleTouchMove);
      }
    };
  };

  const setParallaxStrength = (strength: number) => {
    parallaxState.value.strength = Math.max(0, Math.min(2, strength));
  };

  const enableParallax = () => {
    parallaxState.value.enabled = true;
  };

  const disableParallax = () => {
    parallaxState.value.enabled = false;

    // Reset all sprites to original positions
    parallaxTargets.value.forEach((target, cardId) => {
      resetCardParallax(cardId);
    });
  };

  const resetAllParallax = () => {
    parallaxTargets.value.forEach((target, cardId) => {
      resetCardParallax(cardId);
    });
  };

  // Cleanup
  const cleanup = () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("deviceorientation", handleDeviceOrientation);
    }

    // Reset all sprites and clear targets
    parallaxTargets.value.forEach((target, cardId) => {
      resetCardParallax(cardId);
    });
    parallaxTargets.value.clear();
  };

  // Lifecycle
  onUnmounted(() => {
    cleanup();
  });

  return {
    // State
    parallaxTargets: computed(() => parallaxTargets.value),
    parallaxState: computed(() => parallaxState.value),
    deviceOrientation: computed(() => deviceOrientation.value),

    // Computed properties
    isDesktop,
    isMobile,
    shouldUseMouseParallax,
    shouldUseOrientationParallax,

    // Methods
    initializeParallax,
    addParallaxTarget,
    removeParallaxTarget,
    applyParallaxToCard,
    resetCardParallax,
    setupCardEventListeners,
    handleCardMouseMove,
    handleCardTouchMove,
    handleDeviceOrientation,
    setParallaxStrength,
    enableParallax,
    disableParallax,
    resetAllParallax,
    cleanup,
  };
};

// Types for iOS DeviceOrientationEvent permission handling
interface DeviceOrientationEventConstructor {
  new (): DeviceOrientationEvent;
  prototype: DeviceOrientationEvent;
}

interface DeviceOrientationEventWithPermission {
  requestPermission(): Promise<string>;
}
