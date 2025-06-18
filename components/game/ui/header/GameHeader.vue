<template>
  <div class="mb-6 transition-all duration-200">
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold text-gray-800 dark:text-white">
        CS2 Memory Game
      </h1>
      <div class="flex items-center gap-3">
        <GameSettingsButton @click="$emit('showSettings')" />
        <GameShareButton
          :disabled="!canShare"
          @click="$emit('shareGame', !canShare)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import GameSettingsButton from "./GameSettingsButton.vue";
import GameShareButton from "./GameShareButton.vue";

// Props
interface Props {
  canShare?: boolean;
}

withDefaults(defineProps<Props>(), {
  canShare: false,
});

// Emits
interface Emits {
  (e: "showSettings"): void;
  (e: "shareGame", disabled: boolean): void;
}

defineEmits<Emits>();
</script>
