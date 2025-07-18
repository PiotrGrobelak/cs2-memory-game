import { computed } from "vue";
import type { GameResult } from "~/types/game";
import { useHistoryFormatters } from "./useHistoryFormatters";

export interface HistoryStat {
  key: string;
  label: string;
  value: string;
  icon: string;
  valueClass: string;
}

export function useHistoryStats(gameHistory: Readonly<Ref<GameResult[]>>) {
  const { formatTime, formatScore } = useHistoryFormatters();

  const bestTime = computed(() => {
    if (gameHistory.value.length === 0) return "N/A";
    const best = Math.min(...gameHistory.value.map((g) => g.timeElapsed));
    return formatTime(best);
  });

  const bestScore = computed(() => {
    if (gameHistory.value.length === 0) return 0;
    return Math.max(...gameHistory.value.map((g) => g.score));
  });

  const fewestMoves = computed(() => {
    if (gameHistory.value.length === 0) return "N/A";
    return Math.min(...gameHistory.value.map((g) => g.moves));
  });

  const averageTime = computed(() => {
    if (gameHistory.value.length === 0) return "N/A";
    const avg =
      gameHistory.value.reduce((sum, g) => sum + g.timeElapsed, 0) /
      gameHistory.value.length;
    return formatTime(avg);
  });

  const totalGamesCount = computed(() => gameHistory.value.length);

  const difficultyStats = computed(() => {
    if (gameHistory.value.length === 0) return {};
    return gameHistory.value.reduce(
      (acc, game) => {
        acc[game.difficulty] = (acc[game.difficulty] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  });

  const stats = computed<HistoryStat[]>(() => [
    {
      key: "totalGames",
      label: "Total Games",
      value: totalGamesCount.value.toString(),
      icon: "pi pi-play text-2xl text-blue-500 mb-2",
      valueClass: "text-xl font-bold text-blue-600 dark:text-blue-400",
    },
    {
      key: "bestTime",
      label: "Best Time",
      value: bestTime.value,
      icon: "pi pi-clock text-2xl text-green-500 mb-2",
      valueClass: "text-xl font-bold text-green-600 dark:text-green-400",
    },
    {
      key: "bestScore",
      label: "Best Score",
      value: formatScore(bestScore.value),
      icon: "pi pi-target text-2xl text-orange-500 mb-2",
      valueClass: "text-xl font-bold text-orange-600 dark:text-orange-400",
    },
    {
      key: "fewestMoves",
      label: "Fewest Moves",
      value: fewestMoves.value.toString(),
      icon: "pi pi-star text-2xl text-purple-500 mb-2",
      valueClass: "text-xl font-bold text-purple-600 dark:text-purple-400",
    },
  ]);

  return {
    // Individual stats
    bestTime,
    bestScore,
    fewestMoves,
    averageTime,
    totalGamesCount,
    difficultyStats,

    // Formatted for display
    stats,
  };
}
