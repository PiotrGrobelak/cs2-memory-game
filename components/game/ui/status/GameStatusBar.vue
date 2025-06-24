<template>
  <div class="portrait:mb-2">
    <div class="grid grid-cols-4 gap-1 justify-center">
      <GameStatCard
        icon="pi-clock"
        label="Time"
        :value="formattedTime"
        color="blue"
      />
      <GameStatCard
        icon="pi-cursor"
        label="Moves"
        :value="stats.moves"
        color="purple"
      />
      <GameStatCard
        icon="pi-check-circle"
        label="Matches"
        :value="`${stats.matchesFound} / ${stats.totalPairs}`"
        color="green"
      />
      <GameStatCard
        icon="pi-star"
        label="Score"
        :value="currentScore.toLocaleString()"
        color="yellow"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import GameStatCard from "./GameStatCard.vue";
import { useTimeFormatting } from "~/composables/utils/useTimeFormatting";

interface Stats {
  moves: number;
  matchesFound: number;
  totalPairs: number;
}

interface Props {
  timeElapsed: number;
  stats: Stats;
  currentScore: number;
}

const props = defineProps<Props>();
const { formatGameTime } = useTimeFormatting();

const formattedTime = computed(() => {
  // timeElapsed is now in seconds from core store, convert to ms for display
  return formatGameTime(props.timeElapsed * 1000);
});
</script>
