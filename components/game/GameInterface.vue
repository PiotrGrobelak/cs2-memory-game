<template>
  <div class="game-interface">
    <!-- Game Header -->
    <div class="game-header mb-6">
      <div class="flex justify-between items-center">
        <h1 class="text-3xl font-bold text-gray-800 dark:text-white">
          CS2 Memory Game
        </h1>
        <div class="flex items-center gap-3">
          <Button
            icon="pi pi-cog"
            severity="secondary"
            outlined
            @click="showSettings = true"
            aria-label="Settings"
          />
          <Button
            icon="pi pi-share-alt"
            severity="success"
            outlined
            @click="shareGame"
            :disabled="!canShare"
            aria-label="Share Game"
          />
        </div>
      </div>
    </div>

    <!-- Game Status Bar -->
    <div class="game-status-bar mb-4">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card class="status-card">
          <template #content>
            <div class="flex items-center gap-3">
              <i class="pi pi-clock text-blue-500 text-2xl"></i>
              <div>
                <div class="text-sm text-gray-600 dark:text-gray-400">Time</div>
                <div class="text-lg font-semibold">{{ formattedTime }}</div>
              </div>
            </div>
          </template>
        </Card>

        <Card class="status-card">
          <template #content>
            <div class="flex items-center gap-3">
              <i class="pi pi-cursor text-purple-500 text-2xl"></i>
              <div>
                <div class="text-sm text-gray-600 dark:text-gray-400">
                  Moves
                </div>
                <div class="text-lg font-semibold">
                  {{ gameController.game.stats.value.moves }}
                </div>
              </div>
            </div>
          </template>
        </Card>

        <Card class="status-card">
          <template #content>
            <div class="flex items-center gap-3">
              <i class="pi pi-check-circle text-green-500 text-2xl"></i>
              <div>
                <div class="text-sm text-gray-600 dark:text-gray-400">
                  Matches
                </div>
                <div class="text-lg font-semibold">
                  {{ gameController.game.stats.value.matchesFound }} /
                  {{ gameController.game.stats.value.totalPairs }}
                </div>
              </div>
            </div>
          </template>
        </Card>

        <Card class="status-card">
          <template #content>
            <div class="flex items-center gap-3">
              <i class="pi pi-star text-yellow-500 text-2xl"></i>
              <div>
                <div class="text-sm text-gray-600 dark:text-gray-400">
                  Score
                </div>
                <div class="text-lg font-semibold">
                  {{ gameController.game.currentScore.value.toLocaleString() }}
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="mb-6">
      <div class="flex justify-between items-center mb-2">
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300"
          >Progress</span
        >
        <span class="text-sm text-gray-500 dark:text-gray-400"
          >{{ Math.round(gameController.gameProgress.value) }}%</span
        >
      </div>
      <ProgressBar
        :value="gameController.gameProgress.value"
        class="h-3"
        :showValue="false"
      />
    </div>

    <!-- Game Controls -->
    <div class="game-controls mb-6">
      <div class="flex flex-wrap gap-3 justify-center">
        <Button
          v-if="gameController.gameStatus.value === 'ready'"
          label="Start Game"
          icon="pi pi-play"
          severity="success"
          size="large"
          @click="startNewGame"
        />

        <Button
          v-if="gameController.gameStatus.value === 'playing'"
          label="Pause"
          icon="pi pi-pause"
          severity="warning"
          @click="pauseGame"
        />

        <Button
          v-if="gameController.gameStatus.value === 'playing'"
          label="Restart"
          icon="pi pi-refresh"
          severity="danger"
          outlined
          @click="confirmRestart = true"
        />

        <Button
          v-if="gameController.gameStatus.value === 'completed'"
          label="Play Again"
          icon="pi pi-replay"
          severity="success"
          size="large"
          @click="playAgain"
        />

        <Button
          label="New Game"
          icon="pi pi-plus"
          severity="info"
          outlined
          @click="showNewGameDialog = true"
        />
      </div>
    </div>

    <!-- Game Canvas Container -->
    <div class="game-canvas-container">
      <GameCanvas
        :enable-parallax="options.enableParallax"
        :enable-sound="options.enableSound"
      />
    </div>

    <!-- Settings Dialog -->
    <Dialog
      v-model:visible="showSettings"
      header="Game Settings"
      :modal="true"
      :closable="true"
      class="w-full max-w-md"
    >
      <div class="space-y-6">
        <!-- Difficulty Selection -->
        <div>
          <label class="block text-sm font-medium mb-2">Difficulty</label>
          <div class="grid grid-cols-3 gap-2">
            <Button
              v-for="diff in difficulties"
              :key="diff.name"
              :label="diff.label"
              :severity="
                selectedDifficulty === diff.name ? 'success' : 'secondary'
              "
              :outlined="selectedDifficulty !== diff.name"
              size="small"
              @click="selectedDifficulty = diff.name"
              class="flex flex-col items-center p-3"
            >
              <template #default>
                <div class="text-center">
                  <div class="font-semibold">{{ diff.label }}</div>
                  <div class="text-xs opacity-70">
                    {{ diff.cardCount }} cards
                  </div>
                </div>
              </template>
            </Button>
          </div>
        </div>

        <!-- Seed Input -->
        <div>
          <label class="block text-sm font-medium mb-2"
            >Custom Seed (Optional)</label
          >
          <InputText
            v-model="customSeed"
            placeholder="Enter custom seed..."
            class="w-full"
            :class="{ 'p-invalid': seedValidationError }"
          />
          <small v-if="seedValidationError" class="p-error">{{
            seedValidationError
          }}</small>
          <small v-else class="text-gray-500"
            >Leave empty for random seed</small
          >
        </div>

        <!-- Options -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium">Enable Sound Effects</label>
            <ToggleButton
              v-model="options.enableSound"
              onIcon="pi pi-volume-up"
              offIcon="pi pi-volume-off"
            />
          </div>

          <div class="flex items-center justify-between">
            <label class="text-sm font-medium">Enable Parallax Effects</label>
            <ToggleButton
              v-model="options.enableParallax"
              onIcon="pi pi-eye"
              offIcon="pi pi-eye-slash"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            label="Cancel"
            severity="secondary"
            outlined
            @click="cancelSettings"
          />
          <Button label="Apply" severity="success" @click="applySettings" />
        </div>
      </template>
    </Dialog>

    <!-- New Game Dialog -->
    <Dialog
      v-model:visible="showNewGameDialog"
      header="Start New Game"
      :modal="true"
      :closable="true"
      class="w-full max-w-lg"
    >
      <div class="space-y-4">
        <p class="text-gray-600 dark:text-gray-400">
          Configure your new game settings below:
        </p>

        <!-- Quick Difficulty Buttons -->
        <div>
          <label class="block text-sm font-medium mb-3"
            >Select Difficulty</label
          >
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card
              v-for="diff in difficulties"
              :key="diff.name"
              class="difficulty-card cursor-pointer transition-all duration-200 hover:shadow-lg"
              :class="{
                'ring-2 ring-blue-500': newGameDifficulty === diff.name,
              }"
              @click="newGameDifficulty = diff.name"
            >
              <template #content>
                <div class="text-center p-2">
                  <div class="text-lg font-semibold mb-1">{{ diff.label }}</div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">
                    {{ diff.cardCount }} cards
                  </div>
                  <div class="text-xs text-gray-500 mt-1">
                    {{ diff.gridSize.rows }}×{{ diff.gridSize.cols }} grid
                  </div>
                </div>
              </template>
            </Card>
          </div>
        </div>

        <!-- Seed Options -->
        <div>
          <label class="block text-sm font-medium mb-2">Seed Options</label>
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <RadioButton
                v-model="seedOption"
                inputId="random"
                value="random"
              />
              <label for="random" class="text-sm"
                >Random seed (recommended)</label
              >
            </div>
            <div class="flex items-center gap-2">
              <RadioButton
                v-model="seedOption"
                inputId="custom"
                value="custom"
              />
              <label for="custom" class="text-sm">Custom seed</label>
            </div>
            <div class="flex items-center gap-2">
              <RadioButton
                v-model="seedOption"
                inputId="history"
                value="history"
              />
              <label for="history" class="text-sm">From history</label>
            </div>
          </div>

          <!-- Custom Seed Input -->
          <div v-if="seedOption === 'custom'" class="mt-3">
            <InputText
              v-model="newGameSeed"
              placeholder="Enter custom seed..."
              class="w-full"
              :class="{ 'p-invalid': seedValidationError }"
            />
            <small v-if="seedValidationError" class="p-error">{{
              seedValidationError
            }}</small>
          </div>

          <!-- Seed History -->
          <div v-if="seedOption === 'history'" class="mt-3">
            <Dropdown
              v-model="selectedHistorySeed"
              :options="seedHistory"
              placeholder="Select from history"
              class="w-full"
              :disabled="seedHistory.length === 0"
            />
            <small v-if="seedHistory.length === 0" class="text-gray-500"
              >No seeds in history</small
            >
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            label="Cancel"
            severity="secondary"
            outlined
            @click="showNewGameDialog = false"
          />
          <Button
            label="Start Game"
            severity="success"
            @click="startNewGameWithOptions"
            :disabled="!canStartNewGame"
          />
        </div>
      </template>
    </Dialog>

    <!-- Confirmation Dialogs -->
    <ConfirmDialog />

    <!-- Game Completion Toast -->
    <Toast />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import type { GameOptions } from "~/types/game";
