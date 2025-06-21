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

      <!-- Single Canvas with 2x2 Grid of Weapons -->
      <div
        v-if="selectedWeapons.length > 0 && !isLoading && !error"
        class="h-full min-h-[600px]"
      >
        <WeaponGrid
          ref="weaponGridRef"
          :weapons="selectedWeapons"
          :canvas-width="1200"
          :canvas-height="600"
          @canvas-ready="onCanvasReady"
          @canvas-error="onCanvasError"
        />
      </div>

      <div v-if="selectedWeapons.length > 0" class="mt-6 text-center space-x-4">
        <button
          class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          @click="loadRandomWeapons"
        >
          Show 4 New Weapons
        </button>
        <button
          class="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          @click="resetGrid"
        >
          Reset Green Tiles
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import type { CS2Item } from "~/types/game";
import { useCS2Data } from "~/composables/data/useCS2Data";

// Set page title
useHead({
  title: "CS2 Weapon Display - Memory Game",
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
      await initializeData(50); // Load 50 weapons
    }

    // Get 4 random weapons
    const weapons = getItemsForGame(4, Math.random().toString());
    if (weapons.length > 0) {
      selectedWeapons.value = weapons;
      console.log("Selected weapons:", selectedWeapons.value);
    } else {
      throw new Error("No weapons available");
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
  console.log("Weapon grid canvas is ready");
};

const onCanvasError = (errorMessage: string) => {
  error.value = errorMessage;
};

const resetGrid = () => {
  if (weaponGridRef.value && weaponGridRef.value.resetTiles) {
    weaponGridRef.value.resetTiles();
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
