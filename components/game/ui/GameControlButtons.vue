<template>
  <div class="flex flex-wrap gap-3 justify-start items-start">
    <Button
      v-if="canResumeGame && gameStatus === 'ready'"
      label="Resume Game"
      icon="pi pi-play-circle"
      severity="success"
      size="large"
      class="min-w-[140px]"
      @click="$emit('resume-unfinished-game')"
    />

    <Button
      v-if="gameStatus === 'ready' && !canResumeGame"
      label="Start Game"
      icon="pi pi-play"
      severity="success"
      size="large"
      class="min-w-[140px]"
      @click="$emit('start-new-game')"
    />

    <Button
      v-if="gameStatus === 'playing'"
      label="Pause"
      icon="pi pi-pause"
      severity="warning"
      size="large"
      class="min-w-[140px]"
      @click="$emit('pause-game')"
    />

    <Button
      v-if="gameStatus === 'paused'"
      label="Resume"
      icon="pi pi-play"
      severity="success"
      size="large"
      class="min-w-[140px]"
      @click="$emit('resume-game')"
    />

    <Button
      v-if="gameStatus === 'completed'"
      label="Play Again"
      icon="pi pi-replay"
      severity="success"
      size="large"
      class="min-w-[140px]"
      @click="$emit('play-again')"
    />

    <Button
      label="New Game"
      icon="pi pi-plus"
      severity="info"
      outlined
      size="large"
      class="min-w-[140px]"
      @click="$emit('show-new-game-dialog')"
    />

    <Button
      v-if="canResumeGame"
      label="Clear Save"
      icon="pi pi-trash"
      severity="danger"
      outlined
      size="large"
      class="min-w-[140px]"
      @click="$emit('clear-unfinished-game')"
    />
  </div>
</template>

<script setup lang="ts">
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
</script>
