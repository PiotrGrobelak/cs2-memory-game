<template>
  <Card v-if="hasHistory" class="mb-6">
    <template #content>
      <div
        class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
      >
        <div class="flex flex-col sm:flex-row gap-4 flex-1">
          <div class="flex flex-col">
            <label
              class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Filter by Difficulty
            </label>
            <Select
              v-model="selectedDifficultyModel"
              :options="difficultyOptions"
              option-label="label"
              option-value="value"
              placeholder="All Difficulties"
              class="w-full sm:w-48"
            />
          </div>

          <div class="flex flex-col">
            <label
              class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Search by Seed
            </label>
            <InputText
              v-model="searchQueryModel"
              placeholder="Enter seed or game ID..."
              class="w-full sm:w-64"
            />
          </div>
        </div>

        <Divider layout="vertical" class="hidden lg:block" />

        <div class="flex flex-col sm:flex-row gap-2">
          <Button
            label="Export JSON"
            icon="pi pi-download"
            severity="secondary"
            outlined
            :disabled="!hasFilteredResults"
            class="w-full sm:w-auto"
            @click="$emit('exportHistory')"
          />
        </div>
      </div>

      <div
        v-if="hasHistory && !hasFilteredResults"
        class="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg"
      >
        <div
          class="flex items-center gap-2 text-orange-700 dark:text-orange-300"
        >
          <i class="pi pi-info-circle" />
          <span class="text-sm"
            >No games match the current filters. Try adjusting your search
            criteria.</span
          >
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import Card from "primevue/card";
import Select from "primevue/select";
import InputText from "primevue/inputtext";
import Button from "primevue/button";
import Divider from "primevue/divider";

interface DifficultyOption {
  label: string;
  value: string;
}

interface Props {
  hasHistory: boolean;
  hasFilteredResults: boolean;
  difficultyOptions: DifficultyOption[];
}

defineProps<Props>();

const selectedDifficultyModel = defineModel<string>("selectedDifficulty", {
  required: true,
});
const searchQueryModel = defineModel<string>("searchQuery", { required: true });

interface Emits {
  (e: "exportHistory"): void;
}

defineEmits<Emits>();
</script>
