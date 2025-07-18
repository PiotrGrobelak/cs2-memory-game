import { ref, computed } from "vue";
import { useGamePersistence } from "~/composables/data/useGamePersistence";
import type { GameResult } from "~/types/game";

export function useHistoryData() {
  const { loadGameHistory, clearGameHistory } = useGamePersistence();

  const loading = ref(true);
  const gameHistory = ref<GameResult[]>([]);

  const hasHistory = computed(() => gameHistory.value.length > 0);

  /**
   * Load game history from persistence layer
   */
  const loadHistory = async (): Promise<void> => {
    try {
      loading.value = true;
      const history = await loadGameHistory();
      gameHistory.value = history.sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
      );
    } catch (error) {
      console.error("Error loading game history:", error);
      throw error;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Clear all game history
   */
  const clearHistory = async (): Promise<boolean> => {
    try {
      const success = await clearGameHistory();
      if (success) {
        gameHistory.value = [];
        return true;
      }
      throw new Error("Failed to clear history");
    } catch (error) {
      console.error("Error clearing history:", error);
      throw error;
    }
  };

  return {
    // State
    loading,
    gameHistory,

    // Computed
    hasHistory,

    // Actions
    loadHistory,
    clearHistory,
  };
}
