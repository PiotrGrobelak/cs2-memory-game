/**
 * useGamePersistence - Local storage management for the CS2 Memory Game
 *
 * This composable handles all client-side data persistence operations:
 * - Game state saving and loading (current game progress)
 * - Game history management (completed games and statistics)
 * - User preferences and options persistence
 * - API response caching for CS2 items
 * - Data migration and version management
 * - Storage quota monitoring and cleanup
 *
 * Key features:
 * - Robust error handling with fallbacks
 * - Data validation and corruption detection
 * - Version-aware serialization for future compatibility
 * - Automatic cleanup of old data to prevent storage bloat
 * - Session management for multiple concurrent games
 * - Storage usage monitoring and optimization
 */
import { ref, computed } from "vue";
import type { GameState, GameResult, GameOptions } from "~/types/game";

export interface PersistenceState {
  isLoading: boolean;
  error: string | null;
  lastSaved: number | null;
  migrationVersion: string;
}

export interface GameSession {
  id: string;
  seed: string;
  state: GameState;
  savedAt: number;
}

export const useGamePersistence = () => {
  // Storage keys constants
  const STORAGE_KEYS = {
    GAME_STATE: "cs2-memory-game-state",
    GAME_HISTORY: "cs2-memory-game-history",
    GAME_OPTIONS: "cs2-memory-game-options",
    API_CACHE: "cs2-memory-game-api-cache",
  } as const;

  // Reactive state
  const state = ref<PersistenceState>({
    isLoading: false,
    error: null,
    lastSaved: null,
    migrationVersion: "1.0.0",
  });

  // Current version for data migration
  const CURRENT_VERSION = "1.0.0";

  // Computed properties
  const canSave = computed(() => !state.value.isLoading);
  const hasError = computed(() => state.value.error !== null);

  // Storage utility functions
  const isStorageAvailable = (): boolean => {
    try {
      return typeof localStorage !== "undefined" && localStorage !== null;
    } catch {
      return false;
    }
  };

  const getStorageKey = (key: keyof typeof STORAGE_KEYS): string => {
    return STORAGE_KEYS[key];
  };

  // Game State Management
  const saveGameState = async (gameState: GameState): Promise<boolean> => {
    if (!canSave.value) {
      console.warn("Cannot save game state: operation in progress");
      return false;
    }

    state.value.isLoading = true;
    state.value.error = null;

    try {
      if (!isStorageAvailable()) {
        throw new Error("localStorage is not available");
      }

      // Create save data with metadata
      const saveData = {
        version: CURRENT_VERSION,
        timestamp: Date.now(),
        gameState,
      };

      const serialized = JSON.stringify(saveData);
      localStorage.setItem(getStorageKey("GAME_STATE"), serialized);

      state.value.lastSaved = Date.now();
      console.log("Game state saved successfully");
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save game state";
      state.value.error = errorMessage;
      console.error("Error saving game state:", error);
      return false;
    } finally {
      state.value.isLoading = false;
    }
  };

  const loadGameState = async (): Promise<GameState | null> => {
    state.value.isLoading = true;
    state.value.error = null;

    try {
      if (!isStorageAvailable()) {
        throw new Error("localStorage is not available");
      }

      const stored = localStorage.getItem(getStorageKey("GAME_STATE"));
      if (!stored) {
        console.log("No saved game state found");
        return null;
      }

      const saveData = JSON.parse(stored);

      // Validate save data structure
      if (!saveData.gameState || !saveData.version) {
        throw new Error("Invalid save data format");
      }

      console.log("Game state loaded successfully");
      return saveData.gameState as GameState;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load game state";
      state.value.error = errorMessage;
      console.error("Error loading game state:", error);
      return null;
    } finally {
      state.value.isLoading = false;
    }
  };

  const deleteGameState = async (): Promise<boolean> => {
    try {
      if (!isStorageAvailable()) {
        throw new Error("localStorage is not available");
      }

      localStorage.removeItem(getStorageKey("GAME_STATE"));
      state.value.lastSaved = null;
      console.log("Game state deleted successfully");
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete game state";
      state.value.error = errorMessage;
      console.error("Error deleting game state:", error);
      return false;
    }
  };

  // Game History Management
  const saveGameResult = async (result: GameResult): Promise<boolean> => {
    try {
      if (!isStorageAvailable()) {
        throw new Error("localStorage is not available");
      }

      const history = await loadGameHistory();

      // Add new result to beginning
      history.unshift(result);

      // Limit history size to 100 entries
      if (history.length > 100) {
        history.splice(100);
      }

      const saveData = {
        version: CURRENT_VERSION,
        timestamp: Date.now(),
        history,
      };

      const serialized = JSON.stringify(saveData);
      localStorage.setItem(getStorageKey("GAME_HISTORY"), serialized);

      console.log("Game result saved to history");
      return true;
    } catch (error) {
      console.error("Error saving game result:", error);
      return false;
    }
  };

  const loadGameHistory = async (): Promise<GameResult[]> => {
    try {
      if (!isStorageAvailable()) {
        return [];
      }

      const stored = localStorage.getItem(getStorageKey("GAME_HISTORY"));
      if (!stored) {
        return [];
      }

      const saveData = JSON.parse(stored);

      return Array.isArray(saveData.history) ? saveData.history : [];
    } catch (error) {
      console.error("Error loading game history:", error);
      return [];
    }
  };

  const clearGameHistory = async (): Promise<boolean> => {
    try {
      if (!isStorageAvailable()) {
        throw new Error("localStorage is not available");
      }

      localStorage.removeItem(getStorageKey("GAME_HISTORY"));
      console.log("Game history cleared");
      return true;
    } catch (error) {
      console.error("Error clearing game history:", error);
      return false;
    }
  };

  // Game Options Management
  const saveGameOptions = async (options: GameOptions): Promise<boolean> => {
    try {
      if (!isStorageAvailable()) {
        throw new Error("localStorage is not available");
      }

      const saveData = {
        version: CURRENT_VERSION,
        timestamp: Date.now(),
        options,
      };

      const serialized = JSON.stringify(saveData);
      localStorage.setItem(getStorageKey("GAME_OPTIONS"), serialized);

      console.log("Game options saved");
      return true;
    } catch (error) {
      console.error("Error saving game options:", error);
      return false;
    }
  };

  const loadGameOptions = async (): Promise<GameOptions | null> => {
    try {
      if (!isStorageAvailable()) {
        return null;
      }

      const stored = localStorage.getItem(getStorageKey("GAME_OPTIONS"));
      if (!stored) {
        return null;
      }

      const saveData = JSON.parse(stored);

      return (saveData.options as GameOptions) || null;
    } catch (error) {
      console.error("Error loading game options:", error);
      return null;
    }
  };

  // Session Management for Multiple Games
  const saveGameSession = async (session: GameSession): Promise<boolean> => {
    try {
      if (!isStorageAvailable()) {
        throw new Error("localStorage is not available");
      }

      const sessions = await loadGameSessions();

      // Update existing session or add new one
      const existingIndex = sessions.findIndex((s) => s.id === session.id);
      if (existingIndex >= 0) {
        sessions[existingIndex] = session;
      } else {
        sessions.push(session);
      }

      // Limit to 10 sessions
      if (sessions.length > 10) {
        sessions.splice(10);
      }

      const saveData = {
        version: CURRENT_VERSION,
        timestamp: Date.now(),
        sessions,
      };

      const serialized = JSON.stringify(saveData);
      localStorage.setItem("cs2-memory-game-sessions", serialized);

      return true;
    } catch (error) {
      console.error("Error saving game session:", error);
      return false;
    }
  };

  const loadGameSessions = async (): Promise<GameSession[]> => {
    try {
      if (!isStorageAvailable()) {
        return [];
      }

      const stored = localStorage.getItem("cs2-memory-game-sessions");
      if (!stored) {
        return [];
      }

      const saveData = JSON.parse(stored);
      return Array.isArray(saveData.sessions) ? saveData.sessions : [];
    } catch (error) {
      console.error("Error loading game sessions:", error);
      return [];
    }
  };

  const deleteGameSession = async (sessionId: string): Promise<boolean> => {
    try {
      const sessions = await loadGameSessions();
      const filtered = sessions.filter((s) => s.id !== sessionId);

      const saveData = {
        version: CURRENT_VERSION,
        timestamp: Date.now(),
        sessions: filtered,
      };

      const serialized = JSON.stringify(saveData);
      localStorage.setItem("cs2-memory-game-sessions", serialized);

      return true;
    } catch (error) {
      console.error("Error deleting game session:", error);
      return false;
    }
  };

  // Utility Functions
  const getStorageUsage = (): {
    used: number;
    available: number;
    percentage: number;
  } => {
    if (!isStorageAvailable()) {
      return { used: 0, available: 0, percentage: 0 };
    }

    try {
      let used = 0;
      for (const key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
          used += localStorage[key].length;
        }
      }

      // Estimate available space (browsers typically allow 5-10MB)
      const estimated = 5 * 1024 * 1024; // 5MB estimate
      const percentage = (used / estimated) * 100;

      return {
        used,
        available: estimated - used,
        percentage: Math.min(percentage, 100),
      };
    } catch {
      return { used: 0, available: 0, percentage: 0 };
    }
  };

  const clearAllData = async (): Promise<boolean> => {
    try {
      if (!isStorageAvailable()) {
        throw new Error("localStorage is not available");
      }

      // Clear all game-related data
      localStorage.removeItem(getStorageKey("GAME_STATE"));
      localStorage.removeItem(getStorageKey("GAME_HISTORY"));
      localStorage.removeItem(getStorageKey("GAME_OPTIONS"));
      localStorage.removeItem(getStorageKey("API_CACHE"));
      localStorage.removeItem("cs2-memory-game-sessions");
      localStorage.removeItem("cs2-memory-seed-history");

      state.value.lastSaved = null;
      console.log("All game data cleared");
      return true;
    } catch (error) {
      console.error("Error clearing all data:", error);
      return false;
    }
  };

  const clearError = (): void => {
    state.value.error = null;
  };

  return {
    // State
    state: readonly(state),

    // Computed
    canSave,
    hasError,

    // Game State
    saveGameState,
    loadGameState,
    deleteGameState,

    // Game History
    saveGameResult,
    loadGameHistory,
    clearGameHistory,

    // Game Options
    saveGameOptions,
    loadGameOptions,

    // Sessions
    saveGameSession,
    loadGameSessions,
    deleteGameSession,

    // Utilities
    getStorageUsage,
    clearAllData,
    clearError,
    isStorageAvailable,
  };
};
