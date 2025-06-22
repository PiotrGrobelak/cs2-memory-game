<template>
  <div class="mb-6 transition-all duration-200 w-1/2">
    <div class="flex justify-between items-center mb-2">
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
        Progress
      </span>
      <span class="text-sm text-gray-500 dark:text-gray-400">
        {{ Math.round(progress) }}%
      </span>
    </div>
    <ProgressBar :value="progress" class="h-3" :show-value="false" />
  </div>
</template>

<script setup lang="ts">
import ProgressBar from "primevue/progressbar";

// Props
interface Props {
  progress: number;
}

defineProps<Props>();
</script>
