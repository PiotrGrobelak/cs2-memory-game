import { ref, computed } from "vue";
import { useStorage } from "@vueuse/core";
import type { GameResult } from "~/types/game";

export function useHistoryFilters(gameHistory: Readonly<Ref<GameResult[]>>) {
  const selectedDifficulty = useStorage("history-filter-difficulty", "all");
  const searchQuery = useStorage("history-filter-search", "");

  const difficultyOptions = ref([
    { label: "All Difficulties", value: "all" },
    { label: "Easy", value: "easy" },
    { label: "Medium", value: "medium" },
    { label: "Hard", value: "hard" },
  ]);

  const filterByDifficulty = (games: GameResult[]): GameResult[] => {
    if (selectedDifficulty.value === "all") {
      return games;
    }
    return games.filter((game) => game.difficulty === selectedDifficulty.value);
  };

  const filterBySearch = (games: GameResult[]): GameResult[] => {
    const query = searchQuery.value.trim().toLowerCase();
    if (!query) {
      return games;
    }
    return games.filter(
      (game) =>
        game.seed.toLowerCase().includes(query) ||
        game.id.toLowerCase().includes(query),
    );
  };

  const filteredHistory = computed(() => {
    let filtered = gameHistory.value;
    filtered = filterByDifficulty(filtered);
    filtered = filterBySearch(filtered);
    return filtered;
  });

  const hasFilteredResults = computed(() => filteredHistory.value.length > 0);

  const resetFilters = () => {
    selectedDifficulty.value = "all";
    searchQuery.value = "";
  };

  return {
    // Filter state
    selectedDifficulty,
    searchQuery,
    difficultyOptions,

    // Computed
    filteredHistory,
    hasFilteredResults,

    // Actions
    resetFilters,
  };
}
