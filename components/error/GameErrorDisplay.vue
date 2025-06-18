<template>
  <div
    class="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900 dark:to-red-800 flex items-center justify-center p-4"
  >
    <Card class="max-w-md w-full">
      <template #content>
        <div class="text-center">
          <i class="pi pi-exclamation-triangle text-6xl text-red-500 mb-4" />
          <h2 class="text-2xl font-bold text-red-700 dark:text-red-300 mb-2">
            Game Loading Error
          </h2>
          <p class="text-red-600 dark:text-red-400 mb-6">
            {{ displayMessage }}
          </p>
          <div
            v-if="showDetails"
            class="mb-4 p-3 bg-red-100 dark:bg-red-800 rounded text-left"
          >
            <pre
              class="text-xs text-red-800 dark:text-red-200 whitespace-pre-wrap"
              >{{ error.stack }}</pre
            >
          </div>
          <div class="flex gap-3 justify-center mb-4">
            <Button
              label="Retry"
              icon="pi pi-refresh"
              severity="danger"
              @click="$emit('retry')"
            />
            <Button
              label="Reset Data"
              icon="pi pi-trash"
              severity="secondary"
              outlined
              @click="$emit('reset')"
            />
          </div>
          <Button
            :label="showDetails ? 'Hide Details' : 'Show Details'"
            :icon="showDetails ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
            text
            size="small"
            @click="toggleDetails"
          />
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import Card from "primevue/card";
import Button from "primevue/button";

// Props
interface Props {
  error: Error;
}

const props = defineProps<Props>();

// Emits
interface Emits {
  (e: "retry" | "reset"): void;
}

defineEmits<Emits>();

// State
const showDetails = ref(false);

// Computed
const displayMessage = computed(() => {
  return (
    props.error.message || "An unknown error occurred while loading the game"
  );
});

// Methods
const toggleDetails = () => {
  showDetails.value = !showDetails.value;
};
</script>
