<template>
  <div class="mb-2 transition-all duration-200">
    <div class="flex justify-between items-center">
      <NuxtLink
        to="/history"
        class="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 no-underline"
        title="Click to view game history"
      >
        <h1>CS2 Memory Game</h1>
      </NuxtLink>
      <div class="flex items-center gap-3">
        <NuxtLink to="/history">
          <Button
            icon="pi pi-history"
            severity="secondary"
            outlined
            aria-label="Game History"
            class="transition-all duration-200 hover:shadow-md"
          />
        </NuxtLink>
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
import Button from "primevue/button";
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
