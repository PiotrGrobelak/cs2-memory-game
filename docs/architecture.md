# 🏗️ Project Architecture

The CS2 Memory Game uses a **modular, feature-based architecture** with Vue 3 Composition API and TypeScript.

## 🧩 Component Structure

```
components/
├── game/
│   ├── core/                    # Main game components
│   │   ├── GameInterface.vue    # [ROOT] Primary game interface
│   │   └── GameCanvas.vue       # HTML5 Canvas rendering component
│   │
│   ├── ui/                      # User interface components
│   │   ├── header/              # Header section components
│   │   └── status/              # Game status components
│   │
│   └── dialogs/                 # Modal dialog components
│
├── debug/                       # Development tools
└── error/                       # Error handling components
```

## ⚙️ Composables Architecture

**Layered architecture** with clear separation of responsibilities:

```
composables/
├── core/                        # Core game logic layer
│   ├── useGameController.ts     # [MAIN] Central orchestrator
│   ├── useGame.ts               # Core game mechanics
│   └── useGameLoader.ts         # Game initialization
│
├── engine/                      # PixiJS rendering engine layer
│   ├── useGameEngine.ts         # PixiJS Application engine
│   ├── useLayoutEngine.ts       # Layout calculations and positioning
│   └── useGameCardRenderer.ts   # PixiJS card rendering logic
│
├── data/                        # Data management layer
│   ├── useCS2Data.ts            # CS2 items API integration
│   ├── useSeedSystem.ts         # Seed generation and validation
│   └── useGamePersistence.ts    # Local storage management
│
└── sync/                        # Synchronization layer
    └── useGameSync.ts           # State-to-PixiJS synchronization
```

## 🔄 Application Flow

### Initialization Flow

```
pages/index.vue → [Loading Screen] → GameController.initializeGame()
→ CS2Data.load() → SeedSystem.init() → Game.prepare() → [Main Interface]
```

### Game Start Flow

```
User clicks "Start Game" → GameController.startNewGame()
→ SeedSystem.generateSeed() → CS2Data.getItemsForGame()
→ Game.initializeCards() → PixiJS.renderCards() → [Game Playing State]
```

### Card Selection Flow

```
User clicks card → PixiJS.handleClick() → Game.selectCard()
→ CardStore.updateState() → GameSync.queueSyncEvent()
→ PixiJS.updateVisualState() → Game.checkForMatch()
```

## 🎯 Key Architectural Principles

- **Separation of Concerns**: UI, game logic, rendering, and data layers are independent
- **Event-Driven Architecture**: Real-time synchronization between state and visuals
- **Performance Optimization**: Object pooling, batched updates, and efficient rendering
- **Type Safety**: Full TypeScript integration with strict type checking
- **Composable Design**: Reusable logic through Vue 3 Composition API
- **Error Boundaries**: Graceful error handling at component and system levels
