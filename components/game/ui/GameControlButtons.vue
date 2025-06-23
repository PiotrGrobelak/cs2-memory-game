<template>
  <div class="grid grid-cols-3 gap-2 md:grid-cols-3">
    <Button
      v-show="canResumeGame && gameStatus === 'ready'"
      label="Resume"
      icon="pi pi-play-circle"
      severity="success"
      size="small"
      class="w-[100px] sm:w-auto sm:min-w-[100px]"
      @click="$emit('resume-unfinished-game')"
    />

    <Button
      v-show="gameStatus === 'ready' && !canResumeGame"
      label="Start"
      icon="pi pi-play"
      severity="success"
      size="small"
      class="w-[100px] sm:w-auto sm:min-w-[100px]"
      @click="$emit('start-new-game')"
    />

    <Button
      v-show="gameStatus === 'playing'"
      label="Pause"
      icon="pi pi-pause"
      severity="warning"
      size="small"
      class="w-[100px] sm:w-auto sm:min-w-[100px]"
      @click="$emit('pause-game')"
    />

    <Button
      v-show="gameStatus === 'paused'"
      label="Resume"
      icon="pi pi-play"
      severity="success"
      size="small"
      class="w-[100px] sm:w-auto sm:min-w-[100px]"
      @click="$emit('resume-game')"
    />

    <Button
      v-show="gameStatus === 'completed'"
      label="Play Again"
      icon="pi pi-replay"
      severity="success"
      size="small"
      class="w-[100px] sm:w-auto sm:min-w-[100px]"
      @click="$emit('play-again')"
    />

    <Button
      label="New"
      icon="pi pi-plus"
      severity="info"
      outlined
      size="small"
      class="w-[100px] sm:w-auto sm:min-w-[100px]"
      @click="$emit('show-new-game-dialog')"
    />

    <Button
      v-show="canResumeGame"
      label="Clear"
      icon="pi pi-trash"
      severity="danger"
      outlined
      size="small"
      class="w-[100px] sm:w-auto sm:min-w-[100px]"
      @click="$emit('clear-unfinished-game')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useWindowSize } from "@vueuse/core";

type GameStatus = "ready" | "playing" | "paused" | "completed" | "initializing";

interface Props {
  canResumeGame: boolean;
  gameStatus: GameStatus;
}

type GameControlEvents =
  | "resume-unfinished-game"
  | "start-new-game"
  | "pause-game"
  | "resume-game"
  | "play-again"
  | "show-new-game-dialog"
  | "clear-unfinished-game";

interface Emits {
  (e: GameControlEvents): void;
}

defineProps<Props>();
defineEmits<Emits>();

const { width } = useWindowSize();

const buttonSize = computed(() => {
  return width.value <= 768 ? "small" : "large";
});
</script>
