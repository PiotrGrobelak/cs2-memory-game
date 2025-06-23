<template>
  <div
    ref="canvasContainer"
    class="weapon-grid-container w-full h-full relative"
    :class="{ loading: isLoading }"
  >
    <!-- Loading overlay -->
    <div
      v-if="isLoading"
      class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 rounded-lg"
    >
      <div class="text-white text-center">
        <i class="pi pi-spin pi-spinner text-2xl mb-2" />
        <p class="text-sm">Rendering animated cards...</p>
      </div>
    </div>

    <!-- Error overlay -->
    <div
      v-if="error"
      class="absolute inset-0 bg-red-500 bg-opacity-20 flex items-center justify-center z-10 rounded-lg"
    >
      <div class="text-red-800 text-center bg-white p-3 rounded">
        <i class="pi pi-exclamation-triangle text-xl mb-1" />
        <p class="text-sm">{{ error }}</p>
      </div>
    </div>

    <!-- Animation info overlay -->
    <div
      v-if="weapons.length > 0 && !isLoading && !error"
      class="absolute top-4 left-4 right-4 bg-black bg-opacity-70 text-white p-3 rounded-lg z-10"
    >
      <div class="grid grid-cols-1 gap-2 text-xs">
        <div class="text-center">
          <span class="text-purple-400 font-bold text-lg">🎯 All Cards:</span>
          <span class="text-white">Elastic Bounce Effect</span>
        </div>
        <div class="text-center text-gray-300">
          Click any card to see the bouncy animation!
        </div>
      </div>
    </div>

    <!-- Weapons info overlay -->
    <div
      v-if="weapons.length > 0 && !isLoading && !error"
      class="absolute bottom-4 left-4 right-4 bg-black bg-opacity-70 text-white p-3 rounded-lg z-10"
    >
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div
          v-for="weapon in weapons"
          :key="weapon.id"
          class="flex items-center gap-2"
        >
          <span
            class="w-2 h-2 rounded-full"
            :style="{ backgroundColor: getRarityColor(weapon.rarity) }"
          ></span>
          <span class="truncate">{{ weapon.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import {
  Application,
  Graphics,
  Sprite,
  Container,
  type Texture,
} from "pixi.js";
import type { CS2Item } from "~/types/game";
import { useTextureLoader } from "~/composables/engine/useTextureLoader";

// Props
interface Props {
  weapons: CS2Item[];
  canvasWidth?: number;
  canvasHeight?: number;
  showCoverTiles?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  canvasWidth: 1200,
  canvasHeight: 600,
  showCoverTiles: true,
});

// Emits
interface Emits {
  (e: "canvas-ready"): void;
  (e: "canvas-error", error: string): void;
}

const emit = defineEmits<Emits>();

// Refs
const canvasContainer = ref<HTMLDivElement>();
const isLoading = ref(false);
const error = ref<string | null>(null);
const pixiApp = ref<Application | null>(null);
const revealedTiles = ref<boolean[]>([false, false, false, false]);
const cardContainers = ref<Container[]>([]);
const isAnimating = ref<boolean[]>([false, false, false, false]);
const animationFrameIds = ref<number[]>([]);

// Composables
const { getTexture, preloadCardTextures } = useTextureLoader();

// Animation types for each card - all using bounce effect
const animationTypes = ["bounce", "bounce", "bounce", "bounce"] as const;

// Methods
const getRarityColor = (rarity: string): string => {
  const colors: Record<string, string> = {
    consumer: "#b0c3d9",
    industrial: "#5e98d9",
    milspec: "#4b69ff",
    mil_spec: "#4b69ff",
    restricted: "#8847ff",
    classified: "#d32ce6",
    covert: "#eb4b4b",
    contraband: "#e4ae39",
  };
  return colors[rarity] || colors.consumer;
};

const getRarityColorHex = (rarity: string): number => {
  const colors: Record<string, number> = {
    consumer: 0xb0c3d9,
    industrial: 0x5e98d9,
    milspec: 0x4b69ff,
    mil_spec: 0x4b69ff,
    restricted: 0x8847ff,
    classified: 0xd32ce6,
    covert: 0xeb4b4b,
    contraband: 0xe4ae39,
  };
  return colors[rarity] || colors.consumer;
};

// Easing function for bounce animation
const easeOutElastic = (t: number): number => {
  if (t === 0) return 0;
  if (t === 1) return 1;
  const p = 0.3;
  const s = p / 4;
  return Math.pow(2, -10 * t) * Math.sin(((t - s) * (2 * Math.PI)) / p) + 1;
};

// Safe property setters with validation
const safeSetAlpha = (container: Container | null, value: number): boolean => {
  try {
    if (!container || container.destroyed) return false;

    // Check if alpha property is accessible
    if (typeof container.alpha !== "number" && container.alpha !== undefined) {
      return false;
    }

    container.alpha = value;
    return true;
  } catch (error) {
    console.warn("Failed to set alpha:", error);
    return false;
  }
};

const safeSetScale = (
  container: Container | null,
  x: number,
  y?: number
): boolean => {
  try {
    if (!container || container.destroyed || !container.scale) return false;

    // Additional check for scale object validity
    if (typeof container.scale.set !== "function") {
      return false;
    }

    // Validate scale values first
    if (!isFinite(x) || (y !== undefined && !isFinite(y))) {
      return false;
    }

    // Test if scale operations work by attempting a safe operation
    try {
      // For single value, we need to get current Y value safely
      if (y === undefined) {
        // Try to read current Y value
        const currentX = container.scale.x;
        const currentY = container.scale.y;

        // Validate the current values
        if (typeof currentX !== "number" || typeof currentY !== "number") {
          return false;
        }

        // Use scale.set with both values
        container.scale.set(x, currentY);
      } else {
        // Use scale.set with both provided values
        container.scale.set(x, y);
      }

      return true;
    } catch {
      // If scale operations fail, return false silently
      return false;
    }
  } catch (error) {
    // Only log unexpected errors, not scale operation failures
    if (error instanceof TypeError && error.message.includes("_onUpdate")) {
      // This is the known PixiJS internal error, handle silently
      console.log("PixiJS internal error, handling silently");
      return false;
    }
    console.warn("Failed to set scale:", error);
    return false;
  }
};

// Bounce animation function for all cards

const animateBounceFlip = async (
  cardIndex: number,
  frontContainer: Container,
  backContainer: Container
): Promise<void> => {
  return new Promise((resolve) => {
    const duration = 1000; // ms
    const startTime = Date.now();
    let frameId: number;

    const animate = () => {
      // Check if containers are still valid and app exists
      if (
        !backContainer ||
        !frontContainer ||
        backContainer.destroyed ||
        frontContainer.destroyed ||
        !pixiApp.value
      ) {
        resolve();
        return;
      }

      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Use safe functions for all property modifications
      if (progress < 0.4) {
        // Bounce effect on back
        const bounceProgress = progress / 0.4;
        const bounceScale = Math.max(
          0.1,
          1 + Math.sin(bounceProgress * Math.PI * 3) * 0.2
        );
        safeSetScale(backContainer, bounceScale);
        safeSetAlpha(backContainer, 1 - bounceProgress);
        safeSetAlpha(frontContainer, 0);
        safeSetScale(frontContainer, 1);
      } else {
        // Elastic entrance for front
        const elasticProgress = (progress - 0.4) / 0.6;
        const elasticScale = Math.max(0.1, easeOutElastic(elasticProgress));
        safeSetScale(frontContainer, elasticScale);
        safeSetAlpha(frontContainer, elasticProgress);
        safeSetAlpha(backContainer, 0);
      }

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
        animationFrameIds.value[cardIndex] = frameId;
      } else {
        // Ensure final state using safe functions
        safeSetAlpha(backContainer, 0);
        safeSetAlpha(frontContainer, 1);
        safeSetScale(frontContainer, 1);
        safeSetScale(backContainer, 1);
        animationFrameIds.value[cardIndex] = 0;
        resolve();
      }
    };

    animate();
  });
};

