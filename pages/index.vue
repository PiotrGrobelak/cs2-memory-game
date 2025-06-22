<template>
  <div class="min-h-screen">
    <!-- Error Screen -->
    <div
      v-if="hasError"
      class="error-screen min-h-screen bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900 dark:to-red-800 flex items-center justify-center p-4"
    >
      <Card class="max-w-md w-full">
        <template #content>
          <div class="text-center">
            <i class="pi pi-exclamation-triangle text-6xl text-red-500 mb-4" />
            <h2 class="text-2xl font-bold text-red-700 dark:text-red-300 mb-2">
              Game Error
            </h2>
            <p class="text-red-600 dark:text-red-400 mb-6">
              {{ errorMessage }}
            </p>
            <div class="flex gap-3 justify-center">
              <Button
                label="Reload Page"
                icon="pi pi-refresh"
                severity="danger"
                @click="reloadPage"
              />
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- Main Game Interface - Simplified -->
    <GameInterface v-else @error="handleGameError" />

    <!-- Global Toast Container -->
    <Toast position="top-right" />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

// PrimeVue components
import Button from "primevue/button";
import Card from "primevue/card";
import Toast from "primevue/toast";

// Game components
import GameInterface from "~/components/game/core/GameInterface.vue";

// Define page meta
definePageMeta({
  layout: "default",
  title: "CS2 Memory Game",
  description: "Test your memory with Counter-Strike 2 weapons and items",
});

// Simple error handling state
const hasError = ref(false);
const errorMessage = ref("");

// Methods
const handleGameError = (error: string) => {
  console.error("Game error:", error);
  hasError.value = true;
  errorMessage.value = error;
};

const reloadPage = () => {
  window.location.reload();
};

// Set page title
useHead({
  title: "CS2 Memory Game",
  meta: [
    {
      name: "description",
      content: "Test your memory with Counter-Strike 2 weapons and items",
    },
    {
      property: "og:title",
      content: "CS2 Memory Game",
    },
    {
      property: "og:description",
      content: "Test your memory with Counter-Strike 2 weapons and items",
    },
  ],
});
</script>

<style scoped>
.loading-screen {
  animation: fadeIn 0.5s ease-in-out;
}

.error-screen {
  animation: slideIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
