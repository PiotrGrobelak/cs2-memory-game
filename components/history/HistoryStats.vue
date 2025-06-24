<template>
  <div v-if="hasHistory" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
    <Card v-for="stat in stats" :key="stat.key" class="text-center">
      <template #content>
        <div class="md:p-4">
          <i :class="stat.icon" class="text-sm md:text-base" />
          <h3
            class="text-sm md:text-lg font-semibold text-gray-800 dark:text-white"
          >
            {{ stat.label }}
          </h3>
          <p :class="stat.valueClass" class="text-xs md:text-base">
            {{ stat.value }}
          </p>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import Card from "primevue/card";
import type { HistoryStat } from "~/composables/history/useHistoryStats";

interface Props {
  hasHistory: boolean;
  stats: HistoryStat[];
}

defineProps<Props>();
</script>
