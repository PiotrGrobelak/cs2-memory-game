# CS2 Memory Game - Implementacja Planszy Gry Krok po Kroku

## Przegląd Architektury

Plansza gry będzie zaimplementowana jako hybrydowy system łączący:

- **PixiJS** dla renderingu planszy z kartami (główny engine)
- **Vue 3 komponenty** dla interfejsu użytkownika
- **Fallback HTML/CSS Grid** dla przypadków, gdy Canvas nie jest dostępny
- **Controlled Components Pattern** dla maksymalnej kontroli nad stanem

## Krok 1: Przygotowanie Typów i Interfejsów

### 1.1 Rozszerzenie typów PixiJS

**Plik:** `types/pixi.ts`

```typescript
// Typy dla PixiJS integration
export interface GamePixiApplication {
  app: PIXI.Application;
  stage: PIXI.Container;
  cardContainer: PIXI.Container;
  backgroundContainer: PIXI.Container;
}

export interface CardSprite extends PIXI.Sprite {
  cardId: string;
  cardData: GameCard;
  isFlipping: boolean;
  flipProgress: number;
  parallaxOffset: { x: number; y: number };
}

export interface GameEngineConfig {
  width: number;
  height: number;
  backgroundColor: number;
  antialias: boolean;
  resolution: number;
  powerPreference: "high-performance" | "low-power" | "default";
}
```

### 1.2 Rozszerzenie typów gry

**Plik:** `types/game.ts` (rozszerzenie istniejącego)

```typescript
// Dodanie nowych typów dla Canvas rendering
export interface CanvasRenderingOptions {
  enableParallax: boolean;
  enableAnimations: boolean;
  enableShadows: boolean;
  qualityLevel: "low" | "medium" | "high";
}

export interface CardRenderingData {
  position: { x: number; y: number };
  scale: number;
  rotation: number;
  opacity: number;
  zIndex: number;
}
```

## Krok 2: Implementacja Engine Composables

### 2.1 Główny Game Engine

**Plik:** `composables/engine/useGameEngine.ts`

```typescript
import { ref, computed, onUnmounted } from "vue";
import * as PIXI from "pixi.js";
import type { GamePixiApplication, GameEngineConfig } from "~/types/pixi";
import type { GameCard } from "~/types/game";

export const useGameEngine = () => {
  const pixiApp = ref<GamePixiApplication | null>(null);
  const isInitialized = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Singleton pattern - jeden engine na aplikację
  const initializeEngine = async (config: GameEngineConfig) => {
    if (pixiApp.value) {
      return pixiApp.value;
    }

    try {
      isLoading.value = true;
      error.value = null;

      // Inicjalizacja PIXI Application
      const app = new PIXI.Application();
      await app.init({
        width: config.width,
        height: config.height,
        backgroundColor: config.backgroundColor,
        antialias: config.antialias,
        resolution: config.resolution,
        powerPreference: config.powerPreference,
      });

      // Tworzenie głównych kontenerów
      const backgroundContainer = new PIXI.Container();
      const cardContainer = new PIXI.Container();

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

  // Cleanup przy unmount
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
```

### 2.2 Card Renderer

**Plik:** `composables/engine/useCardRenderer.ts`

