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

const formattedTime = computed(() => {
  const totalSeconds = Math.floor(props.timeElapsed / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  } else {
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
});
</script>