const performFlipAnimation = async (cardIndex: number): Promise<void> => {
  if (isAnimating.value[cardIndex] || !cardContainers.value[cardIndex]) {
    console.log(
      `Animation blocked for card ${cardIndex}: already animating or container missing`
    );
    return;
  }

  isAnimating.value[cardIndex] = true;

  const cardContainer = cardContainers.value[cardIndex];

  // Validate container structure
  if (
    !cardContainer ||
    cardContainer.destroyed ||
    cardContainer.children.length < 2
  ) {
    console.error(`Invalid card container for card ${cardIndex}`);
    isAnimating.value[cardIndex] = false;
    return;
  }

  const backContainer = cardContainer.children[0] as Container; // Cover tile
  const frontContainer = cardContainer.children[1] as Container; // Weapon content

  // Additional validation
  if (
    !backContainer ||
    !frontContainer ||
    backContainer.destroyed ||
    frontContainer.destroyed
  ) {
    console.error(`Invalid child containers for card ${cardIndex}`);
    isAnimating.value[cardIndex] = false;
    return;
  }

  const animationType = animationTypes[cardIndex];
  console.log(`Starting ${animationType} animation for card ${cardIndex}`);

  try {
    // All cards use bounce animation
    await animateBounceFlip(cardIndex, frontContainer, backContainer);

    revealedTiles.value[cardIndex] = true;
    console.log(`Bounce animation completed for card ${cardIndex}`);
  } catch (err) {
    console.error(`Animation error for card ${cardIndex}:`, err);
  } finally {
    isAnimating.value[cardIndex] = false;
  }
};

