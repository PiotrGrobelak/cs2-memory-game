<template>
  <div
    class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
  >
    <div class="flex justify-between items-start mb-3">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <Badge
            :value="game.difficulty"
            :severity="difficultySeverity"
            class="capitalize"
          />
          <span class="text-sm text-gray-500 dark:text-gray-400">{{
            displayIndex
          }}</span>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          {{ formattedDate }}
        </div>
      </div>
      <div class="text-right">
        <div class="text-lg font-bold text-gray-800 dark:text-white">
          {{ formattedScore }}
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">Score</div>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4 text-center">
      <div>
        <div class="text-sm font-semibold text-gray-800 dark:text-white">
          {{ formattedTimeElapsed }}
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">Time</div>
      </div>
      <div>
        <div class="text-sm font-semibold text-gray-800 dark:text-white">
          {{ game.moves }}
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">Moves</div>
      </div>
      <div>
        <div
          class="text-base font-semibold text-gray-800 dark:text-white text-mono cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          :title="game.seed"
          @click="$emit('copy-seed', game.seed)"
        >
          {{ shortSeed }}
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          Seed (tap to copy)
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Badge from "primevue/badge";
import type { GameResult } from "~/types/game";
import { useHistoryFormatters } from "~/composables/history/useHistoryFormatters";

interface Props {
  game: GameResult;
  index: number;
}

interface Emits {
  (e: "copy-seed", seed: string): void;
}

const props = defineProps<Props>();
defineEmits<Emits>();

const {
  formatTime,
  formatDate,
  formatScore,
  getDifficultySeverity,
  getShortSeed,
  getGameIndex,
} = useHistoryFormatters();

const displayIndex = computed(() => getGameIndex(props.index));
const formattedDate = computed(() => formatDate(props.game.completedAt));
const formattedScore = computed(() => formatScore(props.game.score));
const formattedTimeElapsed = computed(() => formatTime(props.game.timeElapsed));
const shortSeed = computed(() => getShortSeed(props.game.seed));
const difficultySeverity = computed(() =>
  getDifficultySeverity(props.game.difficulty)
);
</script>
