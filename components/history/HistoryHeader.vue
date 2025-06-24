<template>
  <div class="mb-6">
    <div
      class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4"
    >
      <div>
        <h1
          class="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white mb-2"
        >
          Game History
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          Track your progress and performance across all completed games
        </p>
      </div>
      <div class="flex flex-col sm:flex-row gap-2">
        <NuxtLink to="/">
          <Button
            label="Back to Game"
            icon="pi pi-arrow-left"
            severity="secondary"
            outlined
            class="w-full sm:w-auto"
          />
        </NuxtLink>
        <Button
          class="w-full sm:w-auto"
          label="Clear History"
          icon="pi pi-trash"
          severity="danger"
          outlined
          :disabled="!hasHistory"
          @click="$emit('clearHistory')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from "primevue/button";

interface Props {
  hasHistory: boolean;
}

defineProps<Props>();

interface Emits {
  (e: "clearHistory"): void;
}

defineEmits<Emits>();
</script>
