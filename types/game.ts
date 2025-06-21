// CS2 Item Rarity Levels
export type ItemRarity =
  | "consumer"
  | "industrial"
  | "milSpec"
  | "restricted"
  | "classified"
  | "covert"
  | "contraband";

// CS2 Item Category
export type ItemCategory = "weapon" | "knife" | "glove" | "sticker" | "agent";

// CS2 Item from API
export interface CS2Item {
  id: string;
  name: string;
  imageUrl: string;
  rarity: ItemRarity;
  category: ItemCategory;
  collection?: string;
  exterior?: string;
}

// Memory Card State
export type CardState = "hidden" | "revealed" | "matched";

// Memory Game Card
export interface GameCard {
  id: string;
  pairId: string;
  cs2Item: CS2Item;
  state: CardState;
  position: { x: number; y: number };
}

// Game Difficulty Settings
export interface DifficultyLevel {
  name: "easy" | "medium" | "hard";
  cardCount: 12 | 24 | 48;
  gridSize: { rows: number; cols: number };
}

// Game Statistics
export interface GameStats {
  moves: number;
  timeElapsed: number;
  matchesFound: number;
  totalPairs: number;
  isComplete: boolean;
}

// Game State
export interface GameState {
  id: string;
  seed: string;
  difficulty: DifficultyLevel;
  cards: GameCard[];
  stats: GameStats;
  startTime: number | null;
  isPlaying: boolean;
  selectedCards: string[];
  gameHistory: GameResult[];
}

// Completed Game Result
export interface GameResult {
  id: string;
  seed: string;
  difficulty: DifficultyLevel["name"];
  moves: number;
  timeElapsed: number;
  completedAt: Date;
  score: number;
}

// Game Options
export interface GameOptions {
  difficulty: DifficultyLevel["name"];
  seed?: string;
  enableSound: boolean;
  enableParallax: boolean;
}

// API Response Types
export interface CS2ApiResponse {
  items: CS2Item[];
  total: number;
  page: number;
  hasNext: boolean;
}

// Addition for Canvas rendering - New types for Canvas rendering
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

// Local Storage Keys
export const STORAGE_KEYS = {
  GAME_STATE: "cs2-memory-game-state",
  GAME_HISTORY: "cs2-memory-game-history",
  GAME_OPTIONS: "cs2-memory-game-options",
  API_CACHE: "cs2-memory-game-api-cache",
} as const;