```typescript
import { ref, computed } from "vue";
import * as PIXI from "pixi.js";
import type { CardSprite } from "~/types/pixi";
import type { GameCard } from "~/types/game";

export const useCardRenderer = () => {
  const cardSprites = ref<Map<string, CardSprite>>(new Map());
  const textureCache = ref<Map<string, PIXI.Texture>>(new Map());

  // Rarity gradient colors
  const rarityGradients = {
    consumer: [0x808080, 0x606060],
    industrial: [0x5dade2, 0x3498db],
    milSpec: [0x8e44ad, 0x663399],
    restricted: [0xe74c3c, 0xc0392b],
    classified: [0xf39c12, 0xe67e22],
    covert: [0xe91e63, 0xad1457],
    contraband: [0xffd700, 0xffa500],
  };

  const createCardSprite = async (
    card: GameCard,
    position: { x: number; y: number }
  ) => {
    const cardWidth = 120;
    const cardHeight = 160;

    // Tworzenie sprite dla karty
    const cardSprite = new PIXI.Sprite() as CardSprite;
    cardSprite.cardId = card.id;
    cardSprite.cardData = card;
    cardSprite.isFlipping = false;
    cardSprite.flipProgress = 0;
    cardSprite.parallaxOffset = { x: 0, y: 0 };

    // Pozycjonowanie
    cardSprite.x = position.x;
    cardSprite.y = position.y;
    cardSprite.width = cardWidth;
    cardSprite.height = cardHeight;
    cardSprite.anchor.set(0.5);

    // Tworzenie tła z gradientem
    const graphics = new PIXI.Graphics();
    const rarity = card.cs2Item?.rarity || "consumer";
    const colors =
      rarityGradients[rarity as keyof typeof rarityGradients] ||
      rarityGradients.consumer;

    graphics.beginFill(colors[0]);
    graphics.drawRoundedRect(
      -cardWidth / 2,
      -cardHeight / 2,
      cardWidth,
      cardHeight,
      10
    );
    graphics.endFill();

    cardSprite.addChild(graphics);

    // Dodanie do cache
    cardSprites.value.set(card.id, cardSprite);

    return cardSprite;
  };

  const updateCardState = (cardId: string, state: GameCard["state"]) => {
    const sprite = cardSprites.value.get(cardId);
    if (!sprite) return;

    // Animacja flip w zależności od stanu
    switch (state) {
      case "revealed":
        animateFlip(sprite, true);
        break;
      case "hidden":
        animateFlip(sprite, false);
        break;
      case "matched":
        animateMatch(sprite);
        break;
    }
  };

  const animateFlip = (sprite: CardSprite, reveal: boolean) => {
    sprite.isFlipping = true;

    // Prosta animacja flip przez skalowanie X
    const startScale = reveal ? 1 : 0;
    const endScale = reveal ? 0 : 1;

    const animate = (progress: number) => {
      sprite.scale.x = startScale + (endScale - startScale) * progress;
      sprite.flipProgress = progress;

      if (progress < 1) {
        requestAnimationFrame(() => animate(progress + 0.1));
      } else {
        sprite.isFlipping = false;
      }
    };

    animate(0);
  };

  const animateMatch = (sprite: CardSprite) => {
    // Animacja sukcesu - pulsowanie
    const originalScale = sprite.scale.y;
    sprite.scale.set(originalScale * 1.2);

    setTimeout(() => {
      sprite.scale.set(originalScale);
      sprite.alpha = 0.7; // Przyciemnij matched karty
    }, 200);
  };

  const applyParallaxEffect = (
    cardId: string,
    mouseX: number,
    mouseY: number,
    canvasWidth: number,
    canvasHeight: number
  ) => {
    const sprite = cardSprites.value.get(cardId);
    if (!sprite) return;

    // Obliczenie offset dla parallax
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const offsetX = (mouseX - centerX) * 0.02;
    const offsetY = (mouseY - centerY) * 0.02;

    sprite.parallaxOffset = { x: offsetX, y: offsetY };
    sprite.x += offsetX;
    sprite.y += offsetY;
  };

  return {
    cardSprites: computed(() => cardSprites.value),
    createCardSprite,
    updateCardState,
    applyParallaxEffect,
  };
};
```

### 2.3 Layout Engine

**Plik:** `composables/engine/useLayoutEngine.ts`

