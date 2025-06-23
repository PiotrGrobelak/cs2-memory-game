<template>
  <div
    v-if="error"
    class="absolute inset-0 bg-red-500 bg-opacity-20 flex items-center justify-center z-30"
  >
    <div class="text-red-800 text-center bg-white p-4 rounded-lg">
      <i class="pi pi-exclamation-triangle text-2xl mb-2" />
      <p>{{ error }}</p>
      <button
        class="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        @click="$emit('retry')"
      >
        Retry
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  error: string | null;
}

interface Emits {
  (e: "retry"): void;
}

defineProps<Props>();
defineEmits<Emits>();
</script>
