import type { InjectionKey } from "vue";

// Error boundary injection key
export const ErrorBoundaryKey: InjectionKey<(error: Error) => void> =
  Symbol("errorBoundary");