```typescript
import { computed } from "vue";
import type { GameCard } from "~/types/game";

export const useLayoutEngine = () => {
  const calculateCardPositions = (
    cards: GameCard[],
    canvasWidth: number,
    canvasHeight: number,
    difficulty: "easy" | "medium" | "hard"
  ) => {
    const gridConfigs = {
      easy: { rows: 3, cols: 4 },
      medium: { rows: 4, cols: 6 },
      hard: { rows: 6, cols: 8 },
    };

    const grid = gridConfigs[difficulty];
    const cardWidth = 120;
    const cardHeight = 160;
    const padding = 20;

    // Obliczenie dostępnej przestrzeni
    const totalWidth = grid.cols * cardWidth + (grid.cols - 1) * padding;
    const totalHeight = grid.rows * cardHeight + (grid.rows - 1) * padding;

    // Centrowanie na canvas
    const startX = (canvasWidth - totalWidth) / 2 + cardWidth / 2;
    const startY = (canvasHeight - totalHeight) / 2 + cardHeight / 2;

    const positions: Array<{ x: number; y: number; cardId: string }> = [];

    cards.forEach((card, index) => {
      const row = Math.floor(index / grid.cols);
      const col = index % grid.cols;

      const x = startX + col * (cardWidth + padding);
      const y = startY + row * (cardHeight + padding);

      positions.push({ x, y, cardId: card.id });
    });

    return positions;
  };

  const getResponsiveCardSize = (
    canvasWidth: number,
    canvasHeight: number,
    cardCount: number
  ) => {
    // Automatyczne skalowanie kart w zależności od rozmiaru canvas
    const baseWidth = 120;
    const baseHeight = 160;

    const scaleX = canvasWidth / 1000; // Bazowy canvas 1000px
    const scaleY = canvasHeight / 700; // Bazowy canvas 700px
    const scale = Math.min(scaleX, scaleY, 1); // Nie powiększaj ponad 100%

    return {
      width: baseWidth * scale,
      height: baseHeight * scale,
      scale,
    };
  };

  return {
    calculateCardPositions,
    getResponsiveCardSize,
  };
};
```

### 2.4 Interaction Handler

**Plik:** `composables/engine/useGameInteractions.ts`

```typescript
import { ref } from "vue";
import * as PIXI from "pixi.js";
import type { CardSprite } from "~/types/pixi";

export const useGameInteractions = () => {
  const isInteractive = ref(true);
  const hoveredCard = ref<string | null>(null);

  const setupCardInteraction = (
    sprite: CardSprite,
    onCardClick: (cardId: string) => void
  ) => {
    sprite.interactive = true;
    sprite.buttonMode = true;

    // Click/Tap handler
    sprite.on("pointerdown", () => {
      if (!isInteractive.value) return;
      onCardClick(sprite.cardId);
    });

    // Hover effects
    sprite.on("pointerover", () => {
      if (!isInteractive.value) return;
      hoveredCard.value = sprite.cardId;
      sprite.scale.set(sprite.scale.x * 1.05, sprite.scale.y * 1.05);
    });

    sprite.on("pointerout", () => {
      hoveredCard.value = null;
      sprite.scale.set(sprite.scale.x / 1.05, sprite.scale.y / 1.05);
    });
  };

  const setInteractive = (interactive: boolean) => {
    isInteractive.value = interactive;
  };

  const handleMouseMove = (
    event: MouseEvent,
    canvas: HTMLCanvasElement,
    onParallaxUpdate: (x: number, y: number) => void
  ) => {
    if (!isInteractive.value) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    onParallaxUpdate(x, y);
  };

  const handleTouchMove = (
    event: TouchEvent,
    canvas: HTMLCanvasElement,
    onParallaxUpdate: (x: number, y: number) => void
  ) => {
    if (!isInteractive.value || event.touches.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const touch = event.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    onParallaxUpdate(x, y);
  };

  return {
    isInteractive,
    hoveredCard,
    setupCardInteraction,
    setInteractive,
    handleMouseMove,
    handleTouchMove,
  };
};
```

## Krok 3: Implementacja GameCanvas Component

### 3.1 Główny GameCanvas Component

**Plik:** `components/game/core/GameCanvas.vue`

