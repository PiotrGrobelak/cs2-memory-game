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
        <p class="text-sm">Rendering 4 weapons...</p>
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
import { Application, Graphics, Sprite, type Texture } from "pixi.js";
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
const revealedTiles = ref<boolean[]>([false, false, false, false]); // Track which tiles are revealed

// Composables
const { getTexture, preloadCardTextures } = useTextureLoader();

// Methods
const getRarityColor = (rarity: string): string => {
  const colors: Record<string, string> = {
    consumer: "#b0c3d9",
    industrial: "#5e98d9",
    milSpec: "#4b69ff",
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
    milSpec: 0x4b69ff,
    restricted: 0x8847ff,
    classified: 0xd32ce6,
    covert: 0xeb4b4b,
    contraband: 0xe4ae39,
  };
  return colors[rarity] || colors.consumer;
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
    const cardWidth = cellWidth * 0.8; // 80% of cell width for padding
    const cardHeight = cellHeight * 0.8; // 80% of cell height for padding

    // Grid positions: top-left, top-right, bottom-left, bottom-right
    const positions = [
      { x: cellWidth * 0.5, y: cellHeight * 0.5 }, // Top-left
      { x: cellWidth * 1.5, y: cellHeight * 0.5 }, // Top-right
      { x: cellWidth * 0.5, y: cellHeight * 1.5 }, // Bottom-left
      { x: cellWidth * 1.5, y: cellHeight * 1.5 }, // Bottom-right
    ];

    // Render each weapon in its grid position
    props.weapons.forEach((weapon, index) => {
      if (index >= 4) return; // Only render first 4 weapons

      const position = positions[index];
      const rarityColor = getRarityColorHex(weapon.rarity);
      const isRevealed = revealedTiles.value[index];

      if (isRevealed) {
        // Show weapon when revealed
        // Create card background
        const cardBackground = new Graphics()
          .roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12)
          .fill({
            color: rarityColor,
            alpha: 0.15,
          })
          .stroke({
            color: rarityColor,
            width: 2,
          });

        cardBackground.position.set(position.x, position.y);
        pixiApp.value!.stage.addChild(cardBackground);

        // Create weapon image
        const texture = getTexture(weapon.imageUrl) as Texture;
        if (texture) {
          const weaponSprite = new Sprite(texture);

          // Calculate scale to fit within card with padding
          const maxWidth = cardWidth * 0.7;
          const maxHeight = cardHeight * 0.6;
          const scaleX = maxWidth / texture.width;
          const scaleY = maxHeight / texture.height;
          const scale = Math.min(scaleX, scaleY, 1);

          weaponSprite.scale.set(scale);
          weaponSprite.anchor.set(0.5);
          weaponSprite.position.set(position.x, position.y - 10);

          pixiApp.value!.stage.addChild(weaponSprite);

          // Add subtle glow effect
          const glowRadius =
            Math.max(weaponSprite.width, weaponSprite.height) * 0.4;
          const glowFilter = new Graphics().circle(0, 0, glowRadius).fill({
            color: rarityColor,
            alpha: 0.08,
          });

          glowFilter.position.set(position.x, position.y - 10);
          pixiApp.value!.stage.addChildAt(
            glowFilter,
            pixiApp.value!.stage.children.length - 1
          );
        }
      } else if (props.showCoverTiles) {
        // Show green cover tile when not revealed
        const coverTile = new Graphics()
          .roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12)
          .fill({
            color: 0x22c55e, // Green color
            alpha: 0.9,
          })
          .stroke({
            color: 0x16a34a, // Darker green border
            width: 3,
          });

        coverTile.position.set(position.x, position.y);
        coverTile.interactive = true;
        coverTile.cursor = "pointer";

        // Add click event to reveal tile
        coverTile.on("click", () => {
          revealedTiles.value[index] = true;
          renderWeapons();
        });
        coverTile.on("tap", () => {
          revealedTiles.value[index] = true;
          renderWeapons();
        });

        // Add hover effect
        coverTile.on("mouseover", () => {
          coverTile.alpha = 0.7;
        });
        coverTile.on("mouseout", () => {
          coverTile.alpha = 1;
        });

        pixiApp.value!.stage.addChild(coverTile);

        // Add tile number indicator
        const tileNumber = new Graphics()
          .roundRect(-20, -20, 40, 40, 8)
          .fill({
            color: 0xffffff,
            alpha: 0.9,
          })
          .stroke({
            color: 0x16a34a,
            width: 2,
          });

        tileNumber.position.set(position.x, position.y);
        pixiApp.value!.stage.addChild(tileNumber);

        // Add question mark text (using a simple graphic representation)
        const questionMark = new Graphics()
          .roundRect(-2, -10, 4, 15, 2)
          .fill(0x16a34a)
          .roundRect(-2, 5, 4, 4, 2)
          .fill(0x16a34a);

        questionMark.position.set(position.x, position.y);
        pixiApp.value!.stage.addChild(questionMark);
      }
    });

    console.log(
      `Rendered ${Math.min(props.weapons.length, 4)} weapons/tiles in 2x2 grid`
    );
  } catch (err) {
    console.error("Error rendering weapons:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Failed to render weapons";
    error.value = errorMessage;
  }
};

const cleanup = () => {
  if (pixiApp.value) {
    pixiApp.value.destroy(true);
    pixiApp.value = null;
  }
};

const resetTiles = () => {
  revealedTiles.value = [false, false, false, false];
  if (pixiApp.value) {
    renderWeapons();
  }
};

// Expose resetTiles method for parent component
defineExpose({
  resetTiles,
});

// Watch for weapons changes
watch(
  () => props.weapons,
  async () => {
    if (pixiApp.value && props.weapons.length > 0) {
      // Reset tiles when weapons change
      revealedTiles.value = [false, false, false, false];
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
