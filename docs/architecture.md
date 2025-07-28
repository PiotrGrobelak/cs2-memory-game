# 🏗️ Project Architecture

The CS2 Memory Game uses a **modular, feature-based architecture** with Vue 3 Composition API and TypeScript.

## 🧩 Component Structure

```
components/
├── game/
│   ├── core/                    # Main game components
│   │   ├── GameInterface.vue    # [ROOT] Primary game interface (now includes canvas management)
│   │   ├── GameCanvas.vue       # HTML5 Canvas rendering component
│   │   ├── FallbackCardGrid.vue # Fallback grid for non-canvas
│   │   ├── GameEmptyState.vue   # Empty state display
│   │   └── GameLoadingState.vue # Loading state display
│   │
│   ├── ui/                      # User interface components
│   │   ├── GameControlButtons.vue # Main control buttons
│   │   ├── header/              # Header section components
│   │   ├── status/              # Game status components
│   │   └── overlays/            # Game overlay components
│   │       ├── DebugOverlay.vue # Enhanced debug information overlay
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
│   │   ├── useTextureLoader.ts  # Optimized asset texture loading
│   │   ├── useParallaxEffect.ts # Parallax visual effects
│   │   └── useResponsiveGrid.ts # Responsive grid calculations
│   ├── layout/                  # Orientation-based layout system
│   │   ├── useOrientationGrid.ts # Orientation-aware grid calculations
│   │   └── useOrientationMapper.ts # Device-to-layout mapping
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
→ OrientationGrid.calculateLayout() → CardRenderer.renderCards() → [Game Playing State]
```

### Card Selection Flow

```
User clicks card → GameCanvas.handleClick() → useGameController.handleCardClick()
→ CardStore.updateState() → CanvasState.updateCard()
→ CardRenderer.updateVisualState() → Game.checkForMatch()
```

## 🎯 Key Architectural Principles

- **Orientation-Aware Design**: Automatic layout adaptation based on screen orientation and device type
- **Separation of Concerns**: UI, game logic, rendering, and data layers are independent
- **Event-Driven Architecture**: Real-time synchronization between state and visuals
- **Modular Engine**: Specialized modules for canvas, layout, device detection, and rendering
- **Performance Optimization**: Object pooling, batched updates, and efficient rendering with device-specific optimizations
- **Device-Aware**: Responsive design with orientation-based layout strategies
- **Type Safety**: Full TypeScript integration with strict type checking
- **Composable Design**: Reusable logic through Vue 3 Composition API
- **Error Boundaries**: Graceful error handling at component and system levels

## 🎨 Orientation-Based Layout System

The new layout system provides:

- **Portrait Strategy**: Optimized for vertical layouts with more rows
- **Landscape Strategy**: Optimized for horizontal layouts with more columns
- **Square Strategy**: Balanced symmetric layouts for square screens
- **Performance Adaptation**: Dynamic constraint adjustment based on device capabilities
- **Validation System**: Layout quality assessment with warnings and recommendations

## 🚀 Deployment & Infrastructure

### Live Environment

- **Production URL**: [https://cs2-memory-game.pages.dev/](https://cs2-memory-game.pages.dev/)
- **Hosting**: Cloudflare Pages
- **Build Preset**: `cloudflare_pages` (Nuxt 3)

### CI/CD Pipeline

The deployment architecture uses **GitHub Actions** with modular composite actions:

```
.github/
├── workflows/
│   └── master.yml              # Main deployment workflow
└── actions/
    ├── install-dependencies/   # Node.js setup & npm install
    ├── lint-and-format/       # ESLint & Prettier checks
    └── unit-test/             # Vitest test execution
```

### Deployment Flow

1. **Quality Gates**

   - Code linting (ESLint)
   - Format checking (Prettier)
   - Unit test execution (Vitest)

2. **Build Process**

   - Nuxt 3 static generation
   - Cloudflare Pages optimization
   - Asset bundling and optimization

3. **Deployment**
   - Automatic deployment from `master` branch
   - Cloudflare global CDN distribution
   - Environment URL generation

### Infrastructure Features

- **Global CDN**: Cloudflare's edge network for low latency
- **Zero-Config Deployment**: Automatic builds on push to master
- **Environment Management**: Production environment with URL tracking
- **Node.js Version**: Fixed to v22 (via `.nvmrc`)
- **Concurrent Builds**: Cancellation of in-progress builds on new commits
