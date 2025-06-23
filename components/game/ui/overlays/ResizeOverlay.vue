<template>
  <div
    v-if="isVisible"
    class="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center z-20 backdrop-blur-sm"
  >
    <div class="text-white text-center">
      <i class="pi pi-spin pi-spinner text-3xl mb-2" />
      <p class="text-sm font-medium">{{ message }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  isVisible: boolean;
  message?: string;
}

withDefaults(defineProps<Props>(), {
  message: "Optimizing layout...",
});
</script>
