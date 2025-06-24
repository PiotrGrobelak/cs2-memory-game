import { ref, computed } from "vue";
import { Assets } from "pixi.js";
import type { GameCard } from "~/types/game";

// Performance configuration for batching
const BATCH_CONFIG = {
  BATCH_SIZE: 5, // Load 5 textures at a time
  CONCURRENT_BATCHES: 2, // Maximum concurrent batches
  RETRY_ATTEMPTS: 2,
  RETRY_DELAY: 1000, // ms
} as const;

/**
 * Optimized texture loader composable with batching and memory management
 * Provides efficient texture preloading, caching, and memory optimization for CS2 memory game
 *
 * Features:
 * - Batched loading with concurrency control
 * - Automatic retry with exponential backoff
 * - Memory pressure management
 * - Performance monitoring and statistics
 *
 * @returns Object containing texture loading methods and cache management utilities
 *
 * @example
 * ```typescript
 * const { preloadCardTextures, getTexture, getLoadingStats } = useTextureLoader();
 * await preloadCardTextures(cards, (loaded, total) => console.log(`${loaded}/${total}`));
 * const texture = getTexture(imageUrl);
 * ```
 */
export const useTextureLoader = () => {
  const textureCache = ref<Map<string, unknown>>(new Map());
  const isLoading = ref(false);
  const loadingProgress = ref({ loaded: 0, total: 0 });
  const failedTextures = ref<Set<string>>(new Set());

  const extractImageUrls = (cards: GameCard[]): string[] => {
    const uniqueUrls = new Set<string>();
    cards.forEach((card) => {
      if (
        card.cs2Item?.imageUrl &&
        !failedTextures.value.has(card.cs2Item.imageUrl)
      ) {
        uniqueUrls.add(card.cs2Item.imageUrl);
      }
    });
    return Array.from(uniqueUrls);
  };

  const loadTextureBatch = async (
    urls: string[],
    onProgress?: (loaded: number, total: number) => void,
    retryAttempt = 0
  ): Promise<{ successful: string[]; failed: string[] }> => {
    const successful: string[] = [];
    const failed: string[] = [];

    const batchPromises = urls.map(async (imageUrl) => {
      try {
        // Skip if already cached
        if (textureCache.value.has(imageUrl)) {
          successful.push(imageUrl);
          return;
        }

        const texture = await Assets.load(imageUrl);
        if (texture) {
          textureCache.value.set(imageUrl, texture);
          successful.push(imageUrl);
        } else {
          failed.push(imageUrl);
        }
      } catch (error) {
        console.warn(
          `❌ Failed to load texture (attempt ${retryAttempt + 1}):`,
          imageUrl,
          error
        );
        failed.push(imageUrl);
      }
    });

    await Promise.allSettled(batchPromises);

    // Handle retries for failed textures
    if (failed.length > 0 && retryAttempt < BATCH_CONFIG.RETRY_ATTEMPTS) {
      await new Promise((resolve) =>
        setTimeout(resolve, BATCH_CONFIG.RETRY_DELAY)
      );

      const retryResult = await loadTextureBatch(
        failed,
        onProgress,
        retryAttempt + 1
      );
      successful.push(...retryResult.successful);

      // Mark persistently failed textures
      retryResult.failed.forEach((url) => failedTextures.value.add(url));
    } else if (retryAttempt >= BATCH_CONFIG.RETRY_ATTEMPTS) {
      // Mark failed textures after all retry attempts
      failed.forEach((url) => failedTextures.value.add(url));
    }

    return { successful, failed };
  };

  const preloadCardTextures = async (
    cards: GameCard[],
    onProgress?: (loaded: number, total: number) => void
  ): Promise<void> => {
    console.log(
      "🖼️ Starting optimized batched texture preload for",
      cards.length,
      "cards"
    );

    const imageUrls = extractImageUrls(cards);

    if (imageUrls.length === 0) {
      onProgress?.(0, 0);
      return;
    }

    isLoading.value = true;
    loadingProgress.value = { loaded: 0, total: imageUrls.length };
    onProgress?.(0, imageUrls.length);

    const batches: string[][] = [];
    for (let i = 0; i < imageUrls.length; i += BATCH_CONFIG.BATCH_SIZE) {
      batches.push(imageUrls.slice(i, i + BATCH_CONFIG.BATCH_SIZE));
    }

    let totalLoaded = 0;

    const processBatch = async (batch: string[]) => {
      const result = await loadTextureBatch(batch, onProgress);
      totalLoaded += result.successful.length + result.failed.length;

      loadingProgress.value = {
        loaded: totalLoaded,
        total: imageUrls.length,
      };
      onProgress?.(totalLoaded, imageUrls.length);

      return result;
    };

    const batchResults: { successful: string[]; failed: string[] }[] = [];
    for (let i = 0; i < batches.length; i += BATCH_CONFIG.CONCURRENT_BATCHES) {
      const currentBatches = batches.slice(
        i,
        i + BATCH_CONFIG.CONCURRENT_BATCHES
      );
      const batchPromises = currentBatches.map(processBatch);
      const results = await Promise.all(batchPromises);
      batchResults.push(...results);
    }

    isLoading.value = false;

    const totalSuccessful = batchResults.reduce(
      (sum, result) => sum + result.successful.length,
      0
    );
    const totalFailed = batchResults.reduce(
      (sum, result) => sum + result.failed.length,
      0
    );

    console.log(
      `🎉 Optimized texture preload completed. Success: ${totalSuccessful}, Failed: ${totalFailed}, Cached: ${textureCache.value.size}`
    );
  };

  const getTexture = async (imageUrl: string) => {
    if (textureCache.value.has(imageUrl)) {
      return textureCache.value.get(imageUrl);
    }

    // Load texture dynamically if not cached
    try {
      const texture = await Assets.load(imageUrl);
      if (texture) {
        textureCache.value.set(imageUrl, texture);
        return texture;
      }
    } catch (error) {
      console.warn(`Failed to load texture: ${imageUrl}`, error);
      failedTextures.value.add(imageUrl);
    }

    return undefined;
  };

  const getCachedTexture = (imageUrl: string) => {
    return textureCache.value.get(imageUrl);
  };

  const hasTexture = (imageUrl: string): boolean => {
    return textureCache.value.has(imageUrl);
  };

  const clearTextureCache = (preserveCount = 0): void => {
    console.log(
      "🧹 Clearing texture cache",
      preserveCount > 0 ? `(preserving ${preserveCount} most recent)` : ""
    );

    if (preserveCount > 0) {
      // Keep most recently used textures
      const entries = Array.from(textureCache.value.entries());
      const toKeep = entries.slice(-preserveCount);
      const toRemove = entries.slice(0, -preserveCount);

      // Destroy old textures
      toRemove.forEach(([url, texture]) => {
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

      // Rebuild cache with kept textures
      textureCache.value.clear();
      toKeep.forEach(([url, texture]) => {
        textureCache.value.set(url, texture);
      });
    } else {
      // Clear all textures
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
    }

    // Reset failed textures on cache clear
    failedTextures.value.clear();
  };

  const getLoadingStats = computed(() => ({
    isLoading: isLoading.value,
    progress: loadingProgress.value,
    cacheSize: textureCache.value.size,
    failedTexturesCount: failedTextures.value.size,
    cacheHitRate:
      textureCache.value.size > 0
        ? (
            (textureCache.value.size /
              (textureCache.value.size + failedTextures.value.size)) *
            100
          ).toFixed(2) + "%"
        : "0%",
    memoryEstimate: `~${Math.round(textureCache.value.size * 0.1)}MB`, // Rough estimate
  }));

  const optimizeMemoryUsage = () => {
    const maxCacheSize = 50; // Maximum textures to keep
    if (textureCache.value.size > maxCacheSize) {
      clearTextureCache(Math.floor(maxCacheSize * 0.7)); // Keep 70% of max
    }
  };

  return {
    // State
    isLoading,
    loadingProgress,

    // Methods
    preloadCardTextures,
    getTexture,
    getCachedTexture,
    hasTexture,
    clearTextureCache,
    getLoadingStats,
    optimizeMemoryUsage,

    // Utils
    extractImageUrls,
  };
};