```vue
<template>
  <div
    ref="canvasContainer"
    class="game-canvas-container relative w-full h-full"
    :class="{ loading: isLoading }"
  >
    <!-- Loading Overlay -->
    <div
      v-if="isLoading"
      class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10"
    >
      <div class="text-white text-center">
        <i class="pi pi-spin pi-spinner text-4xl mb-4"></i>
        <p>Loading game board...</p>
      </div>
    </div>

    <!-- Error Overlay -->
    <div
      v-if="error"
      class="absolute inset-0 bg-red-500 bg-opacity-20 flex items-center justify-center z-10"
    >
      <div class="text-red-800 text-center bg-white p-4 rounded-lg">
        <i class="pi pi-exclamation-triangle text-2xl mb-2"></i>
        <p>{{ error }}</p>
        <button
          @click="retryInitialization"
          class="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Retry
        </button>
      </div>
    </div>

    <!-- Canvas będzie tutaj wstawiony przez PixiJS -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import type { GameCard } from "~/types/game";
import { useGameEngine } from "~/composables/engine/useGameEngine";
import { useCardRenderer } from "~/composables/engine/useCardRenderer";
import { useLayoutEngine } from "~/composables/engine/useLayoutEngine";
import { useGameInteractions } from "~/composables/engine/useGameInteractions";

// Props
interface Props {
  cards: GameCard[];
  canvasWidth: number;
  canvasHeight: number;
  gameStatus: "ready" | "playing" | "paused" | "completed";
  isInteractive: boolean;
  selectedCards: GameCard[];
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  cardClicked: [cardId: string];
  canvasReady: [];
  canvasError: [error: string];
  loadingStateChanged: [isLoading: boolean];
}>();

// Refs
const canvasContainer = ref<HTMLDivElement>();
const isLoading = ref(false);
const error = ref<string | null>(null);

// Composables
const gameEngine = useGameEngine();
const cardRenderer = useCardRenderer();
const layoutEngine = useLayoutEngine();
const gameInteractions = useGameInteractions();

// Initialization
const initializeCanvas = async () => {
  if (!canvasContainer.value) return;

  try {
    isLoading.value = true;
    emit("loadingStateChanged", true);
    error.value = null;

    // Initialize PixiJS engine
    const pixiApp = await gameEngine.initializeEngine({
      width: props.canvasWidth,
      height: props.canvasHeight,
      backgroundColor: 0x1a1a1a,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      powerPreference: "high-performance",
    });

    // Append canvas to container
    canvasContainer.value.appendChild(pixiApp.app.canvas);

    // Setup cards
    await setupCards();

    // Setup interactions
    setupInteractions();

    emit("canvasReady");
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    error.value = errorMessage;
    emit("canvasError", errorMessage);
  } finally {
    isLoading.value = false;
    emit("loadingStateChanged", false);
  }
};

const setupCards = async () => {
  if (!gameEngine.pixiApp.value) return;

  // Calculate card positions
  const difficulty =
    props.cards.length <= 12
      ? "easy"
      : props.cards.length <= 24
        ? "medium"
        : "hard";

  const positions = layoutEngine.calculateCardPositions(
    props.cards,
    props.canvasWidth,
    props.canvasHeight,
    difficulty
  );

  // Create card sprites
  for (let i = 0; i < props.cards.length; i++) {
    const card = props.cards[i];
    const position = positions[i];

    const sprite = await cardRenderer.createCardSprite(card, position);
    gameEngine.pixiApp.value.cardContainer.addChild(sprite);

    // Setup interaction for this card
    gameInteractions.setupCardInteraction(sprite, handleCardClick);
  }
};

const setupInteractions = () => {
  if (!gameEngine.pixiApp.value) return;

  const canvas = gameEngine.pixiApp.value.app.canvas;

  // Mouse interactions
  canvas.addEventListener("mousemove", (event) => {
    gameInteractions.handleMouseMove(event, canvas, handleParallaxUpdate);
  });

  // Touch interactions
  canvas.addEventListener("touchmove", (event) => {
    gameInteractions.handleTouchMove(event, canvas, handleParallaxUpdate);
  });
};

const handleCardClick = (cardId: string) => {
  emit("cardClicked", cardId);
};

const handleParallaxUpdate = (x: number, y: number) => {
  // Apply parallax effect to all cards
  props.cards.forEach((card) => {
    cardRenderer.applyParallaxEffect(
      card.id,
      x,
      y,
      props.canvasWidth,
      props.canvasHeight
    );
  });
};

const retryInitialization = () => {
  error.value = null;
  nextTick(() => {
    initializeCanvas();
  });
};

// Watchers
watch(
  () => props.cards,
  (newCards) => {
    // Update card states when cards change
    newCards.forEach((card) => {
      cardRenderer.updateCardState(card.id, card.state);
    });
  },
  { deep: true }
);

watch(
  () => props.isInteractive,
  (interactive) => {
    gameInteractions.setInteractive(interactive);
  }
);

watch([() => props.canvasWidth, () => props.canvasHeight], () => {
  // Resize canvas when dimensions change
  if (gameEngine.pixiApp.value) {
    gameEngine.pixiApp.value.app.renderer.resize(
      props.canvasWidth,
      props.canvasHeight
    );
    setupCards(); // Recalculate card positions
  }
});

// Lifecycle
onMounted(() => {
  nextTick(() => {
    initializeCanvas();
  });
});

onUnmounted(() => {
  gameEngine.destroyEngine();
});
</script>

<style scoped>
.game-canvas-container {
  min-height: 400px;
}

.game-canvas-container.loading {
  pointer-events: none;
}

.game-canvas-container canvas {
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
</style>
```

