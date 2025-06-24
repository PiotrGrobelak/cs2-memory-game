import { intervalToDuration } from "date-fns";

export interface TimeFormatOptions {
  includeHours?: boolean;
  includeSeconds?: boolean;
  format?: "compact" | "long";
}

export function useTimeFormatting() {
  /**
   * Format milliseconds to readable time string
   * @param milliseconds Time in milliseconds
   * @param options Formatting options
   * @returns Formatted time string
   */
  const formatTimeFromMs = (
    milliseconds: number,
    options: TimeFormatOptions = {}
  ): string => {
    const {
      includeHours = true,
      includeSeconds = true,
      format = "compact",
    } = options;

    if (milliseconds < 0) return "00:00";

    const duration = intervalToDuration({
      start: 0,
      end: milliseconds,
    });

    const hours = duration.hours || 0;
    const minutes = duration.minutes || 0;
    const seconds = duration.seconds || 0;

    if (format === "long") {
      const parts: string[] = [];
      if (includeHours && hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      if (includeSeconds && seconds > 0) parts.push(`${seconds}s`);
      return parts.join(" ") || "0s";
    }

    // Compact format (HH:MM:SS or MM:SS)
    if (includeHours || hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }

    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  /**
   * Format seconds to readable time string
   * @param seconds Time in seconds
   * @param options Formatting options
   * @returns Formatted time string
   */
  const formatTimeFromSeconds = (
    seconds: number,
    options: TimeFormatOptions = {}
  ): string => {
    return formatTimeFromMs(seconds * 1000, options);
  };

  /**
   * Convert milliseconds to seconds
   * @param milliseconds Time in milliseconds
   * @returns Time in seconds
   */
  const msToSeconds = (milliseconds: number): number => {
    return Math.floor(milliseconds / 1000);
  };

  /**
   * Convert seconds to milliseconds
   * @param seconds Time in seconds
   * @returns Time in milliseconds
   */
  const secondsToMs = (seconds: number): number => {
    return seconds * 1000;
  };

  /**
   * Format time for display in game UI (always show MM:SS, add hours if needed)
   * @param milliseconds Time in milliseconds
   * @returns Formatted time string for game display
   */
  const formatGameTime = (milliseconds: number): string => {
    return formatTimeFromMs(milliseconds, {
      includeHours: false, // Only show hours if > 0
      includeSeconds: true,
      format: "compact",
    });
  };

  /**
   * Format time for history display (always show HH:MM:SS)
   * @param seconds Time in seconds
   * @returns Formatted time string for history display
   */
  const formatHistoryTime = (seconds: number): string => {
    return formatTimeFromSeconds(seconds, {
      includeHours: true,
      includeSeconds: true,
      format: "compact",
    });
  };

  /**
   * Get current timestamp in milliseconds
   * @returns Current timestamp
   */
  const getCurrentTimestamp = (): number => {
    return Date.now();
  };

  /**
   * Format date for display
   * @param date Date to format
   * @returns Formatted date string
   */
  const formatDate = (date: string | Date): string => {
    const d = new Date(date);
    return d.toLocaleDateString();
  };

  /**
   * Format time-only for display (HH:MM:SS from timestamp)
   * @param timestamp Timestamp in milliseconds
   * @returns Formatted time string
   */
  const formatTimeOnly = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return {
    // Core formatting functions
    formatTimeFromMs,
    formatTimeFromSeconds,

    // Conversion utilities
    msToSeconds,
    secondsToMs,

    // Specific use cases
    formatGameTime,
    formatHistoryTime,
    formatDate,
    formatTimeOnly,

    // Utilities
    getCurrentTimestamp,
  };
}
