import { ref, computed, onUnmounted } from "vue";
import { Application, Container } from "pixi.js";
import type { GamePixiApplication, GameEngineConfig } from "~/types/pixi";

export const useGameEngine = () => {
  const pixiApp = ref<GamePixiApplication | null>(null);
  const isInitialized = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Singleton pattern - one engine per application
  const initializeEngine = async (config: GameEngineConfig) => {
    if (pixiApp.value) {
      return pixiApp.value;
    }

    try {
      isLoading.value = true;
      error.value = null;

      // Initialize PIXI Application
      const app = new Application();
      await app.init({
        width: config.width,
        height: config.height,
        backgroundColor: config.backgroundColor,
        antialias: config.antialias,
        resolution: config.resolution,
        powerPreference: config.powerPreference,
      });

      // Create main containers
      const backgroundContainer = new Container();
      const cardContainer = new Container();

      app.stage.addChild(backgroundContainer);
      app.stage.addChild(cardContainer);

      pixiApp.value = {
        app,
        stage: app.stage,
        cardContainer,
        backgroundContainer,
      };

      isInitialized.value = true;
      return pixiApp.value;
    } catch (err) {
      error.value = `Failed to initialize PixiJS: ${err}`;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const destroyEngine = () => {
    if (pixiApp.value) {
      pixiApp.value.app.destroy(true, true);
      pixiApp.value = null;
      isInitialized.value = false;
    }
  };

  // Cleanup on unmount
  onUnmounted(() => {
    destroyEngine();
  });

  return {
    pixiApp: computed(() => pixiApp.value),
    isInitialized: computed(() => isInitialized.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    initializeEngine,
    destroyEngine,
  };
};
