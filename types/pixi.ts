import type { Application, Container, Graphics, Sprite } from "pixi.js";
import type { GameCard } from "./game";

// Types for PixiJS integration
export interface GamePixiApplication {
  app: Application;
  stage: Container;
  cardContainer: Container;
  backgroundContainer: Container;
}

export interface Card extends Container {
  cardId: string;
  cardData: GameCard;
  isFlipping: boolean;
  flipProgress: number;
  parallaxOffset: { x: number; y: number };
  originalPosition: { x: number; y: number };
  cardBack?: Container;
  cardFront?: Container;
}

export interface GameEngineConfig {
  width: number;
  height: number;
  backgroundColor: number;
  antialias: boolean;
  resolution: number;
  powerPreference: "high-performance" | "low-power";
}

// PixiJS Game Engine wrapper
export interface GameEngine {
  app: Application;
  stage: Container;
  cardContainer: Container;
  effectsContainer: Container;
  uiContainer: Container;
  isInitialized: boolean;
}

// PixiJS Game Card Object - based on Container with additional game properties
export interface PixiGameCard extends Container {
  gameCard: GameCard;
  cardBack: Graphics;
  cardFront: Container;
  itemImage?: Sprite;
  rarityBackground?: Graphics;
  isFlipping: boolean;
  flipTween?: unknown;
}

// PixiJS Animation Data
export interface GameAnimationData {
  target: Container | Sprite;
  duration: number;
  properties: Record<string, number>;
  easing?: string;
  onComplete?: () => void;
  onUpdate?: (progress: number) => void;
  // Runtime properties added during animation
  id?: string;
  startTime?: number;
  initialValues?: Record<string, number>;
}

// PixiJS Effect Data
export interface GameEffect {
  id: string;
  type: "particle" | "glow" | "pulse" | "shake" | "blur";
  target: Container | Sprite;
  duration: number;
  intensity: number;
  isActive: boolean;
  filter?: unknown; // PixiJS Filter - will be specified in implementation
}

// PixiJS Parallax Data
export interface GameParallax {
  container: Container;
  strength: number;
  enabled: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  cleanup?: () => void;
}

// PixiJS Game Object Interface
export interface GameObject {
  id: string;
  sprite: Container | Sprite;
  type: "card" | "effect" | "ui";
  isActive: boolean;
  depth: number;
}

// Card rendering configuration
export interface CardRenderConfig {
  width: number;
  height: number;
  cornerRadius: number;
  borderWidth: number;
  shadowOffset: { x: number; y: number };
  shadowBlur: number;
}

// CS2 Rarity colors
export interface RarityColors {
  primary: number;
  secondary: number;
  accent: number;
  text: number;
}

// Animation tween data
export interface TweenData {
  from: number;
  to: number;
  duration: number;
  easing: (t: number) => number;
  onUpdate: (value: number) => void;
  onComplete?: () => void;
}

// Animation configuration
export interface AnimationConfig {
  flipDuration: number;
  hoverScale: number;
  matchDelay: number;
  shuffleDuration: number;
  dealDuration: number;
}

// Performance configuration
export interface PerformanceConfig {
  maxParticles: number;
  texturePoolSize: number;
  enableBatching: boolean;
  enableCulling: boolean;
  targetFPS: number;
}

// Game engine initialization options
export interface GameEngineOptions {
  width?: number;
  height?: number;
  backgroundColor?: number;
  antialias?: boolean;
  autoDensity?: boolean;
  resolution?: number;
}

// Filter types for visual effects
export interface FilterConfig {
  type: "blur" | "glow" | "outline" | "shadow" | "colorMatrix";
  strength: number;
  color?: number;
  distance?: number;
  alpha?: number;
}