const initializePixi = async () => {
  if (!canvasContainer.value) return;

  try {
    isLoading.value = true;
    error.value = null;

    // Create PixiJS application
    pixiApp.value = new Application();
    await pixiApp.value.init({
      width: props.canvasWidth,
      height: props.canvasHeight,
      backgroundColor: 0x1a1a2e,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
    });

    // Append canvas to container
    canvasContainer.value.appendChild(pixiApp.value.canvas);

    await renderWeapons();

    emit("canvas-ready");
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Failed to initialize canvas";
    error.value = errorMessage;
    emit("canvas-error", errorMessage);
    console.error("Pixi initialization error:", err);
  } finally {
    isLoading.value = false;
  }
};

const renderWeapons = async () => {
  if (!pixiApp.value || props.weapons.length === 0) return;

  try {
    // Clear existing content
    pixiApp.value.stage.removeChildren();
    cardContainers.value = [];

    // Preload all weapon textures
    const mockCards = props.weapons.map((weapon, index) => ({
      id: `mock-${index}`,
      pairId: `mock-${index}`,
      cs2Item: weapon,
      state: "hidden" as const,
      position: { x: 0, y: 0 },
    }));

    await preloadCardTextures(mockCards);

    // Calculate grid positions (2x2)
    const cellWidth = props.canvasWidth / 2;
    const cellHeight = props.canvasHeight / 2;
    const cardWidth = cellWidth * 0.8;
    const cardHeight = cellHeight * 0.8;

    // Grid positions
    const positions = [
      { x: cellWidth * 0.5, y: cellHeight * 0.5 }, // Top-left
      { x: cellWidth * 1.5, y: cellHeight * 0.5 }, // Top-right
      { x: cellWidth * 0.5, y: cellHeight * 1.5 }, // Bottom-left
      { x: cellWidth * 1.5, y: cellHeight * 1.5 }, // Bottom-right
    ];

    // Animation colors for each card - all purple for bounce effect
    const animationColors = [0xa855f7, 0xa855f7, 0xa855f7, 0xa855f7]; // All Purple

    // Render each weapon card
    props.weapons.forEach(async (weapon, index) => {
      if (index >= 4) return;

      const position = positions[index];
      const rarityColor = getRarityColorHex(weapon.rarity);
      const animationColor = animationColors[index];

      // Create main card container
      const cardContainer = new Container();
      cardContainer.position.set(position.x, position.y);
      cardContainers.value.push(cardContainer);

      // Create back side (cover tile) container
      const backContainer = new Container();

      // Create cover tile with animation-specific styling
      const coverTile = new Graphics()
        .roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12)
        .fill({
          color: animationColor,
          alpha: 0.9,
        })
        .stroke({
          color: animationColor,
          width: 3,
        });

      // Add animation type label
      const labelBg = new Graphics()
        .roundRect(-60, -cardHeight / 2 + 10, 120, 25, 8)
        .fill({
          color: 0x000000,
          alpha: 0.7,
        });

      backContainer.addChild(coverTile);
      backContainer.addChild(labelBg);

      // Add click interaction
      coverTile.interactive = true;
      coverTile.cursor = "pointer";

      coverTile.on("click", () => {
        if (!isAnimating.value[index]) {
          performFlipAnimation(index);
        }
      });

      coverTile.on("tap", () => {
        if (!isAnimating.value[index]) {
          performFlipAnimation(index);
        }
      });

      // Add hover effect
      coverTile.on("mouseover", () => {
        if (!isAnimating.value[index]) {
          coverTile.alpha = 0.7;
        }
      });

      coverTile.on("mouseout", () => {
        if (!isAnimating.value[index]) {
          coverTile.alpha = 0.9;
        }
      });

      // Create front side (weapon) container
      const frontContainer = new Container();
      frontContainer.alpha = revealedTiles.value[index] ? 1 : 0;

      // Create weapon card background
      const weaponBg = new Graphics()
        .roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12)
        .fill({
          color: rarityColor,
          alpha: 0.15,
        })
        .stroke({
          color: rarityColor,
          width: 2,
        });

      frontContainer.addChild(weaponBg);

      // Create weapon sprite
      const texture = (await getTexture(weapon.imageUrl)) as unknown as Texture;
      if (texture) {
        const weaponSprite = new Sprite(texture);

        // Calculate scale to fit within card
        const maxWidth = cardWidth * 0.7;
        const maxHeight = cardHeight * 0.6;
        const scaleX = maxWidth / texture.width;
        const scaleY = maxHeight / texture.height;
        const scale = Math.min(scaleX, scaleY, 1);

        weaponSprite.scale.set(scale);
        weaponSprite.anchor.set(0.5);
        weaponSprite.position.set(0, -10);

        frontContainer.addChild(weaponSprite);

        // Add glow effect
        const glowRadius =
          Math.max(weaponSprite.width, weaponSprite.height) * 0.4;
        const glowFilter = new Graphics().circle(0, -10, glowRadius).fill({
          color: rarityColor,
          alpha: 0.08,
        });

        frontContainer.addChild(glowFilter);
      }

      // Add containers to card
      cardContainer.addChild(backContainer);
      cardContainer.addChild(frontContainer);

      // Add to stage
      pixiApp.value!.stage.addChild(cardContainer);
    });

    console.log(`Rendered ${Math.min(props.weapons.length, 4)} animated cards`);
  } catch (err) {
    console.error("Error rendering weapons:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Failed to render weapons";
    error.value = errorMessage;
  }
};

