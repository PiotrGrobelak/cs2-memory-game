<template>
  <div class="game-status-bar mb-4 transition-all duration-200">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
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

// Props
interface Props {
  timeElapsed: number;
  stats: Stats;
  currentScore: number;
}

const props = defineProps<Props>();

// Computed
const formattedTime = computed(() => {
  // Convert milliseconds to seconds
  const totalSeconds = Math.floor(props.timeElapsed / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Show hours only if the game has been running for more than an hour
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  } else {
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
});
</script>
