import { ref } from "vue";

interface LoadingStep {
  message: string;
  duration: number;
}

export const useGameLoader = () => {
  const isLoading = ref(true);
  const loadingMessage = ref("Initializing...");
  const loadingProgress = ref(0);

  const loadingSteps: LoadingStep[] = [
    { message: "Initializing game engine...", duration: 500 },
    { message: "Loading CS2 item database...", duration: 800 },
    { message: "Setting up game systems...", duration: 600 },
    { message: "Preparing game interface...", duration: 400 },
    { message: "Ready to play!", duration: 300 },
  ];

  const simulateLoading = async (): Promise<void> => {
    let progress = 0;
    const progressStep = 100 / loadingSteps.length;

    for (const step of loadingSteps) {
      loadingMessage.value = step.message;
      await new Promise((resolve) => setTimeout(resolve, step.duration));
      progress += progressStep;
      loadingProgress.value = Math.min(progress, 100);
    }
  };

  const startLoading = () => {
    isLoading.value = true;
    loadingProgress.value = 0;
    loadingMessage.value = "Initializing...";
  };

  const finishLoading = () => {
    isLoading.value = false;
    loadingProgress.value = 100;
  };

  const resetLoading = () => {
    isLoading.value = true;
    loadingProgress.value = 0;
    loadingMessage.value = "Initializing...";
  };

  return {
    // State
    isLoading,
    loadingMessage,
    loadingProgress,

    // Methods
    simulateLoading,
    startLoading,
    finishLoading,
    resetLoading,

    // Configuration
    loadingSteps,
  };
};
