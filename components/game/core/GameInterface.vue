<template>
  <div class="max-w-6xl mx-auto p-4">
    <!-- Game Header -->
    <GameHeader
      :can-share="canShare"
      @show-settings="uiStore.openDialog('settings')"
      @share-game="shareGame"
    />

    <!-- Game Status Bar -->
    <GameStatusBar
      :time-elapsed="gameController.game.timeElapsed.value"
      :stats="gameController.game.stats.value"
      :current-score="gameController.game.currentScore.value"
    />

    <!-- Progress Bar -->
    <GameProgressBar :progress="gameController.gameProgress.value" />

    <!-- Game Controls -->
    <div class="game-controls mb-6 transition-all duration-200">
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
          @click="uiStore.openDialog('confirmRestart')"
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
          @click="uiStore.openDialog('newGame')"
        />
      </div>
    </div>

    <!-- Game Canvas Container -->
    <div
      class="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-lg p-4 shadow-inner"
    >
      <GameCanvas
        :enable-parallax="uiStore.uiOptions.enableParallax"
        :enable-sound="uiStore.uiOptions.enableSound"
      />
    </div>

    <!-- Settings Dialog -->
    <SettingsDialog
      :visible="uiStore.dialogsState.settings"
      :difficulties="difficulties"
      :seed-validator="gameController.seedSystem.validateSeed"
      @visible="
        (value) =>
          value
            ? uiStore.openDialog('settings')
            : uiStore.closeDialog('settings')
      "
      @apply="handleSettingsApply"
      @cancel="uiStore.closeDialog('settings')"
    />

    <!-- New Game Dialog -->
    <NewGameDialog
      :visible="uiStore.dialogsState.newGame"
      :difficulties="difficulties"
      :seed-history="seedHistory"
      :seed-validator="gameController.seedSystem.validateSeed"
      @visible="
        (value) =>
          value ? uiStore.openDialog('newGame') : uiStore.closeDialog('newGame')
      "
      @start-game="handleNewGameStart"
      @cancel="uiStore.closeDialog('newGame')"
    />

    <!-- Confirmation Dialogs -->
    <ConfirmDialog />

    <!-- Game Completion Toast -->
    <Toast />
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted } from "vue";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import type { GameOptions } from "~/types/game";
import { useGameController } from "~/composables/core/useGameController";
import { useGameUIStore } from "~/stores/game/ui";

// PrimeVue components
import Button from "primevue/button";
import ConfirmDialog from "primevue/confirmdialog";
import Toast from "primevue/toast";

// Game components
import GameCanvas from "./GameCanvas.vue";
import GameHeader from "../ui/header/GameHeader.vue";
import GameStatusBar from "../ui/status/GameStatusBar.vue";
import GameProgressBar from "../ui/status/GameProgressBar.vue";
import SettingsDialog from "../dialogs/SettingsDialog.vue";
import NewGameDialog from "../dialogs/NewGameDialog.vue";

// Composables and stores
const gameController = useGameController();
const uiStore = useGameUIStore();
const _confirm = useConfirm();
const toast = useToast();

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
const canShare = computed(() => {
  return gameController.seedSystem.canShareSeed.value;
});

const seedHistory = computed(() => {
  return [...gameController.seedSystem.state.value.seedHistory];
});

// Methods
const startNewGame = async () => {
  try {
    await gameController.game.startGame();
  } catch (error) {
    console.error("Failed to start game:", error);
  }
};

const pauseGame = () => {
  try {
    gameController.game.pauseGame();
  } catch (error) {
    console.error("Failed to pause game:", error);
  }
};

const playAgain = async () => {
  try {
    await gameController.restartGame();
  } catch (error) {
    console.error("Failed to restart game:", error);
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
  } catch (error) {
    console.error("Failed to share game:", error);
    toast.add({
      severity: "error",
      summary: "Share Failed",
      detail: "Could not copy URL to clipboard",
      life: 3000,
    });
  }
};

const handleSettingsApply = async (settings: {
  difficulty: "easy" | "medium" | "hard";
  seed?: string;
  enableSound: boolean;
  enableParallax: boolean;
}) => {
  const newOptions: GameOptions = {
    difficulty: settings.difficulty,
    seed: settings.seed,
    enableSound: settings.enableSound,
    enableParallax: settings.enableParallax,
  };

  try {
    // Update UI options
    uiStore.updateUIOption("enableSound", settings.enableSound);
    uiStore.updateUIOption("enableParallax", settings.enableParallax);

    await gameController.startNewGame(newOptions);
    uiStore.closeDialog("settings");

    toast.add({
      severity: "success",
      summary: "Settings Applied",
      detail: "New game started with updated settings",
      life: 3000,
    });
  } catch (error) {
    console.error("Failed to apply settings:", error);
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Failed to apply settings",
      life: 3000,
    });
  }
};

const handleNewGameStart = async (options: {
  difficulty: "easy" | "medium" | "hard";
  seed?: string;
}) => {
  const newOptions: GameOptions = {
    difficulty: options.difficulty,
    seed: options.seed,
    enableSound: uiStore.uiOptions.enableSound,
    enableParallax: uiStore.uiOptions.enableParallax,
  };

  try {
    await gameController.startNewGame(newOptions);
    uiStore.closeDialog("newGame");

    toast.add({
      severity: "success",
      summary: "New Game Started",
      detail: `Started ${options.difficulty} difficulty game`,
      life: 3000,
    });
  } catch (error) {
    console.error("Failed to start new game:", error);
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
      const timeElapsed = gameController.game.timeElapsed.value;
      const moves = gameController.game.stats.value.moves;

      const minutes = Math.floor(timeElapsed / 60);
      const seconds = Math.floor(timeElapsed % 60);
      const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

      toast.add({
        severity: "success",
        summary: "🎉 Congratulations!",
        detail: `Game completed in ${formattedTime} with ${moves} moves. Score: ${score.toLocaleString()}`,
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
