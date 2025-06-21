import { ref } from "vue";
import { Assets } from "pixi.js";
import type { GameCard } from "~/types/game";

export const useTextureLoader = () => {
  // Use unknown type to avoid PixiJS typing issues while maintaining type safety
  const textureCache = ref<Map<string, unknown>>(new Map());
  const isLoading = ref(false);
  const loadingProgress = ref({ loaded: 0, total: 0 });

  /**
   * Extract unique image URLs from cards
   */
  const extractImageUrls = (cards: GameCard[]): string[] => {
    const uniqueUrls = new Set<string>();
    cards.forEach((card) => {
      if (card.cs2Item?.imageUrl) {
        uniqueUrls.add(card.cs2Item.imageUrl);
      }
    });
    return Array.from(uniqueUrls);
  };

  /**
   * Preload card textures with progress tracking
   */
  const preloadCardTextures = async (
    cards: GameCard[],
    onProgress?: (loaded: number, total: number) => void
  ): Promise<void> => {
    console.log("🖼️ Starting texture preload for", cards.length, "cards");

    const imageUrls = extractImageUrls(cards);

    if (imageUrls.length === 0) {
      console.log("No images to preload");
      onProgress?.(0, 0);
      return;
    }

    console.log("📦 Preloading", imageUrls.length, "unique textures");

    isLoading.value = true;
    loadingProgress.value = { loaded: 0, total: imageUrls.length };
    onProgress?.(0, imageUrls.length);

    let loadedCount = 0;

    // Load textures using PixiJS Assets.load
    const loadPromises = imageUrls.map(async (imageUrl) => {
      try {
        // Skip if already cached
        if (textureCache.value.has(imageUrl)) {
          loadedCount++;
          loadingProgress.value = {
            loaded: loadedCount,
            total: imageUrls.length,
          };
          onProgress?.(loadedCount, imageUrls.length);
          return;
        }

        // Use PixiJS Assets.load to load the texture directly
        const texture = await Assets.load(imageUrl);

        if (texture) {
          textureCache.value.set(imageUrl, texture);
          console.log("✅ Preloaded texture:", imageUrl);
        }

        loadedCount++;
        loadingProgress.value = {
          loaded: loadedCount,
          total: imageUrls.length,
        };
        onProgress?.(loadedCount, imageUrls.length);
      } catch (error) {
        console.error("❌ Failed to preload texture:", imageUrl, error);
        loadedCount++;
        loadingProgress.value = {
          loaded: loadedCount,
          total: imageUrls.length,
        };
        onProgress?.(loadedCount, imageUrls.length);
        // Don't throw here - we want to continue loading other images
      }
    });

    // Wait for all textures to load (or fail)
    await Promise.allSettled(loadPromises);

    isLoading.value = false;
    console.log(
      "🎉 Texture preload completed. Cached textures:",
      textureCache.value.size
    );
  };

  /**
   * Get texture from cache
   */
  const getTexture = (imageUrl: string) => {
    return textureCache.value.get(imageUrl);
  };

  /**
   * Check if texture is cached
   */
  const hasTexture = (imageUrl: string): boolean => {
    return textureCache.value.has(imageUrl);
  };

  /**
   * Clear texture cache
   */
  const clearTextureCache = (): void => {
    console.log("🧹 Clearing texture cache");

    // Destroy textures to free memory
    textureCache.value.forEach((texture, url) => {
      try {
        // Type guard to check if texture has destroy method
        if (
          texture &&
          typeof texture === "object" &&
          "destroyed" in texture &&
          "destroy" in texture
        ) {
          const pixiTexture = texture as {
            destroyed: boolean;
            destroy: () => void;
          };
          if (!pixiTexture.destroyed) {
            pixiTexture.destroy();
          }
        }
      } catch (error) {
        console.warn(`Failed to destroy texture ${url}:`, error);
      }
    });

    textureCache.value.clear();
  };

  /**
   * Get loading statistics
   */
  const getLoadingStats = () => {
    return {
      isLoading: isLoading.value,
      progress: loadingProgress.value,
      cacheSize: textureCache.value.size,
    };
  };

  return {
    // State
    isLoading,
    loadingProgress,

    // Methods
    preloadCardTextures,
    getTexture,
    hasTexture,
    clearTextureCache,
    getLoadingStats,

    // Utils
    extractImageUrls,
  };
};
