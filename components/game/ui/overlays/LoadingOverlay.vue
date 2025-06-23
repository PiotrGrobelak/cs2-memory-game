<template>
  <div
    v-if="isVisible"
    class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10"
  >
    <div class="text-white text-center">
      <i class="pi pi-spin pi-spinner text-4xl mb-4" />
      <p>{{ message }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  isVisible: boolean;
  message?: string;
}

withDefaults(defineProps<Props>(), {
  message: "Initializing optimized canvas...",
});
</script>
