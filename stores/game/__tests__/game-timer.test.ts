import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGameTimerStore } from "~/stores/game/timer";

describe("Game Timer Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe("Initial State", () => {
    it("should initialize with correct default state", () => {
      const store = useGameTimerStore();

      expect(store.startTime).toBeNull();
      expect(store.timeElapsed).toBe(0);
      expect(store.isRunning).toBe(false);
      expect(store.formattedTime).toBe("00:00");
      expect(store.timeInSeconds).toBe(0);
    });
  });

  describe("Timer Operations", () => {
    it("should start timer correctly", () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();
      const mockDate = new Date("2023-01-01T00:00:00.000Z");
      vi.setSystemTime(mockDate);

      store.startTimer();

      expect(store.isRunning).toBe(true);
      expect(store.startTime).toBe(mockDate.getTime());

      vi.useRealTimers();
    });

    it("should not start timer if already running", () => {
      const store = useGameTimerStore();

      store.startTimer();
      const firstStartTime = store.startTime;

      // Try to start again
      store.startTimer();

      expect(store.startTime).toBe(firstStartTime);
    });

    it("should pause timer correctly", async () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();

      store.startTimer();
      expect(store.isRunning).toBe(true);

      // Advance time by 1 second
      vi.advanceTimersByTime(1000);

      store.pauseTimer();

      expect(store.isRunning).toBe(false);
      expect(store.timeElapsed).toBeGreaterThan(900); // Should be around 1000ms

      vi.useRealTimers();
    });

    it("should not pause timer if not running", () => {
      const store = useGameTimerStore();

      store.pauseTimer();

      expect(store.isRunning).toBe(false);
      expect(store.timeElapsed).toBe(0);
    });

    it("should reset timer correctly", () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();

      store.startTimer();
      vi.advanceTimersByTime(5000);
      store.pauseTimer();

      expect(store.timeElapsed).toBeGreaterThan(0);

      store.resetTimer();

      expect(store.isRunning).toBe(false);
      expect(store.timeElapsed).toBe(0);
      expect(store.startTime).toBeNull();

      vi.useRealTimers();
    });

    it("should resume timer correctly", () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();

      // Start, pause, then resume
      store.startTimer();
      vi.advanceTimersByTime(1000);
      store.pauseTimer();

      const elapsedAfterPause = store.timeElapsed;
      expect(elapsedAfterPause).toBeGreaterThan(900);

      store.resumeTimer();

      expect(store.isRunning).toBe(true);
      expect(store.startTime).not.toBeNull();

      vi.useRealTimers();
    });

    it("should stop timer and keep elapsed time", () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();

      store.startTimer();
      vi.advanceTimersByTime(2000);

      const elapsedBeforeStop = store.getCurrentElapsedTime();
      store.stopTimer();

      expect(store.isRunning).toBe(false);
      expect(store.startTime).toBeNull();
      expect(store.timeElapsed).toBeCloseTo(elapsedBeforeStop, -2); // Within 100ms

      vi.useRealTimers();
    });
  });

  describe("Time Formatting", () => {
    it("should format zero time correctly", () => {
      const store = useGameTimerStore();

      expect(store.formattedTime).toBe("00:00");
      expect(store.timeInSeconds).toBe(0);
    });

    it("should format seconds correctly", () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();

      // Start timer and advance to 30 seconds
      store.startTimer();
      vi.advanceTimersByTime(30000);
      store.pauseTimer();

      expect(store.formattedTime).toBe("00:30");
      expect(store.timeInSeconds).toBe(30);

      vi.useRealTimers();
    });

    it("should format minutes and seconds correctly", () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();

      // Start timer and advance to 1 minute 25 seconds
      store.startTimer();
      vi.advanceTimersByTime(85000);
      store.pauseTimer();

      expect(store.formattedTime).toBe("01:25");
      expect(store.timeInSeconds).toBe(85);

      vi.useRealTimers();
    });

    it("should format time over 10 minutes correctly", () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();

      // Start timer and advance to 12 minutes 5 seconds
      store.startTimer();
      vi.advanceTimersByTime(725000);
      store.pauseTimer();

      expect(store.formattedTime).toBe("12:05");
      expect(store.timeInSeconds).toBe(725);

      vi.useRealTimers();
    });

    it("should handle edge case of exactly 1 minute", () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();

      // Start timer and advance to exactly 1 minute
      store.startTimer();
      vi.advanceTimersByTime(60000);
      store.pauseTimer();

      expect(store.formattedTime).toBe("01:00");
      expect(store.timeInSeconds).toBe(60);

      vi.useRealTimers();
    });

    it("should handle fractional seconds by flooring", () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();

      // Start timer and advance to 30.9 seconds
      store.startTimer();
      vi.advanceTimersByTime(30900);
      store.pauseTimer();

      expect(store.formattedTime).toBe("00:30");
      expect(store.timeInSeconds).toBe(30);

      vi.useRealTimers();
    });
  });

  describe("Timer Updates", () => {
    it("should update elapsed time while running", async () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();

      store.startTimer();
      expect(store.timeElapsed).toBe(0);

      // Advance time by 500ms and let timer update
      vi.advanceTimersByTime(500);

      expect(store.timeElapsed).toBeGreaterThan(400);
      expect(store.timeElapsed).toBeLessThan(600);

      vi.useRealTimers();
    });

    it("should continue updating after resume", async () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();

      // Start timer, advance, pause
      store.startTimer();
      vi.advanceTimersByTime(1000);
      store.pauseTimer();

      const timeAfterPause = store.timeElapsed;

      // Resume and advance more
      store.resumeTimer();
      vi.advanceTimersByTime(1000);

      expect(store.timeElapsed).toBeGreaterThan(timeAfterPause + 900);

      vi.useRealTimers();
    });
  });

  describe("getCurrentElapsedTime Method", () => {
    it("should return current elapsed time when not running", () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();

      // Set elapsed time by running timer then pausing
      store.startTimer();
      vi.advanceTimersByTime(5000);
      store.pauseTimer();

      expect(store.getCurrentElapsedTime()).toBe(store.timeElapsed);

      vi.useRealTimers();
    });

    it("should calculate current elapsed time when running", () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();

      store.startTimer();
      vi.advanceTimersByTime(3000);

      const currentTime = store.getCurrentElapsedTime();
      expect(currentTime).toBeGreaterThan(2900);
      expect(currentTime).toBeLessThan(3100);

      vi.useRealTimers();
    });

    it("should return stored elapsed time when start time is null", () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();

      // Create elapsed time then stop
      store.startTimer();
      vi.advanceTimersByTime(2000);
      store.stopTimer();

      expect(store.getCurrentElapsedTime()).toBe(store.timeElapsed);

      vi.useRealTimers();
    });
  });

  describe("Interval Management", () => {
    it("should clean up interval on pause", () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");

      store.startTimer();
      store.pauseTimer();

      expect(clearIntervalSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("should clean up interval on reset", () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");

      store.startTimer();
      store.resetTimer();

      expect(clearIntervalSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("should not create multiple intervals", () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(global, "setInterval");

      store.startTimer();
      store.startTimer(); // Try to start again

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe("Edge Cases", () => {
    it("should handle pause when not running gracefully", () => {
      const store = useGameTimerStore();

      expect(() => store.pauseTimer()).not.toThrow();
      expect(store.isRunning).toBe(false);
      expect(store.timeElapsed).toBe(0);
    });

    it("should handle resume when already running", () => {
      const store = useGameTimerStore();

      store.startTimer();
      const firstStartTime = store.startTime;

      store.resumeTimer(); // Should behave like start when already running

      expect(store.startTime).toBe(firstStartTime);
      expect(store.isRunning).toBe(true);
    });

    it("should handle very large elapsed times", () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();

      // Start timer and advance to 1 hour
      store.startTimer();
      vi.advanceTimersByTime(3600000);
      store.pauseTimer();

      expect(store.formattedTime).toBe("01:00:00");
      expect(store.timeInSeconds).toBe(3600);

      vi.useRealTimers();
    });

    it("should handle reset during running state", () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();

      store.startTimer();
      vi.advanceTimersByTime(1000);

      store.resetTimer();

      expect(store.isRunning).toBe(false);
      expect(store.timeElapsed).toBe(0);
      expect(store.startTime).toBeNull();

      vi.useRealTimers();
    });
  });

  describe("Timer Accuracy", () => {
    it("should maintain reasonable accuracy over time", async () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();

      store.startTimer();

      // Simulate timer running for 5 seconds with multiple intervals
      for (let i = 0; i < 50; i++) {
        vi.advanceTimersByTime(100);
      }

      const elapsed = store.getCurrentElapsedTime();
      expect(elapsed).toBeGreaterThan(4900); // Should be close to 5000ms
      expect(elapsed).toBeLessThan(5100);

      vi.useRealTimers();
    });

    it("should handle rapid start/pause cycles", () => {
      const store = useGameTimerStore();
      vi.useFakeTimers();

      for (let i = 0; i < 5; i++) {
        store.startTimer();
        vi.advanceTimersByTime(100);
        store.pauseTimer();
      }

      expect(store.timeElapsed).toBeGreaterThan(400); // Should accumulate time
      expect(store.isRunning).toBe(false);

      vi.useRealTimers();
    });
  });
});