import { useGameController } from "~/composables/useGameController";

// PrimeVue components
import Button from "primevue/button";
import Card from "primevue/card";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import ToggleButton from "primevue/togglebutton";
import ProgressBar from "primevue/progressbar";
import Dropdown from "primevue/dropdown";
import RadioButton from "primevue/radiobutton";
import ConfirmDialog from "primevue/confirmdialog";
import Toast from "primevue/toast";

// Game components
import GameCanvas from "./GameCanvas.vue";

// Composables
const gameController = useGameController();
const _confirm = useConfirm();
const toast = useToast();

// UI State
const showSettings = ref(false);
const showNewGameDialog = ref(false);
const confirmRestart = ref(false);

// Settings
const selectedDifficulty = ref<GameOptions["difficulty"]>("easy");
const customSeed = ref("");
const options = ref<Omit<GameOptions, "difficulty" | "seed">>({
  enableSound: true,
  enableParallax: true,
});

// New Game Dialog
const newGameDifficulty = ref<GameOptions["difficulty"]>("easy");
const seedOption = ref<"random" | "custom" | "history">("random");
const newGameSeed = ref("");
const selectedHistorySeed = ref("");

// Difficulty configurations
const difficulties = [
  {
    name: "easy" as const,
    label: "Easy",
    cardCount: 12,
    gridSize: { rows: 3, cols: 4 },
  },
  {
    name: "medium" as const,
    label: "Medium",
    cardCount: 24,
    gridSize: { rows: 4, cols: 6 },
  },
  {
    name: "hard" as const,
    label: "Hard",
    cardCount: 48,
    gridSize: { rows: 6, cols: 8 },
  },
];

