<template>
  <div v-if="error" class="min-h-screen flex items-center justify-center p-4">
    <GameErrorDisplay
      :error="error"
      @retry="handleRetry"
      @reset="handleReset"
    />
  </div>
  <div v-else>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref, provide } from "vue";
import GameErrorDisplay from "./GameErrorDisplay.vue";
import { ErrorBoundaryKey } from "~/utils/errorBoundary";

// State
const error = ref<Error | null>(null);

// Emits
interface Emits {
  (e: "retry" | "reset"): void;
}

const emit = defineEmits<Emits>();

// Error handler
const handleError = (err: Error) => {
  error.value = err;
  console.error("Error caught by boundary:", err);
};

// Event handlers
const handleRetry = () => {
  error.value = null;
  emit("retry");
};

const handleReset = () => {
  error.value = null;
  emit("reset");
};

// Provide error handler to children
provide(ErrorBoundaryKey, handleError);

// Expose error handler for external use
defineExpose({
  catchError: handleError,
  clearError: () => {
    error.value = null;
  },
  hasError: () => !!error.value,
});
</script>
