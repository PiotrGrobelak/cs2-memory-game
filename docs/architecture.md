# 🏗️ Project Architecture

The CS2 Memory Game uses a **modular, feature-based architecture** with Vue 3 Composition API and TypeScript.

## 🧩 Component Structure

```
components/
├── game/
│   ├── core/                    # Main game components
│   │   ├── GameInterface.vue    # [ROOT] Primary game interface
│   │   ├── GameCanvas.vue       # HTML5 Canvas rendering component
│   │   ├── CanvasContainer.vue  # Canvas wrapper container
│   │   ├── FallbackCardGrid.vue # Fallback grid for non-canvas
│   │   ├── GameEmptyState.vue   # Empty state display
│   │   └── GameLoadingState.vue # Loading state display
│   │
│   ├── ui/                      # User interface components
│   │   ├── GameControlButtons.vue # Main control buttons
│   │   ├── header/              # Header section components
│   │   ├── status/              # Game status components
│   │   └── overlays/            # Game overlay components
│   │       ├── DebugOverlay.vue # Debug information overlay
│   │       ├── ErrorOverlay.vue # Error display overlay
│   │       ├── LoadingOverlay.vue # Loading screen overlay
│   │       └── ResizeOverlay.vue # Resize detection overlay
│   │
│   └── dialogs/                 # Modal dialog components
│
├── history/                     # Game history components
│   ├── HistoryTable.vue         # Main history table
│   ├── HistoryMobileCard.vue    # Mobile-optimized history cards
│   ├── HistoryFilters.vue       # History filtering controls
│   ├── HistoryStats.vue         # Statistics display
│   ├── HistoryHeader.vue        # History page header
│   └── HistoryEmptyState.vue    # Empty history state
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
│   ├── useEngineCore.ts         # Main PixiJS Application engine
│   ├── canvas/                  # Canvas rendering components
│   │   ├── useCanvasState.ts    # Canvas state management
│   │   ├── useCardRenderer.ts   # PixiJS card rendering logic
│   │   ├── useTextureLoader.ts  # Asset texture loading
│   │   ├── useParallaxEffect.ts # Parallax visual effects
│   │   └── useResponsiveGrid.ts # Responsive grid calculations
│   ├── layout/                  # Layout calculation strategies
│   │   ├── useLayoutStrategies.ts # Layout algorithms
│   │   └── adaptiveGridLayout.ts  # Adaptive grid positioning
│   └── device/                  # Device detection utilities
│       └── useDeviceDetection.ts # Device type and orientation
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
→ Game.initializeCards() → EngineCore.initializeCanvas()
→ CardRenderer.renderCards() → [Game Playing State]
```

### Card Selection Flow

```
User clicks card → EngineCore.handleClick() → Game.selectCard()
→ CardStore.updateState() → CanvasState.updateCard()
→ CardRenderer.updateVisualState() → Game.checkForMatch()
```

## 🎯 Key Architectural Principles

- **Separation of Concerns**: UI, game logic, rendering, and data layers are independent
- **Event-Driven Architecture**: Real-time synchronization between state and visuals
- **Modular Engine**: Specialized modules for canvas, layout, device detection, and rendering
- **Performance Optimization**: Object pooling, batched updates, and efficient rendering
- **Device-Aware**: Responsive design with device-specific layout strategies
- **Type Safety**: Full TypeScript integration with strict type checking
- **Composable Design**: Reusable logic through Vue 3 Composition API
- **Error Boundaries**: Graceful error handling at component and system levels
