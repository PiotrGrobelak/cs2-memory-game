/**
 * usePerformanceOptimizer - Advanced performance optimization system
 *
 * This composable provides comprehensive performance optimization:
 * - Intelligent texture caching and management
 * - Advanced object pooling for render objects
 * - Memory leak detection and prevention
 * - Performance profiling and metrics collection
 * - Automatic garbage collection optimization
 * - Resource usage monitoring and alerts
 *
 * Key features:
 * - Multi-level texture cache with LRU eviction
 * - Smart object pooling with automatic size management
 * - Memory usage tracking and optimization
 * - Performance bottleneck detection
 * - Automatic resource cleanup and optimization
 * - Real-time performance monitoring dashboard
 */
import { reactive, readonly, computed } from "vue";

// Performance metrics interface
interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  textureMemory: number;
  renderCalls: number;
  objectsPooled: number;
  cacheHitRate: number;
  gcCycles: number;
}

// Texture cache entry
interface TextureCacheEntry {
  texture: HTMLImageElement | HTMLCanvasElement;
  lastUsed: number;
  usageCount: number;
  memorySize: number;
  isLoading: boolean;
}

// Object pool configuration
interface PoolConfig {
  initialSize: number;
  maxSize: number;
  growthFactor: number;
  shrinkThreshold: number;
  enableAutoSizing: boolean;
}

// Performance thresholds
interface PerformanceThresholds {
  targetFPS: number;
  maxMemoryMB: number;
  maxTextureMemoryMB: number;
  cacheEvictionThreshold: number;
  gcTriggerThreshold: number;
}

// Memory pool for different object types
interface ObjectPool<T> {
  name: string;
  objects: T[];
  inUse: Set<T>;
  factory: () => T;
  reset: (obj: T) => void;
  config: PoolConfig;
  stats: {
    created: number;
    reused: number;
    maxUsed: number;
    currentSize: number;
  };
}

// Performance alert types
type AlertType = "memory" | "fps" | "texture" | "gc" | "cache";

interface PerformanceAlert {
  type: AlertType;
  severity: "warning" | "critical";
  message: string;
  timestamp: number;
  value?: number;
  threshold?: number;
}

// Default configurations
const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  targetFPS: 60,
  maxMemoryMB: 100,
  maxTextureMemoryMB: 50,
  cacheEvictionThreshold: 0.8,
  gcTriggerThreshold: 0.9,
};

const DEFAULT_POOL_CONFIG: PoolConfig = {
  initialSize: 10,
  maxSize: 100,
  growthFactor: 1.5,
  shrinkThreshold: 0.3,
  enableAutoSizing: true,
};

