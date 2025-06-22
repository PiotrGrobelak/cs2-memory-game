import { ref } from "vue";
import { Assets } from "pixi.js";
import type { GameCard } from "~/types/game";

export const useTextureLoader = () => {
  const textureCache = ref<Map<string, unknown>>(new Map());
  const isLoading = ref(false);
  const loadingProgress = ref({ loaded: 0, total: 0 });

  const extractImageUrls = (cards: GameCard[]): string[] => {
    const uniqueUrls = new Set<string>();
    cards.forEach((card) => {
      if (card.cs2Item?.imageUrl) {
        uniqueUrls.add(card.cs2Item.imageUrl);
      }
    });
    return Array.from(uniqueUrls);
  };

  const preloadCardTextures = async (
    cards: GameCard[],
    onProgress?: (loaded: number, total: number) => void
  ): Promise<void> => {
    console.log("🖼️ Starting texture preload for", cards.length, "cards");

    const imageUrls = extractImageUrls(cards);

    if (imageUrls.length === 0) {
      onProgress?.(0, 0);
      return;
    }

    isLoading.value = true;
    loadingProgress.value = { loaded: 0, total: imageUrls.length };
    onProgress?.(0, imageUrls.length);

    let loadedCount = 0;

    const loadPromises = imageUrls.map(async (imageUrl) => {
      try {
        if (textureCache.value.has(imageUrl)) {
          loadedCount++;
          loadingProgress.value = {
            loaded: loadedCount,
            total: imageUrls.length,
          };
          onProgress?.(loadedCount, imageUrls.length);
          return;
        }

        const texture = await Assets.load(imageUrl);

        if (texture) {
          textureCache.value.set(imageUrl, texture);
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
      }
    });

    await Promise.allSettled(loadPromises);

    isLoading.value = false;
    console.log(
      "🎉 Texture preload completed. Cached textures:",
      textureCache.value.size
    );
  };

  const getTexture = (imageUrl: string) => {
    return textureCache.value.get(imageUrl);
  };

  const hasTexture = (imageUrl: string): boolean => {
    return textureCache.value.has(imageUrl);
  };

  const clearTextureCache = (): void => {
    console.log("🧹 Clearing texture cache");

    textureCache.value.forEach((texture, url) => {
      try {
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
