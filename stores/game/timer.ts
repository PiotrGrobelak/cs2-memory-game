import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useTimeFormatting } from "~/composables/utils/useTimeFormatting";

export const useGameTimerStore = defineStore("game-timer", () => {
  // State
  const startTime = ref<number | null>(null);
  const timeElapsed = ref(0);
  const isRunning = ref(false);
  const intervalId = ref<number | null>(null);

  // Time formatting composable
  const { formatGameTime, msToSeconds } = useTimeFormatting();

  // Getters (computed)
  const formattedTime = computed(() => {
    return formatGameTime(timeElapsed.value);
  });

  const timeInSeconds = computed(() => msToSeconds(timeElapsed.value));

  // Actions
  const startTimer = (): void => {
    if (isRunning.value) return;

    isRunning.value = true;
    startTime.value = Date.now() - timeElapsed.value; // Account for any previous elapsed time

    // Update timer every 100ms for smooth updates
    intervalId.value = window.setInterval(() => {
      if (startTime.value) {
        timeElapsed.value = Date.now() - startTime.value;
      }
    }, 100);
  };

  const pauseTimer = (): void => {
    if (!isRunning.value) return;

    isRunning.value = false;

    if (intervalId.value) {
      clearInterval(intervalId.value);
      intervalId.value = null;
    }

    // Calculate final elapsed time
    if (startTime.value) {
      timeElapsed.value = Date.now() - startTime.value;
    }
  };

  const resetTimer = (): void => {
    isRunning.value = false;
    timeElapsed.value = 0;
    startTime.value = null;

    if (intervalId.value) {
      clearInterval(intervalId.value);
      intervalId.value = null;
    }
  };

  const resumeTimer = (): void => {
    startTimer(); // startTimer already handles resuming
  };

  const stopTimer = (): void => {
    pauseTimer();

    // Keep the elapsed time but mark as stopped
    startTime.value = null;
  };

  const getCurrentElapsedTime = (): number => {
    if (!isRunning.value || !startTime.value) {
      return timeElapsed.value;
    }

    return Date.now() - startTime.value;
  };

  const restoreTimer = (savedTime: number): void => {
    resetTimer();
    timeElapsed.value = savedTime;
  };

  return {
    // State
    startTime,
    timeElapsed,
    isRunning,

    // Getters
    formattedTime,
    timeInSeconds,

    // Actions
    startTimer,
    pauseTimer,
    resetTimer,
    resumeTimer,
    stopTimer,
    getCurrentElapsedTime,
    restoreTimer,
  };
});
