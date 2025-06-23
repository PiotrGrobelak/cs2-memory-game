# Architektura UI dla CS2 Memory Game

## 1. Przegląd dotychczasowej struktury

Architektura UI jest oparta na hybrydowym podejściu łączącym Vue 3 komponenty dla interfejsu użytkownika z Canvas-based renderingiem planszy gry. Struktura wykorzystuje Nuxt 3 jako framework bazowy z Pinia do zarządzania stanem i composables dla logiki biznesowej.

### Kluczowe założenia architektury:

- **Vue komponenty** obsługują UI (header, dialogi, kontrolki)
- **GameCanvas z PixiJS** odpowiada wyłącznie za rendering planszy gry
- **Controlled components** pattern dla maksymalnej kontroli nad stanem
- **Separation of concerns** między rendering a logiką biznesową
- **Lazy loading** dla komponentów wymagających dużych zasobów
- **Responsive design** z automatycznym dostosowaniem do różnych ekranów

## 2. Lista widoków

### Główne widoki aplikacji

**Game Interface**

- Ścieżka: `components/game/core/GameInterface.vue`
- Główny cel: Kontener zarządzający całą grą, error handling, loading states, koordynacja między komponentami

**Game Canvas** _(nowy)_

- Ścieżka: `components/game/core/GameCanvas.vue`
- Główny cel: Controlled component dla renderingu planszy gry z PixiJS, obsługa interakcji z kartami, lazy loading

**New Game Dialog**

- Ścieżka: `components/game/dialogs/NewGameDialog.vue`
- Główny cel: Konfiguracja nowej gry (difficulty, seed), QR code scanning, walidacja parametrów

**Settings Dialog**

- Ścieżka: `components/game/dialogs/SettingsDialog.vue`
- Główny cel: Zarządzanie ustawieniami audio, cache management, preferencje użytkownika

### Komponenty UI

**Game Header**

- Ścieżka: `components/game/ui/header/GameHeader.vue`
- Główny cel: Główna nawigacja, wyświetlanie informacji o grze, dostęp do funkcji

**Game Settings Button**

- Ścieżka: `components/game/ui/header/GameSettingsButton.vue`
- Główny cel: Szybki dostęp do ustawień gry, toggle audio, quick actions

**Game Share Button**

- Ścieżka: `components/game/ui/header/GameShareButton.vue`
- Główny cel: Udostępnianie seed przez QR code, copy to clipboard, social sharing

**Game Status Bar**

- Ścieżka: `components/game/ui/status/GameStatusBar.vue`
- Główny cel: Wyświetlanie aktualnego stanu gry, timer, licznik ruchów

**Game Progress Bar**

- Ścieżka: `components/game/ui/status/GameProgressBar.vue`
- Główny cel: Wizualny postęp ukończenia gry, animowane wskaźniki

**Game Stat Card**

- Ścieżka: `components/game/ui/status/GameStatCard.vue`
- Główny cel: Wyświetlanie pojedynczej statystyki gry, reusable component

### Komponenty pomocnicze

**Game Error Boundary**

- Ścieżka: `components/error/GameErrorBoundary.vue`
- Główny cel: Obsługa błędów aplikacji, graceful fallbacks, error recovery

**Game Error Display**

- Ścieżka: `components/error/GameErrorDisplay.vue`
- Główny cel: Prezentacja błędów użytkownikowi, retry options

**Game Debug Panel**

- Ścieżka: `components/debug/GameDebugPanel.vue`
- Główny cel: Debugging tools, performance metrics, development aids

## 3. Układ i struktura plików

