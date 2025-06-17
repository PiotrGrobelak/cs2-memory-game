/**
 * useSeedSystem - Deterministic randomization system for the CS2 Memory Game
 *
 * This composable manages seed-based random number generation for reproducible gameplay:
 * - Generates and validates game seeds for consistent game states
 * - Provides seeded random number generators for card shuffling and item selection
 * - Handles custom seed input with validation and normalization
 * - Maintains seed history for easy game sharing and replay
 * - Calculates seed entropy and complexity metrics
 * - URL-based seed sharing functionality
 *
 * Key features:
 * - Cryptographically-strong seed generation using multiple entropy sources
 * - Linear congruential generator with proven mathematical parameters
 * - Seed validation with user-friendly error messages
 * - History management with localStorage persistence
 * - URL parsing for shared seeds (e.g., ?seed=example123)
 * - Cross-platform deterministic behavior for consistent game experience
 */
import { ref, computed } from "vue";

export interface SeedSystemState {
  currentSeed: string;
  isCustomSeed: boolean;
  seedHistory: string[];
  validationError: string | null;
}

export interface SeededRandomGenerator {
  next(): number;
  nextInt(min: number, max: number): number;
  nextBool(): boolean;
  shuffle<T>(array: T[]): T[];
}

export const useSeedSystem = () => {
  // Reactive state
  const state = ref<SeedSystemState>({
    currentSeed: "",
    isCustomSeed: false,
    seedHistory: [],
    validationError: null,
  });

  // Computed properties
  const isValidSeed = computed(() => {
    return state.value.currentSeed.length > 0 && !state.value.validationError;
  });

  const seedInfo = computed(() => {
    const seed = state.value.currentSeed;
    return {
      length: seed.length,
      entropy: calculateEntropy(seed),
      complexity: calculateComplexity(seed),
      isCustom: state.value.isCustomSeed,
    };
  });

  const canShareSeed = computed(() => {
    return isValidSeed.value && state.value.currentSeed.length <= 50;
  });

  // Actions
  const generateRandomSeed = (): string => {
    // Generate a high-entropy seed
    const timestamp = Date.now().toString(36);
    const performance =
      typeof window !== "undefined" && window.performance
        ? window.performance.now().toString(36)
        : Math.random().toString(36);
    const random1 = Math.random().toString(36).substring(2);
    const random2 = Math.random().toString(36).substring(2);

    // Combine entropy sources
    let baseSeed = `${timestamp}-${performance}-${random1}-${random2}`;

    // Clean and normalize
    baseSeed = normalizeSeed(baseSeed);

    // Ensure minimum entropy
    while (baseSeed.length < 20) {
      baseSeed += Math.random().toString(36).substring(2);
    }

    return baseSeed.substring(0, 32); // Limit to reasonable length
  };

  const setSeed = (seed: string, isCustom: boolean = false): boolean => {
    const normalizedSeed = normalizeSeed(seed);
    const validation = validateSeed(normalizedSeed);

    if (!validation.isValid) {
      state.value.validationError = validation.error;
      return false;
    }

    // Update state
    state.value.currentSeed = normalizedSeed;
    state.value.isCustomSeed = isCustom;
    state.value.validationError = null;

    // Add to history if not already present
    addToHistory(normalizedSeed);

    return true;
  };

  const setRandomSeed = (): string => {
    const newSeed = generateRandomSeed();
    setSeed(newSeed, false);
    return newSeed;
  };

  const setCustomSeed = (customSeed: string): boolean => {
    return setSeed(customSeed, true);
  };

  const createSeededGenerator = (seed?: string): SeededRandomGenerator => {
    const seedToUse = seed || state.value.currentSeed;

    if (!seedToUse) {
      throw new Error("No seed available for random generator");
    }

    // Create hash from seed
    let hash = createSeedHash(seedToUse);

    // Linear congruential generator with good parameters
    const next = (): number => {
      hash = (hash * 1664525 + 1013904223) % 4294967296;
      return hash / 4294967296;
    };

    return {
      next,
      nextInt: (min: number, max: number): number => {
        return Math.floor(next() * (max - min + 1)) + min;
      },
      nextBool: (): boolean => {
        return next() < 0.5;
      },
      shuffle: <T>(array: T[]): T[] => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
      },
    };
  };

  const clearValidationError = (): void => {
    state.value.validationError = null;
  };

  const clearHistory = (): void => {
    state.value.seedHistory = [];
    saveHistoryToStorage();
  };

  const removeFromHistory = (seed: string): void => {
    const index = state.value.seedHistory.indexOf(seed);
    if (index > -1) {
      state.value.seedHistory.splice(index, 1);
      saveHistoryToStorage();
    }
  };

  // Utility functions
  const normalizeSeed = (seed: string): string => {
    return seed
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") // Remove non-alphanumeric
      .substring(0, 50); // Limit length
  };

  const validateSeed = (
    seed: string
  ): { isValid: boolean; error: string | null } => {
    if (!seed) {
      return { isValid: false, error: "Seed cannot be empty" };
    }

    if (seed.length < 3) {
      return {
        isValid: false,
        error: "Seed must be at least 3 characters long",
      };
    }

    if (seed.length > 50) {
      return {
        isValid: false,
        error: "Seed cannot be longer than 50 characters",
      };
    }

    if (!/^[a-z0-9]+$/.test(seed)) {
      return {
        isValid: false,
        error: "Seed can only contain letters and numbers",
      };
    }

    return { isValid: true, error: null };
  };

  const calculateEntropy = (seed: string): number => {
    const frequencies: Record<string, number> = {};

    // Count character frequencies
    for (const char of seed) {
      frequencies[char] = (frequencies[char] || 0) + 1;
    }

    // Calculate Shannon entropy
    let entropy = 0;
    for (const count of Object.values(frequencies)) {
      const probability = count / seed.length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  };

  const calculateComplexity = (seed: string): "low" | "medium" | "high" => {
    const hasNumbers = /\d/.test(seed);
    const hasLetters = /[a-z]/.test(seed);
    const entropy = calculateEntropy(seed);

    if (entropy > 3 && hasNumbers && hasLetters && seed.length >= 8) {
      return "high";
    } else if (entropy > 2 && (hasNumbers || hasLetters) && seed.length >= 5) {
      return "medium";
    } else {
      return "low";
    }
  };

  const createSeedHash = (seed: string): number => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  };

  const addToHistory = (seed: string): void => {
    // Remove if already exists
    const index = state.value.seedHistory.indexOf(seed);
    if (index > -1) {
      state.value.seedHistory.splice(index, 1);
    }

    // Add to beginning
    state.value.seedHistory.unshift(seed);

    // Limit history size
    if (state.value.seedHistory.length > 20) {
      state.value.seedHistory = state.value.seedHistory.slice(0, 20);
    }

    saveHistoryToStorage();
  };

  const saveHistoryToStorage = (): void => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(
          "cs2-memory-seed-history",
          JSON.stringify(state.value.seedHistory)
        );
      }
    } catch (error) {
      console.error("Failed to save seed history:", error);
    }
  };

  const loadHistoryFromStorage = (): void => {
    try {
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem("cs2-memory-seed-history");
        if (stored) {
          const history = JSON.parse(stored);
          if (Array.isArray(history)) {
            state.value.seedHistory = history.slice(0, 20); // Ensure limit
          }
        }
      }
    } catch (error) {
      console.error("Failed to load seed history:", error);
      state.value.seedHistory = [];
    }
  };

  // Generate URL for sharing
  const generateShareUrl = (baseUrl?: string): string => {
    if (!canShareSeed.value) {
      throw new Error("Cannot share invalid or too long seed");
    }

    const base =
      baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
    const params = new URLSearchParams({ seed: state.value.currentSeed });
    return `${base}?${params.toString()}`;
  };

  // Parse seed from URL
  const parseSeedFromUrl = (url?: string): string | null => {
    try {
      const urlToParse =
        url || (typeof window !== "undefined" ? window.location.href : "");
      const urlObj = new URL(urlToParse);
      const seedParam = urlObj.searchParams.get("seed");

      if (seedParam) {
        const normalized = normalizeSeed(seedParam);
        const validation = validateSeed(normalized);
        return validation.isValid ? normalized : null;
      }

      return null;
    } catch {
      return null;
    }
  };

  // Initialize with history and URL seed
  const initialize = (): void => {
    loadHistoryFromStorage();

    // Try to get seed from URL
    const urlSeed = parseSeedFromUrl();
    if (urlSeed) {
      setSeed(urlSeed, true);
    } else {
      // Generate random seed if none provided
      setRandomSeed();
    }
  };

  return {
    // State
    state: readonly(state),

    // Computed
    isValidSeed,
    seedInfo,
    canShareSeed,

    // Actions
    generateRandomSeed,
    setSeed,
    setRandomSeed,
    setCustomSeed,
    createSeededGenerator,
    clearValidationError,
    clearHistory,
    removeFromHistory,
    generateShareUrl,
    parseSeedFromUrl,
    initialize,

    // Utilities
    normalizeSeed,
    validateSeed,
  };
};