## Krok 4: Integracja z istniejącym GameInterface

### 4.1 Aktualizacja GameInterface.vue

**Modyfikacje w:** `components/game/core/GameInterface.vue`

```vue
<!-- W sekcji script setup, dodaj import dla GameCanvas -->
<script setup lang="ts">
// ... existing imports ...
import GameCanvas from "./GameCanvas.vue";

// ... existing code ...

// Dodaj handler dla lepszego error handling
const handleCanvasError = (error: string) => {
  console.error("Canvas error:", error);
  showFallbackUI.value = true;

  // Pokaż toast z informacją o przełączeniu na fallback
  toast.add({
    severity: "warn",
    summary: "Canvas Unavailable",
    detail:
      "Switched to fallback grid interface. Game functionality is preserved.",
    life: 5000,
  });
};

// Ulepsz retry mechanism
const retryCanvas = async () => {
  showFallbackUI.value = false;
  error.value = null;

  await nextTick();

  toast.add({
    severity: "info",
    summary: "Retrying Canvas",
    detail: "Attempting to initialize advanced rendering...",
    life: 3000,
  });
};
</script>
```

## Krok 5: Optymalizacja Performance

### 5.1 Object Pooling dla Sprites

**Plik:** `composables/engine/useObjectPool.ts`

```typescript
import { ref } from "vue";
import * as PIXI from "pixi.js";

export const useObjectPool = <T extends PIXI.DisplayObject>() => {
  const pool = ref<T[]>([]);
  const activeObjects = ref<Set<T>>(new Set());

  const acquire = (factory: () => T): T => {
    let obj = pool.value.pop();

    if (!obj) {
      obj = factory();
    }

    activeObjects.value.add(obj);
    return obj;
  };

  const release = (obj: T) => {
    if (activeObjects.value.has(obj)) {
      activeObjects.value.delete(obj);

      // Reset object state
      obj.visible = true;
      obj.alpha = 1;
      obj.scale.set(1);
      obj.rotation = 0;

      pool.value.push(obj);
    }
  };

  const clear = () => {
    activeObjects.value.forEach((obj) => {
      obj.destroy();
    });

    pool.value.forEach((obj) => {
      obj.destroy();
    });

    pool.value = [];
    activeObjects.value.clear();
  };

  return {
    acquire,
    release,
    clear,
    poolSize: computed(() => pool.value.length),
    activeCount: computed(() => activeObjects.value.size),
  };
};
```

### 5.2 Performance Monitor

**Plik:** `composables/engine/usePerformanceMonitor.ts`

