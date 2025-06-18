interface ImageCacheEntry {
  image: HTMLImageElement;
  loaded: boolean;
  error: boolean;
  loading: boolean;
}

interface ImageLoadOptions {
  crossOrigin?: string;
  timeout?: number;
}

export class ImageLoader {
  private cache = new Map<string, ImageCacheEntry>();
  private loadingPromises = new Map<string, Promise<HTMLImageElement>>();

  /**
   * Load an image from URL with caching
   */
  async loadImage(
    url: string,
    options: ImageLoadOptions = {}
  ): Promise<HTMLImageElement> {
    // Return cached image if available and loaded
    const cached = this.cache.get(url);
    if (cached && cached.loaded && !cached.error) {
      return cached.image;
    }

    // Return existing loading promise if already loading
    const existingPromise = this.loadingPromises.get(url);
    if (existingPromise) {
      return existingPromise;
    }

    // Create new loading promise
    const loadPromise = this.createImageLoadPromise(url, options);
    this.loadingPromises.set(url, loadPromise);

    try {
      const image = await loadPromise;

      // Update cache with successful load
      this.cache.set(url, {
        image,
        loaded: true,
        error: false,
        loading: false,
      });

      return image;
    } catch (error) {
      // Update cache with error state
      this.cache.set(url, {
        image: new Image(),
        loaded: false,
        error: true,
        loading: false,
      });

      console.error(`Failed to load image: ${url}`, error);
      throw error;
    } finally {
      // Clean up loading promise
      this.loadingPromises.delete(url);
    }
  }

  /**
   * Create a promise that resolves when image loads or rejects on error/timeout
   */
  private createImageLoadPromise(
    url: string,
    options: ImageLoadOptions
  ): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      // Set up cache entry as loading
      this.cache.set(url, {
        image: img,
        loaded: false,
        error: false,
        loading: true,
      });

      // Configure image
      if (options.crossOrigin) {
        img.crossOrigin = options.crossOrigin;
      }

      // Set up timeout if specified
      let timeoutId: NodeJS.Timeout | null = null;
      if (options.timeout) {
        timeoutId = setTimeout(() => {
          reject(new Error(`Image load timeout: ${url}`));
        }, options.timeout);
      }

      // Handle successful load
      img.onload = () => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(img);
      };

      // Handle load error
      img.onerror = () => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(new Error(`Failed to load image: ${url}`));
      };

      // Start loading
      img.src = url;
    });
  }

  /**
   * Preload multiple images
   */
  async preloadImages(
    urls: string[],
    options: ImageLoadOptions = {}
  ): Promise<{ loaded: HTMLImageElement[]; failed: string[] }> {
    const results = await Promise.allSettled(
      urls.map((url) => this.loadImage(url, options))
    );

    const loaded: HTMLImageElement[] = [];
    const failed: string[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        loaded.push(result.value);
      } else {
        failed.push(urls[index]);
      }
    });

    return { loaded, failed };
  }

  /**
   * Check if image is cached and loaded
   */
  isImageLoaded(url: string): boolean {
    const cached = this.cache.get(url);
    return cached ? cached.loaded && !cached.error : false;
  }

  /**
   * Check if image is currently loading
   */
  isImageLoading(url: string): boolean {
    return (
      this.loadingPromises.has(url) || (this.cache.get(url)?.loading ?? false)
    );
  }

  /**
   * Get cached image if available
   */
  getCachedImage(url: string): HTMLImageElement | null {
    const cached = this.cache.get(url);
    return cached && cached.loaded && !cached.error ? cached.image : null;
  }

  /**
   * Clear image cache
   */
  clearCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
  }

  /**
   * Remove specific image from cache
   */
  removeFromCache(url: string): void {
    this.cache.delete(url);
    this.loadingPromises.delete(url);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    total: number;
    loaded: number;
    loading: number;
    failed: number;
  } {
    let loaded = 0;
    let loading = 0;
    let failed = 0;

    this.cache.forEach((entry) => {
      if (entry.loaded && !entry.error) loaded++;
      else if (entry.loading) loading++;
      else if (entry.error) failed++;
    });

    return {
      total: this.cache.size,
      loaded,
      loading: loading + this.loadingPromises.size,
      failed,
    };
  }
}

// Export singleton instance
export const imageLoader = new ImageLoader();
export default imageLoader;
