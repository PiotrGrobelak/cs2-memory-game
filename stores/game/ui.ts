import { ref } from "vue";
import { defineStore } from "pinia";
import { useLocalStorage } from "@vueuse/core";

export const useGameUIStore = defineStore("gameUI", () => {
  const dialogsState = ref({
    settings: false,
    newGame: false,
    confirmRestart: false,
  });

  const uiOptions = {
    enableSound: useLocalStorage("game-sound-enabled", true),
    enableParallax: useLocalStorage("game-parallax-enabled", true),
    volume: useLocalStorage("game-volume", 50), // 0-100
  };

  const settingsForm = ref({
    selectedDifficulty: "easy" as "easy" | "medium" | "hard",
    customSeed: "",
  });

  const newGameForm = ref({
    difficulty: "easy" as "easy" | "medium" | "hard",
    seedOption: "random" as "random" | "custom" | "history",
    customSeed: "",
    selectedHistorySeed: "",
  });

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

  const updateUIOption = <K extends keyof typeof uiOptions>(
    key: K,
    value: (typeof uiOptions)[K]["value"]
  ) => {
    uiOptions[key].value = value;
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