```typescript
import { ref, computed } from "vue";

export const usePerformanceMonitor = () => {
  const fps = ref(0);
  const frameTime = ref(0);
  const memoryUsage = ref(0);

  let lastTime = performance.now();
  let frameCount = 0;
  let fpsUpdateTime = 0;

  const startMonitoring = () => {
    const updateStats = (currentTime: number) => {
      frameCount++;
      const deltaTime = currentTime - lastTime;
      frameTime.value = deltaTime;

      // Update FPS every second
      if (currentTime - fpsUpdateTime >= 1000) {
        fps.value = Math.round(
          (frameCount * 1000) / (currentTime - fpsUpdateTime)
        );
        frameCount = 0;
        fpsUpdateTime = currentTime;

        // Memory usage (if available)
        if ("memory" in performance) {
          memoryUsage.value =
            (performance as any).memory.usedJSHeapSize / 1024 / 1024;
        }
      }

      lastTime = currentTime;
      requestAnimationFrame(updateStats);
    };

    requestAnimationFrame(updateStats);
  };

  const performanceMetrics = computed(() => ({
    fps: fps.value,
    frameTime: frameTime.value,
    memoryUsage: memoryUsage.value,
    isPerformanceGood: fps.value >= 30 && frameTime.value <= 33,
  }));

  return {
    startMonitoring,
    performanceMetrics,
    fps: computed(() => fps.value),
    frameTime: computed(() => frameTime.value),
    memoryUsage: computed(() => memoryUsage.value),
  };
};
```

## Krok 6: Testowanie i Debugging

### 6.1 Debug Panel Component

**Plik:** `components/debug/GameDebugPanel.vue`

```vue
<template>
  <div
    v-if="showDebug"
    class="fixed top-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg text-sm z-50"
  >
    <h3 class="font-bold mb-2">Debug Info</h3>

    <div class="space-y-1">
      <div>FPS: {{ performance.fps }}</div>
      <div>Frame Time: {{ performance.frameTime.toFixed(2) }}ms</div>
      <div>Memory: {{ performance.memoryUsage.toFixed(2) }}MB</div>
      <div>Canvas Size: {{ canvasWidth }}×{{ canvasHeight }}</div>
      <div>Cards: {{ cardCount }}</div>
      <div>Engine Status: {{ engineStatus }}</div>
    </div>

    <button
      @click="toggleDebug"
      class="mt-2 px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
    >
      Hide Debug
    </button>
  </div>

  <button
    v-else
    @click="toggleDebug"
    class="fixed top-4 right-4 bg-gray-600 hover:bg-gray-700 text-white p-2 rounded z-50"
  >
    <i class="pi pi-cog"></i>
  </button>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { usePerformanceMonitor } from "~/composables/engine/usePerformanceMonitor";

interface Props {
  canvasWidth: number;
  canvasHeight: number;
  cardCount: number;
  engineStatus: string;
}

const props = defineProps<Props>();

const showDebug = ref(false);
const performanceMonitor = usePerformanceMonitor();

const performance = computed(() => performanceMonitor.performanceMetrics.value);

const toggleDebug = () => {
  showDebug.value = !showDebug.value;
};

onMounted(() => {
  performanceMonitor.startMonitoring();
});
</script>
```

## Krok 7: Implementacja Fallback UI

### 7.1 Rozszerzenie Fallback w GameInterface

**Modyfikacja w:** `components/game/core/GameInterface.vue`

