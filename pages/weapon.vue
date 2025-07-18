<template>
  <div
    class="weapon-display-page min-h-screen bg-gray-900 flex items-center justify-center p-4"
  >
    <div class="weapon-container w-full max-w-6xl relative">
      <div
        v-if="isLoading"
        class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 rounded-lg"
      >
        <div class="text-white text-center">
          <i class="pi pi-spin pi-spinner text-4xl mb-4" />
          <p>Loading weapons...</p>
        </div>
      </div>

      <div
        v-if="error"
        class="absolute inset-0 bg-red-500 bg-opacity-20 flex items-center justify-center z-10 rounded-lg"
      >
        <div class="text-red-800 text-center bg-white p-4 rounded-lg">
          <i class="pi pi-exclamation-triangle text-2xl mb-2" />
          <p>{{ error }}</p>
          <button
            class="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            @click="loadRandomWeapons"
          >
            Try Again
          </button>
        </div>
      </div>

      <!-- Animated Canvas with Elastic Bounce Animation -->
      <div
        v-if="selectedWeapons.length > 0 && !isLoading && !error"
        class="h-full min-h-[600px]"
      >
        <WeaponGridAnimated
          ref="weaponGridRef"
          :weapons="selectedWeapons"
          :canvas-width="1200"
          :canvas-height="600"
          @canvas-ready="onCanvasReady"
          @canvas-error="onCanvasError"
        />
      </div>

      <!-- Control Buttons -->
      <div v-if="selectedWeapons.length > 0" class="mt-6 text-center space-x-4">
        <button
          class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
          @click="loadRandomWeapons"
        >
          <i class="pi pi-refresh mr-2" />
          Load New Weapons
        </button>
        <button
          class="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-lg"
          @click="resetGrid"
        >
          <i class="pi pi-replay mr-2" />
          Reset All Cards
        </button>
      </div>

      <!-- Animation Instructions -->
      <div v-if="selectedWeapons.length > 0" class="mt-4 text-center">
        <div
          class="bg-gray-800 bg-opacity-80 text-white p-4 rounded-lg max-w-2xl mx-auto"
        >
          <h3 class="text-lg font-bold text-purple-400 mb-2">
            🎯 Elastic Bounce Animation
          </h3>
          <p class="text-sm mb-2">
            All cards now use the same beautiful elastic bounce effect!
          </p>
          <div class="bg-purple-500 bg-opacity-20 p-4 rounded text-center">
            <span class="text-purple-400 font-bold text-lg"
              >✨ Elastic Bounce Effect ✨</span
            >
            <p class="text-white text-sm mt-2">
              Click any card to see the smooth bouncy animation with elastic
              entrance
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { CS2Item } from "~/types/game";
import { useCS2Data } from "~/composables/data/useCS2Data";

// Set page title and meta
useHead({
  title: "CS2 Elastic Bounce Animation",
  meta: [
    {
      name: "description",
      content:
        "Preview elastic bounce animation for card flips using Pixi.js - smooth and dynamic effects",
    },
  ],
});

// State
const selectedWeapons = ref<CS2Item[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);
const weaponGridRef = ref();

// Composables
const { state, initializeData, getItemsForGame } = useCS2Data();

// Methods
const loadRandomWeapons = async () => {
  try {
    isLoading.value = true;
    error.value = null;

    // Initialize data if not already loaded
    if (!state.value.items.length) {
      await initializeData(50); // Load 50 weapons for bounce animation
    }

    // Get 4 random weapons for bounce animation showcase
    const weapons = getItemsForGame(4, Math.random().toString());
    if (weapons.length > 0) {
      selectedWeapons.value = weapons;
      console.log(
        "Selected weapons for bounce animation:",
        selectedWeapons.value,
      );
    } else {
      throw new Error("No weapons available for bounce animation");
    }
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Failed to load weapons";
    error.value = errorMessage;
    console.error("Error loading weapons:", err);
  } finally {
    isLoading.value = false;
  }
};

const onCanvasReady = () => {
  console.log("Animated weapon grid canvas is ready - bounce animation loaded");
};

const onCanvasError = (errorMessage: string) => {
  error.value = errorMessage;
  console.error("Animation canvas error:", errorMessage);
};

const resetGrid = () => {
  if (weaponGridRef.value && weaponGridRef.value.resetTiles) {
    weaponGridRef.value.resetTiles();
    console.log("All animated cards reset to initial state");
  }
};

// Initialize on mount
onMounted(() => {
  loadRandomWeapons();
});
</script>

<style scoped>
.weapon-display-page {
  background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
}

.weapon-container {
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 2rem;
}
</style>
