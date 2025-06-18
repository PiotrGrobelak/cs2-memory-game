import { ref } from "vue";
import { defineStore } from "pinia";

export const useGameUIStore = defineStore("gameUI", () => {
  // Dialog states
  const dialogsState = ref({
    settings: false,
    newGame: false,
    confirmRestart: false,
  });

  // UI options
  const uiOptions = ref({
    enableSound: true,
    enableParallax: true,
  });

  // Settings form state
  const settingsForm = ref({
    selectedDifficulty: "easy" as "easy" | "medium" | "hard",
    customSeed: "",
  });

  // New Game form state
  const newGameForm = ref({
    difficulty: "easy" as "easy" | "medium" | "hard",
    seedOption: "random" as "random" | "custom" | "history",
    customSeed: "",
    selectedHistorySeed: "",
  });

  // Actions
  const toggleDialog = (dialogName: keyof typeof dialogsState.value) => {
    dialogsState.value[dialogName] = !dialogsState.value[dialogName];
  };

  const openDialog = (dialogName: keyof typeof dialogsState.value) => {
    dialogsState.value[dialogName] = true;
  };

  const closeDialog = (dialogName: keyof typeof dialogsState.value) => {
    dialogsState.value[dialogName] = false;
  };

  const closeAllDialogs = () => {
    Object.keys(dialogsState.value).forEach((key) => {
      dialogsState.value[key as keyof typeof dialogsState.value] = false;
    });
  };

  const updateUIOption = <K extends keyof typeof uiOptions.value>(
    key: K,
    value: (typeof uiOptions.value)[K],
  ) => {
    uiOptions.value[key] = value;
  };

  const resetSettingsForm = () => {
    settingsForm.value = {
      selectedDifficulty: "easy",
      customSeed: "",
    };
  };

  const resetNewGameForm = () => {
    newGameForm.value = {
      difficulty: "easy",
      seedOption: "random",
      customSeed: "",
      selectedHistorySeed: "",
    };
  };

  return {
    // State
    dialogsState,
    uiOptions,
    settingsForm,
    newGameForm,

    // Actions
    toggleDialog,
    openDialog,
    closeDialog,
    closeAllDialogs,
    updateUIOption,
    resetSettingsForm,
    resetNewGameForm,
  };
});