```vue
<!-- Ulepszone fallback UI -->
<div v-else class="w-full max-w-4xl">
  <!-- Enhanced Error Message -->
  <div class="text-center mb-6">
    <div class="bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900 dark:to-orange-900 border border-yellow-300 dark:border-yellow-700 rounded-lg p-6 mb-4">
      <i class="pi pi-exclamation-triangle text-yellow-600 dark:text-yellow-400 text-3xl mb-3"></i>
      <h3 class="text-xl font-bold text-yellow-800 dark:text-yellow-200 mb-2">
        Advanced Rendering Unavailable
      </h3>
      <p class="text-yellow-700 dark:text-yellow-300 mb-3">
        Your browser doesn't support WebGL or Canvas rendering failed.
        Using optimized grid interface with full game functionality.
      </p>
      <div class="flex justify-center gap-2">
        <Button
          label="Retry Advanced Mode"
          icon="pi pi-refresh"
          severity="warning"
          size="small"
          @click="retryCanvas"
        />
        <Button
          label="Continue with Grid"
          icon="pi pi-check"
          severity="success"
          size="small"
          outlined
          @click="acceptFallback"
        />
      </div>
    </div>
  </div>

  <!-- Enhanced Fallback Card Grid -->
  <div
    class="grid gap-3 md:gap-4 mx-auto p-4 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-xl shadow-inner"
    :class="fallbackGridClasses"
    :style="{ maxWidth: canvasDimensions.width + 'px' }"
  >
    <div
      v-for="card in gameController.game.cards.value"
      :key="card.id"
      class="fallback-card aspect-[3/4] rounded-xl border-2 transition-all duration-300 cursor-pointer select-none transform hover:scale-105 hover:shadow-lg"
      :class="getFallbackCardClasses(card)"
      @click="handleCardClick(card.id)"
    >
      <!-- Enhanced Card Back -->
      <div
        v-if="card.state === 'hidden'"
        class="w-full h-full bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 rounded-xl flex items-center justify-center relative overflow-hidden"
      >
        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20 transform -skew-x-12 translate-x-full animate-pulse"></div>
        <i class="pi pi-question text-white text-3xl md:text-4xl drop-shadow-lg"></i>
      </div>

      <!-- Enhanced Card Front -->
      <div
        v-else
        class="w-full h-full rounded-xl flex flex-col items-center justify-center p-3 relative overflow-hidden"
        :class="getFallbackCardFrontClasses(card)"
      >
        <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
        <div class="relative z-10 text-center">
          <div class="text-sm md:text-base font-bold text-white drop-shadow-md mb-1">
            {{ card.cs2Item?.name || "Unknown Item" }}
          </div>
          <div class="text-xs md:text-sm text-white/90 capitalize">
            {{ card.cs2Item?.rarity || "Common" }}
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Fallback Status -->
  <div class="text-center mt-6 text-sm text-gray-600 dark:text-gray-400">
    <i class="pi pi-info-circle mr-1"></i>
    Grid mode active - All game features available
  </div>
</div>
```

## Krok 8: Konfiguracja i Deployment

### 8.1 Aktualizacja Nuxt Config

**Plik:** `nuxt.config.ts`

```typescript
export default defineNuxtConfig({
  // ... existing config ...

  // Dodaj PixiJS do build
  build: {
    transpile: ["pixi.js"],
  },

  // Optymalizacja dla Canvas
  nitro: {
    experimental: {
      wasm: true,
    },
  },

  // Dodaj meta tagi dla lepszej wydajności
  app: {
    head: {
      meta: [
        {
          name: "viewport",
          content:
            "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
        },
        { name: "theme-color", content: "#1a1a1a" },
      ],
    },
  },
});
```

### 8.2 Package.json Dependencies

**Dodaj do:** `package.json`

```json
{
  "dependencies": {
    "pixi.js": "^8.0.0"
  },
  "devDependencies": {
    "@types/pixi.js": "^8.0.0"
  }
}
```

## Krok 9: Testy

### 9.1 Test Canvas Component

**Plik:** `test/components/GameCanvas.test.ts`

