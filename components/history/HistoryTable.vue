<template>
  <DataTable
    :value="processedGames"
    responsive-layout="scroll"
    paginator-template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
    current-page-report-template="Showing {first} to {last} of {totalRecords} games"
    class="hidden md:block"
    striped-rows
    :rows-per-page-options="[10, 25, 50]"
    :paginator="processedGames.length > 10"
    :rows="10"
  >
    <Column field="completedAt" header="Date" sortable class="min-w-36">
      <template #body="{ data }">
        <div class="text-sm">
          <div class="font-medium">
            {{ data.formattedDate }}
          </div>
          <div class="text-gray-500 text-xs">
            {{ data.formattedTime }}
          </div>
        </div>
      </template>
    </Column>

    <Column field="difficulty" header="Difficulty" sortable class="min-w-24">
      <template #body="{ data }">
        <Badge
          :value="data.difficulty"
          :severity="data.difficultySeverity"
          class="capitalize"
        />
      </template>
    </Column>

    <Column field="score" header="Score" sortable class="min-w-24">
      <template #body="{ data }">
        <span class="font-semibold">{{ data.formattedScore }}</span>
      </template>
    </Column>

    <Column field="timeElapsed" header="Time" sortable class="min-w-20">
      <template #body="{ data }">
        <span class="font-mono">{{ data.formattedTimeElapsed }}</span>
      </template>
    </Column>

    <Column field="moves" header="Moves" sortable class="min-w-20">
      <template #body="{ data }">
        {{ data.moves }}
      </template>
    </Column>

    <Column field="seed" header="Seed" class="min-w-32">
      <template #body="{ data }">
        <div class="flex items-center gap-2">
          <code class="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
            {{ data.longSeed }}
          </code>
          <Button
            v-tooltip="'Copy full seed'"
            icon="pi pi-copy"
            size="small"
            severity="secondary"
            text
            @click="$emit('copySeed', data.seed)"
          />
        </div>
      </template>
    </Column>
  </DataTable>
</template>

<script setup lang="ts">
import { computed } from "vue";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Badge from "primevue/badge";
import Button from "primevue/button";
import type { GameResult } from "~/types/game";
import { useHistoryFormatters } from "~/composables/history/useHistoryFormatters";

interface Props {
  games: GameResult[];
}

const props = defineProps<Props>();

interface Emits {
  (e: "copySeed", seed: string): void;
}

defineEmits<Emits>();

const {
  formatTime,
  formatDate,
  formatScore,
  getDifficultySeverity,
  getLongSeed,
} = useHistoryFormatters();

/**
 * Pre-processed games with computed display values
 */
const processedGames = computed(() => {
  return props.games.map((game) => ({
    ...game,
    formattedDate: formatDate(game.completedAt),
    formattedTime: formatTime(new Date(game.completedAt).getTime(), true),
    formattedScore: formatScore(game.score),
    formattedTimeElapsed: formatTime(game.timeElapsed),
    longSeed: getLongSeed(game.seed),
    difficultySeverity: getDifficultySeverity(game.difficulty),
  }));
});
</script>

<style scoped>
.font-mono {
  font-family: "Courier New", Courier, monospace;
}
</style>
