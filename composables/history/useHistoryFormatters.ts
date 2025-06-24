import { useTimeFormatting } from "~/composables/utils/useTimeFormatting";

export function useHistoryFormatters() {
  const {
    formatHistoryTime,
    formatTimeOnly,
    formatDate: formatDateUtil,
  } = useTimeFormatting();

  const formatTime = (seconds: number, timeOnly = false): string => {
    if (timeOnly) {
      return formatTimeOnly(seconds);
    }
    return formatHistoryTime(seconds);
  };

  const formatDate = (date: string | Date): string => {
    return formatDateUtil(date);
  };

  const formatScore = (score: number): string => {
    return score.toLocaleString();
  };

  const getDifficultySeverity = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "success";
      case "medium":
        return "warning";
      case "hard":
        return "danger";
      default:
        throw new Error(`Invalid difficulty: ${difficulty}`);
    }
  };

  const getShortSeed = (seed: string, length = 8): string => {
    return `${seed.substring(0, length)}...`;
  };

  const getLongSeed = (seed: string): string => {
    return `${seed.substring(0, 12)}...`;
  };

  const getGameIndex = (index: number): string => {
    return `#${index + 1}`;
  };

  return {
    formatTime,
    formatDate,
    formatScore,
    getDifficultySeverity,
    getShortSeed,
    getLongSeed,
    getGameIndex,
  };
}