```typescript
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import GameCanvas from "~/components/game/core/GameCanvas.vue";

// Mock PixiJS
vi.mock("pixi.js", () => ({
  Application: vi.fn(() => ({
    init: vi.fn(),
    stage: { addChild: vi.fn() },
    canvas: document.createElement("canvas"),
    destroy: vi.fn(),
  })),
  Container: vi.fn(() => ({ addChild: vi.fn() })),
  Sprite: vi.fn(() => ({
    on: vi.fn(),
    addChild: vi.fn(),
    anchor: { set: vi.fn() },
  })),
  Graphics: vi.fn(() => ({
    beginFill: vi.fn(),
    drawRoundedRect: vi.fn(),
    endFill: vi.fn(),
  })),
}));

describe("GameCanvas", () => {
  const mockProps = {
    cards: [],
    canvasWidth: 800,
    canvasHeight: 600,
    gameStatus: "ready" as const,
    isInteractive: true,
    selectedCards: [],
  };

  it("renders canvas container", () => {
    const wrapper = mount(GameCanvas, { props: mockProps });
    expect(wrapper.find(".game-canvas-container").exists()).toBe(true);
  });

  it("emits canvas-ready event on successful initialization", async () => {
    const wrapper = mount(GameCanvas, { props: mockProps });

    // Wait for initialization
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("canvas-ready")).toBeTruthy();
  });

  it("shows loading state during initialization", () => {
    const wrapper = mount(GameCanvas, { props: mockProps });

    // Should show loading initially
    expect(wrapper.find(".loading").exists()).toBe(true);
  });
});
```

## Krok 10: Dokumentacja

### 10.1 README dla Canvas System

**Plik:** `docs/canvas-system.md`

```markdown
# Canvas System Documentation

## Architecture Overview

The CS2 Memory Game uses a hybrid rendering approach:

1. **Primary**: PixiJS-based Canvas rendering for advanced effects
2. **Fallback**: CSS Grid-based rendering for compatibility

## Key Components

### GameCanvas.vue

Main canvas component that orchestrates the entire rendering pipeline.

### Engine Composables

- `useGameEngine`: Manages PixiJS application lifecycle
- `useCardRenderer`: Handles card sprite creation and animations
- `useLayoutEngine`: Calculates responsive card positioning
- `useGameInteractions`: Manages user input and interactions

## Performance Considerations

- Object pooling for sprites
- Batch rendering for updates
- Automatic quality scaling based on performance
- Memory management and cleanup

## Browser Support

- Modern browsers with WebGL support (primary)
- All browsers with Canvas 2D support (fallback)
- Mobile devices with touch support
```

## Harmonogram Implementacji

### Tydzień 1: Fundament

- [ ] Krok 1: Typy i interfejsy
- [ ] Krok 2.1: useGameEngine
- [ ] Krok 2.2: useCardRenderer (podstawy)

### Tydzień 2: Rendering

- [ ] Krok 2.3: useLayoutEngine
- [ ] Krok 2.4: useGameInteractions
- [ ] Krok 3.1: GameCanvas component (podstawy)

### Tydzień 3: Integracja

- [ ] Krok 4.1: Integracja z GameInterface
- [ ] Krok 7.1: Rozszerzenie Fallback UI
- [ ] Podstawowe testy

### Tydzień 4: Optymalizacja

- [ ] Krok 5: Performance optimization
- [ ] Krok 6: Debug tools
- [ ] Krok 9: Kompleksowe testy

### Tydzień 5: Finalizacja

- [ ] Krok 8: Konfiguracja i deployment
- [ ] Krok 10: Dokumentacja
- [ ] Bug fixing i polish

## Kryteria Akceptacji

✅ **Funkcjonalność**

- Wszystkie karty renderują się poprawnie
- Animacje flip działają płynnie (60 FPS)
- Parallax effects reagują na input
- Responsive design na wszystkich urządzeniach

✅ **Performance**

- Inicjalizacja < 3 sekundy
- Stały 60 FPS podczas animacji
- Zużycie pamięci < 100MB
- Fallback UI działa na 100% urządzeń

✅ **Kompatybilność**

- Wsparcie dla 98%+ nowoczesnych przeglądarek
- Graceful fallback dla starszych przeglądarek
- Pełna funkcjonalność na mobile

✅ **Jakość Kodu**

- 80%+ test coverage
- Brak błędów ESLint/TypeScript
- Dokumentacja wszystkich publicznych API
- Performance monitoring w production
  </rewritten_file>