const stopAllAnimations = () => {
  // Cancel all animation frames
  animationFrameIds.value.forEach((frameId) => {
    if (frameId > 0) {
      cancelAnimationFrame(frameId);
    }
  });
  animationFrameIds.value = [0, 0, 0, 0];
  isAnimating.value = [false, false, false, false];
};

const cleanup = () => {
  // Stop all animations first
  stopAllAnimations();

  if (pixiApp.value) {
    pixiApp.value.destroy(true);
    pixiApp.value = null;
  }
  cardContainers.value = [];
};

const resetTiles = () => {
  revealedTiles.value = [false, false, false, false];
  isAnimating.value = [false, false, false, false];
  if (pixiApp.value) {
    renderWeapons();
  }
};

// Expose methods for parent component
defineExpose({
  resetTiles,
});

// Watch for weapons changes
watch(
  () => props.weapons,
  async () => {
    if (pixiApp.value && props.weapons.length > 0) {
      revealedTiles.value = [false, false, false, false];
      isAnimating.value = [false, false, false, false];
      await renderWeapons();
    }
  },
  { deep: true }
);

// Lifecycle
onMounted(async () => {
  await nextTick();
  if (props.weapons.length > 0) {
    await initializePixi();
  }
});

onUnmounted(() => {
  cleanup();
});
</script>

<style scoped>
.weapon-grid-container {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.weapon-grid-container.loading {
  opacity: 0.8;
}
</style>