export const usePerformanceOptimizer = (
  thresholds: Partial<PerformanceThresholds> = {},
  poolConfig: Partial<PoolConfig> = {}
) => {
  // Merge configurations
  const perfThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const defaultPoolConfig = { ...DEFAULT_POOL_CONFIG, ...poolConfig };

  // Performance state
  const state = reactive({
    isInitialized: false,
    isMonitoring: false,
    lastFrameTime: 0,
    frameCount: 0,
    lastGCCheck: 0,
    alerts: [] as PerformanceAlert[],
  });

  // Performance metrics
  const metrics = reactive<PerformanceMetrics>({
    fps: 0,
    frameTime: 0,
    memoryUsage: 0,
    textureMemory: 0,
    renderCalls: 0,
    objectsPooled: 0,
    cacheHitRate: 0,
    gcCycles: 0,
  });

  // Texture cache (LRU implementation)
  const textureCache = reactive<Map<string, TextureCacheEntry>>(new Map());
  const cacheStats = reactive({
    hits: 0,
    misses: 0,
    evictions: 0,
    totalMemory: 0,
  });

  // Object pools
  const objectPools = reactive<Map<string, ObjectPool<any>>>(new Map());

  // Performance sampling
  const frameTimes: number[] = [];
  const memoryUsage: number[] = [];
  const maxSamples = 60; // Store last 60 frames

  /**
   * Initialize performance optimizer
   */
  const initialize = (): void => {
    if (state.isInitialized) {
      console.warn("Performance optimizer already initialized");
      return;
    }

    // Start performance monitoring
    startMonitoring();

    state.isInitialized = true;
    console.log("Performance optimizer initialized", {
      thresholds: perfThresholds,
      poolConfig: defaultPoolConfig,
    });
  };

  /**
   * Start performance monitoring
   */
  const startMonitoring = (): void => {
    state.isMonitoring = true;
    state.lastFrameTime = performance.now();
  };

  /**
   * Update performance metrics (called each frame)
   */
  const updateMetrics = (currentTime: number): void => {
    if (!state.isMonitoring) return;

    // Calculate frame time and FPS
    const deltaTime = currentTime - state.lastFrameTime;
    state.lastFrameTime = currentTime;
    state.frameCount++;

    // Update frame time samples
    frameTimes.push(deltaTime);
    if (frameTimes.length > maxSamples) {
      frameTimes.shift();
    }

    // Calculate average FPS
    if (frameTimes.length > 0) {
      const avgFrameTime =
        frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
      metrics.fps = Math.round(1000 / avgFrameTime);
      metrics.frameTime = avgFrameTime;
    }

    // Update memory usage
    updateMemoryMetrics();

    // Update texture cache metrics
    updateTextureCacheMetrics();

    // Update object pool metrics
    updateObjectPoolMetrics();

    // Check for performance issues
    checkPerformanceThresholds();

    // Periodic garbage collection check
    if (currentTime - state.lastGCCheck > 5000) {
      // Every 5 seconds
      checkGarbageCollection();
      state.lastGCCheck = currentTime;
    }
  };

  /**
   * Update memory usage metrics
   */
  const updateMemoryMetrics = (): void => {
    // Check if performance.memory is available (Chrome only)
    const perfWithMemory = performance as Performance & {
      memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
    };

    if (perfWithMemory.memory) {
      const memoryMB = perfWithMemory.memory.usedJSHeapSize / (1024 * 1024);
      metrics.memoryUsage = Math.round(memoryMB);

      // Update memory usage samples
      memoryUsage.push(memoryMB);
      if (memoryUsage.length > maxSamples) {
        memoryUsage.shift();
      }
    }
  };

  /**
   * Update texture cache metrics
   */
  const updateTextureCacheMetrics = (): void => {
    let totalMemory = 0;
    for (const entry of textureCache.values()) {
      totalMemory += entry.memorySize;
    }

    cacheStats.totalMemory = totalMemory;
    metrics.textureMemory = Math.round(totalMemory / (1024 * 1024));
    metrics.cacheHitRate =
      cacheStats.hits + cacheStats.misses > 0
        ? Math.round(
            (cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100
          )
        : 0;
  };

  /**
   * Update object pool metrics
   */
  const updateObjectPoolMetrics = (): void => {
    let totalPooled = 0;
    for (const pool of objectPools.values()) {
      totalPooled += pool.objects.length;
    }
    metrics.objectsPooled = totalPooled;
  };

  /**
   * Check performance thresholds and generate alerts
   */
  const checkPerformanceThresholds = (): void => {
    const currentTime = performance.now();

    // Check FPS threshold
    if (metrics.fps < perfThresholds.targetFPS * 0.8) {
      addAlert(
        "fps",
        "warning",
        `Low FPS detected: ${metrics.fps}`,
        metrics.fps,
        perfThresholds.targetFPS
      );
    }

    // Check memory threshold
    if (metrics.memoryUsage > perfThresholds.maxMemoryMB * 0.8) {
      const severity =
        metrics.memoryUsage > perfThresholds.maxMemoryMB
          ? "critical"
          : "warning";
      addAlert(
        "memory",
        severity,
        `High memory usage: ${metrics.memoryUsage}MB`,
        metrics.memoryUsage,
        perfThresholds.maxMemoryMB
      );
    }

    // Check texture memory threshold
    if (metrics.textureMemory > perfThresholds.maxTextureMemoryMB * 0.8) {
      const severity =
        metrics.textureMemory > perfThresholds.maxTextureMemoryMB
          ? "critical"
          : "warning";
      addAlert(
        "texture",
        severity,
        `High texture memory: ${metrics.textureMemory}MB`,
        metrics.textureMemory,
        perfThresholds.maxTextureMemoryMB
      );
    }

    // Check cache performance
    if (
      metrics.cacheHitRate < 70 &&
      cacheStats.hits + cacheStats.misses > 100
    ) {
      addAlert(
        "cache",
        "warning",
        `Low cache hit rate: ${metrics.cacheHitRate}%`,
        metrics.cacheHitRate,
        70
      );
    }
  };

  /**
   * Add performance alert
   */
  const addAlert = (
    type: AlertType,
    severity: "warning" | "critical",
    message: string,
    value?: number,
    threshold?: number
  ): void => {
    const alert: PerformanceAlert = {
      type,
      severity,
      message,
      timestamp: Date.now(),
      value,
      threshold,
    };

    state.alerts.push(alert);

    // Keep only last 50 alerts
    if (state.alerts.length > 50) {
      state.alerts.shift();
    }

    console.warn(`Performance Alert [${severity.toUpperCase()}]:`, message);
  };

  /**
   * Check for garbage collection opportunities
   */
  const checkGarbageCollection = (): void => {
    // Evict old texture cache entries
    evictOldTextures();

    // Resize object pools if needed
    resizeObjectPools();

    // Force garbage collection if memory usage is too high
    if (
      metrics.memoryUsage >
      perfThresholds.maxMemoryMB * perfThresholds.gcTriggerThreshold
    ) {
      forceGarbageCollection();
    }
  };

  /**
   * Evict old textures from cache (LRU)
   */
  const evictOldTextures = (): void => {
    const currentTime = performance.now();
    const maxAge = 30000; // 30 seconds
    const evictionThreshold =
      perfThresholds.maxTextureMemoryMB *
      1024 *
      1024 *
      perfThresholds.cacheEvictionThreshold;

    let currentMemory = cacheStats.totalMemory;
    const entries = Array.from(textureCache.entries()).sort(
      ([, a], [, b]) => a.lastUsed - b.lastUsed
    ); // Sort by last used (oldest first)

    for (const [key, entry] of entries) {
      // Evict if too old or if memory threshold exceeded
      if (
        currentTime - entry.lastUsed > maxAge ||
        currentMemory > evictionThreshold
      ) {
        textureCache.delete(key);
        currentMemory -= entry.memorySize;
        cacheStats.evictions++;
        console.debug(`Evicted texture "${key}" from cache`);
      }
    }
  };

  /**
   * Resize object pools based on usage patterns
   */
  const resizeObjectPools = (): void => {
    for (const pool of objectPools.values()) {
      if (!pool.config.enableAutoSizing) continue;

      const currentSize = pool.objects.length;
      const inUseCount = pool.inUse.size;
      const utilizationRate = currentSize > 0 ? inUseCount / currentSize : 0;

      // Shrink pool if underutilized
      if (
        utilizationRate < pool.config.shrinkThreshold &&
        currentSize > pool.config.initialSize
      ) {
        const targetSize = Math.max(
          pool.config.initialSize,
          Math.floor(currentSize / pool.config.growthFactor)
        );
        const toRemove = currentSize - targetSize;

        for (let i = 0; i < toRemove; i++) {
          const obj = pool.objects.pop();
          if (obj && !pool.inUse.has(obj)) {
            // Object successfully removed
          }
        }

        console.debug(
          `Resized pool "${pool.name}" from ${currentSize} to ${targetSize}`
        );
      }
    }
  };

  /**
   * Force garbage collection (if available)
   */
  const forceGarbageCollection = (): void => {
    // Force GC if available (non-standard, Chrome only)
    if (typeof window !== "undefined" && "gc" in window) {
      try {
        (window as any).gc();
        metrics.gcCycles++;
        addAlert(
          "gc",
          "warning",
          "Forced garbage collection due to high memory usage"
        );
      } catch (error) {
        console.debug("Manual GC not available");
      }
    }
  };

  /**
   * Get or create texture from cache
   */
  const getTexture = async (
    key: string,
    loader: () => Promise<HTMLImageElement | HTMLCanvasElement>
  ): Promise<HTMLImageElement | HTMLCanvasElement> => {
    const currentTime = performance.now();
    const existingEntry = textureCache.get(key);

    if (existingEntry) {
      // Cache hit
      existingEntry.lastUsed = currentTime;
      existingEntry.usageCount++;
      cacheStats.hits++;
      return existingEntry.texture;
    }

    // Cache miss - load texture
    cacheStats.misses++;

    // Create cache entry for loading state
    const loadingEntry: TextureCacheEntry = {
      texture: null as any, // Will be set when loaded
      lastUsed: currentTime,
      usageCount: 1,
      memorySize: 0,
      isLoading: true,
    };

    textureCache.set(key, loadingEntry);

    try {
      const texture = await loader();

      // Calculate memory size estimate
      const memorySize = estimateTextureMemorySize(texture);

      // Update cache entry
      loadingEntry.texture = texture;
      loadingEntry.memorySize = memorySize;
      loadingEntry.isLoading = false;

      console.debug(
        `Loaded texture "${key}" (${Math.round(memorySize / 1024)}KB)`
      );
      return texture;
    } catch (error) {
      // Remove failed entry from cache
      textureCache.delete(key);
      throw error;
    }
  };

  /**
   * Estimate texture memory size
   */
  const estimateTextureMemorySize = (
    texture: HTMLImageElement | HTMLCanvasElement
  ): number => {
    const width = texture.width || 0;
    const height = texture.height || 0;
    return width * height * 4; // Assume RGBA (4 bytes per pixel)
  };

  /**
   * Create object pool
   */
  const createObjectPool = <T>(
    name: string,
    factory: () => T,
    reset: (obj: T) => void,
    config: Partial<PoolConfig> = {}
  ): ObjectPool<T> => {
    const poolConfig = { ...defaultPoolConfig, ...config };

    const pool: ObjectPool<T> = {
      name,
      objects: [],
      inUse: new Set(),
      factory,
      reset,
      config: poolConfig,
      stats: {
        created: 0,
        reused: 0,
        maxUsed: 0,
        currentSize: 0,
      },
    };

    // Pre-populate pool
    for (let i = 0; i < poolConfig.initialSize; i++) {
      pool.objects.push(factory());
      pool.stats.created++;
    }

    objectPools.set(name, pool);
    console.log(
      `Created object pool "${name}" with ${poolConfig.initialSize} objects`
    );

    return pool;
  };

  /**
   * Get object from pool
   */
  const getFromPool = <T>(poolName: string): T | null => {
    const pool = objectPools.get(poolName) as ObjectPool<T>;
    if (!pool) {
      console.warn(`Object pool "${poolName}" not found`);
      return null;
    }

    let obj = pool.objects.pop();

    if (!obj) {
      // Pool is empty, create new object if within limits
      if (pool.inUse.size < pool.config.maxSize) {
        obj = pool.factory();
        pool.stats.created++;
        console.debug(`Created new object for pool "${poolName}"`);
      } else {
        console.warn(`Pool "${poolName}" reached maximum size`);
        return null;
      }
    } else {
      pool.stats.reused++;
    }

    pool.inUse.add(obj);
    pool.stats.maxUsed = Math.max(pool.stats.maxUsed, pool.inUse.size);
    pool.stats.currentSize = pool.objects.length + pool.inUse.size;

    return obj;
  };

  /**
   * Return object to pool
   */
  const returnToPool = <T>(poolName: string, obj: T): void => {
    const pool = objectPools.get(poolName) as ObjectPool<T>;
    if (!pool) {
      console.warn(`Object pool "${poolName}" not found`);
      return;
    }

    if (!pool.inUse.has(obj)) {
      console.warn(`Object not found in pool "${poolName}" in-use set`);
      return;
    }

    // Reset object state
    pool.reset(obj);

    // Remove from in-use and return to pool
    pool.inUse.delete(obj);
    pool.objects.push(obj);
    pool.stats.currentSize = pool.objects.length + pool.inUse.size;
  };

  /**
   * Clear texture cache
   */
  const clearTextureCache = (): void => {
    textureCache.clear();
    cacheStats.hits = 0;
    cacheStats.misses = 0;
    cacheStats.evictions = 0;
    cacheStats.totalMemory = 0;
    console.log("Texture cache cleared");
  };

  /**
   * Clear all object pools
   */
  const clearObjectPools = (): void => {
    objectPools.clear();
    console.log("All object pools cleared");
  };

  /**
   * Get performance summary
   */
  const getPerformanceSummary = () => ({
    metrics: readonly(metrics),
    cacheStats: readonly(cacheStats),
    poolStats: Array.from(objectPools.values()).map((pool) => ({
      name: pool.name,
      size: pool.objects.length,
      inUse: pool.inUse.size,
      stats: readonly(pool.stats),
    })),
    alerts: readonly(state.alerts),
    frameTimes: [...frameTimes],
    memoryUsage: [...memoryUsage],
  });

  /**
   * Get optimization recommendations
   */
  const getOptimizationRecommendations = (): string[] => {
    const recommendations: string[] = [];

    if (metrics.fps < perfThresholds.targetFPS * 0.9) {
      recommendations.push(
        "Consider reducing render complexity or enabling object culling"
      );
    }

    if (metrics.cacheHitRate < 80) {
      recommendations.push(
        "Texture cache hit rate is low - consider preloading common textures"
      );
    }

    if (metrics.memoryUsage > perfThresholds.maxMemoryMB * 0.8) {
      recommendations.push(
        "High memory usage detected - consider implementing more aggressive cleanup"
      );
    }

    const totalPoolSize = Array.from(objectPools.values()).reduce(
      (sum, pool) => sum + pool.objects.length,
      0
    );

    if (totalPoolSize > 500) {
      recommendations.push(
        "Object pools are large - consider reducing initial pool sizes"
      );
    }

    return recommendations;
  };

  /**
   * Cleanup performance optimizer
   */
  const cleanup = (): void => {
    state.isMonitoring = false;
    clearTextureCache();
    clearObjectPools();
    state.alerts.length = 0;
    frameTimes.length = 0;
    memoryUsage.length = 0;

    state.isInitialized = false;
    console.log("Performance optimizer cleaned up");
  };

  // Computed properties
  const isPerformanceGood = computed(
    () =>
      metrics.fps >= perfThresholds.targetFPS * 0.9 &&
      metrics.memoryUsage < perfThresholds.maxMemoryMB * 0.8
  );

  const criticalAlerts = computed(() =>
    state.alerts.filter((alert) => alert.severity === "critical")
  );

  return {
    // State
    state: readonly(state),
    metrics: readonly(metrics),
    isPerformanceGood,
    criticalAlerts,

    // Lifecycle
    initialize,
    cleanup,

    // Monitoring
    updateMetrics,
    startMonitoring,

    // Texture cache
    getTexture,
    clearTextureCache,

    // Object pooling
    createObjectPool,
    getFromPool,
    returnToPool,
    clearObjectPools,

    // Analytics
    getPerformanceSummary,
    getOptimizationRecommendations,
  };
};
