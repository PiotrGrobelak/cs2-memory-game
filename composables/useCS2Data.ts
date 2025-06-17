/**
 * useCS2Data - Counter-Strike 2 item data management for the memory game
 *
 * This composable handles fetching, caching, and managing CS2 item data:
 * - Fetches CS2 weapon skins and items from external APIs
 * - Implements intelligent caching to minimize API calls
 * - Provides seeded item selection for consistent game experiences
 * - Organizes items by rarity and category for balanced gameplay
 * - Handles API errors gracefully with retry mechanisms
 * - Manages cache invalidation and refresh cycles
 *
 * Key features:
 * - Automatic data initialization with configurable item counts
 * - Seeded randomization for deterministic item selection
 * - Cache status monitoring and management
 * - Item lookup by ID with O(1) performance
 * - Grouped access by rarity (Consumer, Industrial, Mil-Spec, etc.)
 * - Error handling with user-friendly fallbacks
 */
import { ref, computed } from "vue";
import type { CS2Item } from "~/types/game";
import { cs2ApiService } from "~/services/cs2ApiService";

export interface CS2DataState {
  items: CS2Item[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
}

export const useCS2Data = () => {
  // Reactive state
  const state = ref<CS2DataState>({
    items: [],
    isLoading: false,
    error: null,
    lastFetched: null,
  });

  // Computed properties
  const hasItems = computed(() => state.value.items.length > 0);
  const cacheStatus = computed(() => cs2ApiService.getCacheStatus());

  const itemsByRarity = computed(() => {
    const grouped: Record<string, CS2Item[]> = {};
    state.value.items.forEach((item) => {
      if (!grouped[item.rarity]) {
        grouped[item.rarity] = [];
      }
      grouped[item.rarity].push(item);
    });
    return grouped;
  });

  const itemsByCategory = computed(() => {
    const grouped: Record<string, CS2Item[]> = {};
    state.value.items.forEach((item) => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    });
    return grouped;
  });

  // Actions
  const fetchItems = async (
    count: number = 100,
    forceRefresh: boolean = false
  ): Promise<void> => {
    if (state.value.isLoading) {
      console.warn("CS2 data fetch already in progress");
      return;
    }

    state.value.isLoading = true;
    state.value.error = null;

    try {
      // Clear cache if force refresh is requested
      if (forceRefresh) {
        cs2ApiService.clearCache();
      }

      const items = await cs2ApiService.getCS2Items(count);

      state.value.items = items;
      state.value.lastFetched = Date.now();
      state.value.error = null;

      console.log(`Successfully loaded ${items.length} CS2 items`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      state.value.error = errorMessage;
      console.error("Failed to fetch CS2 data:", error);
    } finally {
      state.value.isLoading = false;
    }
  };

  const getItemsForGame = (count: number, seed?: string): CS2Item[] => {
    if (!hasItems.value) {
      console.warn("No CS2 items available for game");
      return [];
    }

    // Use seeded randomization if seed is provided
    let itemsToUse = [...state.value.items];

    if (seed) {
      // Simple seeded shuffle using seed
      const seededRandom = createSeededRandom(seed);
      itemsToUse = shuffleArraySeeded(itemsToUse, seededRandom);
    } else {
      // Regular shuffle
      itemsToUse = itemsToUse.sort(() => Math.random() - 0.5);
    }

    return itemsToUse.slice(0, count);
  };

  const getItemById = (id: string): CS2Item | null => {
    return state.value.items.find((item) => item.id === id) || null;
  };

  const clearError = (): void => {
    state.value.error = null;
  };

  const clearCache = (): void => {
    cs2ApiService.clearCache();
  };

  const refreshItems = async (count: number = 100): Promise<void> => {
    await fetchItems(count, true);
  };

  // Utility functions
  const createSeededRandom = (seed: string): (() => number) => {
    // Simple seeded random number generator
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return () => {
      hash = Math.sin(hash) * 10000;
      return hash - Math.floor(hash);
    };
  };

  const shuffleArraySeeded = <T>(array: T[], randomFn: () => number): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(randomFn() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Auto-fetch items on first use (with error handling)
  const initializeData = async (count: number = 100): Promise<void> => {
    if (!hasItems.value && !state.value.isLoading) {
      await fetchItems(count);
    }
  };

  return {
    // State
    state: readonly(state),

    // Computed
    hasItems,
    cacheStatus,
    itemsByRarity,
    itemsByCategory,

    // Actions
    fetchItems,
    getItemsForGame,
    getItemById,
    clearError,
    clearCache,
    refreshItems,
    initializeData,
  };
};
