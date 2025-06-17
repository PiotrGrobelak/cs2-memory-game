# CS2 Memory Game

A browser-based memory card matching game featuring Counter-Strike 2 weapons and items, built with modern web technologies for an engaging and challenging gaming experience.

## Table of Contents

- [CS2 Memory Game](#cs2-memory-game)
  - [Table of Contents](#table-of-contents)
  - [Project Description](#project-description)
    - [Key Features](#key-features)
  - [Tech Stack](#tech-stack)
    - [Frontend](#frontend)
    - [Development \& Testing](#development--testing)
    - [Data \& Storage](#data--storage)
  - [Getting Started Locally](#getting-started-locally)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
  - [Available Scripts](#available-scripts)
  - [Project Scope](#project-scope)
    - [In Scope ✅](#in-scope-)
    - [Future Considerations 🔮](#future-considerations-)
  - [Project Status](#project-status)
    - [Current Focus Areas:](#current-focus-areas)
    - [Success Metrics:](#success-metrics)
  - [License](#license)

## Project Description

CS2 Memory Game is an engaging, browser-based memory card matching game that combines classic memory gameplay with iconic Counter-Strike 2 content. Players test their memory skills by matching pairs of CS2 weapons and items while enjoying advanced visual effects and smooth animations.

### Key Features

- **Canvas-based Rendering**: High-performance game board with smooth animations
- **Multiple Difficulty Levels**: Choose from 12, 24, or 48 cards to match your skill level
- **Seed-based Randomization**: Generate reproducible game layouts with shareable seeds
- **QR Code Sharing**: Share game configurations via QR codes
- **Interactive Effects**: Parallax effects responsive to mouse movement and device tilt
- **Rarity-based Design**: Card backgrounds reflect CS2 item rarity (Consumer Grade through Contraband)
- **Audio Feedback**: Sound effects for card flips and successful matches
- **Game Persistence**: Resume interrupted games after browser refresh
- **Comprehensive Statistics**: Track moves, time, and game history
- **Responsive Design**: Optimized for both desktop and mobile devices
- **Offline Support**: Play with cached CS2 data when offline

## Tech Stack

### Frontend

- **Framework**: Nuxt 3 with Vue 3
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **UI Components**: PrimeVue 4
- **State Management**: Pinia
- **Rendering**: HTML5 Canvas

### Development & Testing

- **Testing Framework**: Vitest (unit/integration), Playwright (E2E)
- **Code Quality**: ESLint, Prettier
- **Build Tool**: Nuxt 3 build system

### Data & Storage

- **API Integration**: CS2 items API for weapon/item data
- **Storage**: localStorage for game persistence
- **Audio**: Web Audio API with OGG Vorbis + AAC fallback

## Getting Started Locally

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn package manager

### Installation

1. Clone the repository:

```bash
git clone https://github.com/your-username/cs2-memory-game.git
cd cs2-memory-game
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:3000`

## Available Scripts

| Script                    | Description                          |
| ------------------------- | ------------------------------------ |
| `npm run dev`             | Start development server             |
| `npm run build`           | Build for production                 |
| `npm run generate`        | Generate static site                 |
| `npm run preview`         | Preview production build             |
| `npm run test`            | Run unit tests with Vitest           |
| `npm run test:ui`         | Run tests with UI interface          |
| `npm run test:run`        | Run tests once                       |
| `npm run test:coverage`   | Run tests with coverage report       |
| `npm run test:e2e`        | Run end-to-end tests with Playwright |
| `npm run test:e2e:ui`     | Run E2E tests with UI                |
| `npm run test:e2e:headed` | Run E2E tests in headed mode         |
| `npm run lint`            | Run TypeScript type checking         |
| `npm run lint:eslint`     | Run ESLint                           |
| `npm run lint:prettier`   | Check Prettier formatting            |
| `npm run lint:all`        | Run all linting checks               |
| `npm run lint:fix`        | Fix linting and formatting issues    |

## Project Scope

### In Scope ✅

- **Core Gameplay**: Single-player memory card matching with CS2 themes
- **Advanced Rendering**: Canvas-based game board with hardware-accelerated animations
- **Multiple Difficulty Levels**: 12, 24, and 48 card configurations
- **Seed System**: Reproducible game layouts with sharing capabilities
- **Visual Effects**: Parallax effects, rarity-based gradients, smooth animations
- **Audio Integration**: Sound effects for game interactions
- **Data Persistence**: Game state and history preservation
- **Responsive Design**: Full desktop and mobile compatibility
- **Performance Optimization**: Object pooling, batch rendering, asset preloading

### Future Considerations 🔮

- Accessibility enhancements (screen readers, keyboard navigation)
- Additional game modes (time attack, limited moves)
- Achievement system
- Advanced statistics and analytics

## Project Status

🚧 **In Development**

This project is currently under active development. The core game mechanics, visual systems, and data persistence features are being implemented according to the Product Requirements Document.

### Current Focus Areas:

- Canvas rendering system implementation
- CS2 API integration and data caching
- Game state management and persistence
- Responsive design and mobile optimization
- Audio system integration

### Success Metrics:

- ⚡ 60 FPS rendering performance during animations
- 🚀 Under 3 seconds initial load time on 3G connection
- 📱 Functional on screens 320px width and above
- 🔄 100% game state recovery after browser refresh
- 🎯 95%+ QR code sharing success rate

## License

License information will be added upon project completion.

---

**Target Audience**: Counter-Strike 2 players, gaming enthusiasts, and memory game players seeking challenging gameplay.

**Platform**: Web browsers (desktop and mobile)