```
components/
├── game/
│   ├── core/
│   │   ├── GameInterface.vue          # Główny kontener gry
│   │   └── GameCanvas.vue             # Plansza gry (NOWY)
│   ├── dialogs/
│   │   ├── NewGameDialog.vue          # Dialog nowej gry
│   │   └── SettingsDialog.vue         # Dialog ustawień
│   └── ui/
│       ├── header/
│       │   ├── GameHeader.vue         # Header gry
│       │   ├── GameSettingsButton.vue # Przycisk ustawień
│       │   └── GameShareButton.vue    # Przycisk share
│       └── status/
│           ├── GameStatusBar.vue      # Status bar
│           ├── GameProgressBar.vue    # Progress bar
│           └── GameStatCard.vue       # Karty statystyk
├── error/
│   ├── GameErrorBoundary.vue          # Error boundary
│   └── GameErrorDisplay.vue           # Display błędów
└── debug/
    └── GameDebugPanel.vue             # Panel debug

composables/
├── engine/                            # NOWE COMPOSABLES
│   ├── useGameEngine.ts               # Singleton Game manager
│   ├── useCardRenderer.ts             # Rendering kart
│   ├── useGameLayout.ts               # Responsive layout
│   ├── useGameAnimations.ts           # System animacji
│   └── useGameInteractions.ts         # Event handling
├── core/
│   ├── useGame.ts                     # Główna logika gry
│   ├── useGameController.ts           # Kontroler gry
│   └── useGameLoader.ts               # Ładowanie gry
├── data/
│   ├── useCS2Data.ts                  # Dane CS2
│   ├── useGamePersistence.ts          # Persistence
│   └── useSeedSystem.ts               # System seed
└── device/
    └── useDeviceDetection.ts          # Detekcja urządzenia

stores/
└── game/
    ├── core.ts                        # Store główny
    ├── cards.ts                       # Store kart
    ├── timer.ts                       # Store timer
    └── ui.ts                          # Store UI

types/
├── game.ts                            # Typy gry
└── pixi.ts                            # Typy PixiJS (NOWY)
```

## 4. Kluczowe komponenty

### GameCanvas.vue _(nowy)_

Controlled component zarządzający renderingiem planszy gry poprzez PixiJS. Przyjmuje wymiary ekranu jako props i emituje card selection events do parent component.

**Kluczowe funkcje:**

- Singleton GameEngine management
- Responsive canvas scaling i positioning
- Card interaction handling (click/tap events)
- Lazy loading z loading state management
- Canvas visibility management podczas resize events
- Local state dla localStorage persistence

### GameInterface.vue _(rozszerzony)_

Główny kontener orchestrujący wszystkie aspekty gry. Zarządza error handling, loading states i koordynację między komponentami.

**Kluczowe funkcje:**

- Central error boundary integration
- Loading state management dla GameCanvas
- Responsive layout coordination
- Game state synchronization
- Event delegation między komponentami

### Engine Composables _(nowe)_

**useGameEngine.ts**

- Singleton manager dla GameEngine
- Resource management i cleanup
- Performance optimization patterns

**useCardRenderer.ts**

- Konwersja GameCard objects na PixiJS sprites
- Texture loading i caching integration
- Rarity-based gradient rendering

**useGameLayout.ts**

- Responsive positioning i scaling logic
- Device-aware layout calculations
- Grid system dla różnych difficulty levels

**useGameAnimations.ts**

- Centralized animation system
- Card flip animations z hardware acceleration
- Parallax effects dla mouse/touch input

**useGameInteractions.ts**

- Event handling dla card interactions
- Touch/mouse input normalization
- Gesture recognition dla mobile devices

### Dialog Components _(rozszerzone)_

**NewGameDialog.vue**

- Difficulty level selection (12/18/24 cards)
- Custom seed input z walidacją
- QR code scanning functionality
- Random seed generation

**SettingsDialog.vue**

- Audio controls (master volume, sound effects)
- Cache management (clear, refresh, size info)
- Performance settings
- User preferences persistence

### Status Components _(zoptymalizowane)_

**GameStatusBar.vue**

- Real-time timer display
- Move counter z animacjami
- Current game difficulty indicator
- Seed information display

**GameProgressBar.vue**

- Animated progress visualization
- Completion percentage calculation
- Milestone indicators
- Performance-optimized updates

**GameStatCard.vue**

- Reusable statistics display component
- Customizable metrics presentation
- Historical data integration
- Responsive design patterns
