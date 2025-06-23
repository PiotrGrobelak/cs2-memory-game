import { ref, computed, watch, readonly } from "vue";
import { createGlobalState, useLocalStorage } from "@vueuse/core";

export interface GameSoundsOptions {
  enableSound: boolean;
  volume: number; // 0-100
}

export const useGameSounds = createGlobalState(() => {
  const flipAudio = ref<HTMLAudioElement | null>(null);
  const matchAudio = ref<HTMLAudioElement | null>(null);

  const isLoading = ref(true);
  const loadError = ref<string | null>(null);

  const enableSound = useLocalStorage("game-sound-enabled", true);
  const volume = useLocalStorage("game-volume", 50); // 0-100

  const audioVolume = computed(() => volume.value / 100);

  const initializeAudio = async () => {
    try {
      isLoading.value = true;
      loadError.value = null;

      flipAudio.value = new Audio("/filp.mp3");
      matchAudio.value = new Audio("/match.mp3");

      const configureAudio = (audio: HTMLAudioElement) => {
        audio.preload = "auto";
        audio.volume = audioVolume.value;
        audio.load();
      };

      configureAudio(flipAudio.value);
      configureAudio(matchAudio.value);

      await Promise.all([
        new Promise((resolve, reject) => {
          if (!flipAudio.value)
            return reject(new Error("Flip audio not initialized"));
          flipAudio.value.addEventListener("canplaythrough", resolve, {
            once: true,
          });
          flipAudio.value.addEventListener("error", reject, { once: true });
        }),
        new Promise((resolve, reject) => {
          if (!matchAudio.value)
            return reject(new Error("Match audio not initialized"));
          matchAudio.value.addEventListener("canplaythrough", resolve, {
            once: true,
          });
          matchAudio.value.addEventListener("error", reject, { once: true });
        }),
      ]);

      console.log("Game sounds loaded successfully");
    } catch (error) {
      console.warn("Failed to load game sounds:", error);
      loadError.value =
        error instanceof Error ? error.message : "Unknown audio loading error";
    } finally {
      isLoading.value = false;
    }
  };

  watch(audioVolume, (newVolume) => {
    if (flipAudio.value) flipAudio.value.volume = newVolume;
    if (matchAudio.value) matchAudio.value.volume = newVolume;
  });

  const playCardFlip = async () => {
    console.log(
      "playCardFlip",
      enableSound.value,
      flipAudio.value,
      isLoading.value
    );
    if (!enableSound.value || !flipAudio.value || isLoading.value) return;

    try {
      flipAudio.value.currentTime = 0;
      await flipAudio.value.play();
    } catch (error) {
      console.warn("Failed to play flip sound:", error);
    }
  };

  const playMatch = async () => {
    if (!enableSound.value || !matchAudio.value || isLoading.value) return;

    try {
      matchAudio.value.currentTime = 0;
      await matchAudio.value.play();
    } catch (error) {
      console.warn("Failed to play match sound:", error);
    }
  };

  const updateSoundSettings = (options: Partial<GameSoundsOptions>) => {
    if (options.enableSound !== undefined) {
      enableSound.value = options.enableSound;
      console.log("updateSoundSettings", enableSound.value);
    }
    if (options.volume !== undefined) {
      volume.value = Math.max(0, Math.min(100, options.volume));
    }
  };

  const getSoundSettings = (): GameSoundsOptions => ({
    enableSound: enableSound.value,
    volume: volume.value,
  });

  const cleanup = () => {
    if (flipAudio.value) {
      flipAudio.value.pause();
      flipAudio.value.src = "";
      flipAudio.value = null;
    }
    if (matchAudio.value) {
      matchAudio.value.pause();
      matchAudio.value.src = "";
      matchAudio.value = null;
    }
  };

  return {
    // State
    isLoading: readonly(isLoading),
    loadError: readonly(loadError),
    enableSound: readonly(enableSound),
    volume: readonly(volume),

    // Methods
    initializeAudio,
    playCardFlip,
    playMatch,
    updateSoundSettings,
    getSoundSettings,
    cleanup,
  };
});