// Computed properties
const formattedTime = computed(() => {
  const seconds = Math.floor(gameController.game.timeElapsed.value);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
});

const canShare = computed(() => {
  return gameController.seedSystem.canShareSeed.value;
});

const seedValidationError = computed(() => {
  if (!customSeed.value && !newGameSeed.value) return null;
  const seed = customSeed.value || newGameSeed.value;
  const validation = gameController.seedSystem.validateSeed(seed);
  return validation.isValid ? null : validation.error;
});

const seedHistory = computed(() => {
  return [...gameController.seedSystem.state.value.seedHistory];
});

const canStartNewGame = computed(() => {
  if (seedOption.value === "custom") {
    return !seedValidationError.value && newGameSeed.value.length > 0;
  }
  if (seedOption.value === "history") {
    return !!selectedHistorySeed.value;
  }
  return true; // Random seed
});

// Methods
const startNewGame = async () => {
  try {
    await gameController.game.startGame();
  } catch {
    // Handle error if needed
  }
};

const pauseGame = () => {
  try {
    gameController.game.pauseGame();
  } catch {
    // Handle error if needed
  }
};

const playAgain = async () => {
  try {
    await gameController.restartGame();
  } catch {
    // Handle error if needed
  }
};

const shareGame = async () => {
  try {
    const shareUrl = gameController.shareCurrentGame();
    await navigator.clipboard.writeText(shareUrl);
    toast.add({
      severity: "success",
      summary: "Shared!",
      detail: "Game URL copied to clipboard",
      life: 3000,
    });
  } catch {
    toast.add({
      severity: "error",
      summary: "Share Failed",
      detail: "Could not copy URL to clipboard",
      life: 3000,
    });
  }
};

const cancelSettings = () => {
  // Reset to current values
  selectedDifficulty.value = gameController.game.difficulty.value.name;
  customSeed.value = "";
  showSettings.value = false;
};

const applySettings = async () => {
  const newOptions: GameOptions = {
    difficulty: selectedDifficulty.value,
    seed: customSeed.value || undefined,
    ...options.value,
  };

  try {
    await gameController.startNewGame(newOptions);
    showSettings.value = false;
    toast.add({
      severity: "success",
      summary: "Settings Applied",
      detail: "New game started with updated settings",
      life: 3000,
    });
  } catch {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Failed to apply settings",
      life: 3000,
    });
  }
};

const startNewGameWithOptions = async () => {
  let finalSeed: string | undefined;

  switch (seedOption.value) {
    case "custom":
      finalSeed = newGameSeed.value;
      break;
    case "history":
      finalSeed = selectedHistorySeed.value;
      break;
    default:
      finalSeed = undefined;
  }

  const newOptions: GameOptions = {
    difficulty: newGameDifficulty.value,
    seed: finalSeed,
    ...options.value,
  };

  try {
    await gameController.startNewGame(newOptions);
    showNewGameDialog.value = false;
    toast.add({
      severity: "success",
      summary: "New Game Started",
      detail: `Started ${newGameDifficulty.value} difficulty game`,
      life: 3000,
    });
  } catch {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Failed to start new game",
      life: 3000,
    });
  }
};

// Watchers
watch(
  () => gameController.game.isGameComplete.value,
  (isComplete) => {
    if (isComplete) {
      const score = gameController.game.currentScore.value;
      const time = formattedTime.value;
      const moves = gameController.game.stats.value.moves;

      toast.add({
        severity: "success",
        summary: "🎉 Congratulations!",
        detail: `Game completed in ${time} with ${moves} moves. Score: ${score.toLocaleString()}`,
        life: 5000,
      });
    }
  }
);

// Initialize on mount
onMounted(async () => {
  await gameController.initializeGame();
});
</script>

<!-- <style scoped>
.game-interface {
  @apply max-w-6xl mx-auto p-4;
}

.status-card {
  @apply transition-all duration-200 hover:shadow-md;
}

.difficulty-card {
  @apply transition-all duration-200;
}

.difficulty-card:hover {
  @apply transform scale-105;
}

.game-canvas-container {
  @apply bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-lg p-4 shadow-inner;
}
</style> -->
