import {
  Container,
  Graphics,
  Sprite,
  Text,
  FillGradient,
  type Texture,
} from "pixi.js";
import { computed, ref } from "vue";
import type { GameCard } from "~/types/game";
import type { DeviceCapabilities } from "~/composables/engine/device/useDeviceDetection";

export const useCardRenderer = (
  getTexture: (imageUrl: string) => unknown,
  {
    deviceType,
    deviceCapabilities,
  }: { deviceType: string; deviceCapabilities: DeviceCapabilities }
) => {
  const rarityConfigCache = ref<
    Map<string, { color: number; alpha: number; borderWidth: number }>
  >(new Map());

  const RARITY_COLORS = computed(() => ({
    consumer: 0xb0c3d9,
    industrial: 0x5e98d9,
    milSpec: 0x4b69ff,
    restricted: 0x8847ff,
    classified: 0xd32ce6,
    covert: 0xeb4b4b,
    contraband: 0xe4ae39,
  }));

  const getRarityColorHex = (rarity: string): number => {
    return (
      RARITY_COLORS.value[rarity as keyof typeof RARITY_COLORS.value] ||
      RARITY_COLORS.value.consumer
    );
  };

  const getRarityConfig = (rarity: string, isMatched: boolean) => {
    const cacheKey = `${rarity}-${isMatched}`;

    if (rarityConfigCache.value.has(cacheKey)) {
      return rarityConfigCache.value.get(cacheKey)!;
    }

    const config = {
      color: getRarityColorHex(rarity),
      alpha: isMatched ? 0.25 : 0.15,
      borderWidth: isMatched ? 4 : 2,
    };

    rarityConfigCache.value.set(cacheKey, config);
    return config;
  };

  const createRarityGradient = (rarity: string): FillGradient => {
    const baseColor = getRarityColorHex(rarity);

    // Convert hex color to RGB for manipulation
    const r = (baseColor >> 16) & 255;
    const g = (baseColor >> 8) & 255;
    const b = baseColor & 255;

    // Create lighter and darker variants
    const lighterR = Math.min(255, Math.floor(r + (255 - r) * 0.4));
    const lighterG = Math.min(255, Math.floor(g + (255 - g) * 0.4));
    const lighterB = Math.min(255, Math.floor(b + (255 - b) * 0.4));

    const darkerR = Math.max(0, Math.floor(r * 0.6));
    const darkerG = Math.max(0, Math.floor(g * 0.6));
    const darkerB = Math.max(0, Math.floor(b * 0.6));

    const lighterColor = (lighterR << 16) | (lighterG << 8) | lighterB;
    const darkerColor = (darkerR << 16) | (darkerG << 8) | darkerB;

    // Create diagonal linear gradient from top-left to bottom-right
    return new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 }, // Top-left corner
      end: { x: 1, y: 1 }, // Bottom-right corner
      colorStops: [
        { offset: 0, color: lighterColor },
        { offset: 0.5, color: baseColor },
        { offset: 1, color: darkerColor },
      ],
    });
  };

  const scaleCalculationCache = ref<Map<string, number>>(new Map());

  const calculateOptimalScale = (
    textureWidth: number,
    textureHeight: number,
    cardWidth: number,
    cardHeight: number
  ): number => {
    const cacheKey = `${textureWidth}x${textureHeight}-${cardWidth}x${cardHeight}-${deviceType}`;

    if (scaleCalculationCache.value.has(cacheKey)) {
      return scaleCalculationCache.value.get(cacheKey)!;
    }

    // Optimize image space allocation based on device type
    const isMobileDevice = deviceType === "mobile";
    const pixelRatio = deviceCapabilities.pixelRatio || 1;

    // Increase image area for mobile devices and account for high-DPI screens
    const maxWidthFactor = isMobileDevice ? 0.85 : 0.7; // More space on mobile
    const maxHeightFactor = isMobileDevice ? 0.65 : 0.5; // More vertical space on mobile

    const maxWidth = cardWidth * maxWidthFactor;
    const maxHeight = cardHeight * maxHeightFactor;

    const scaleX = maxWidth / textureWidth;
    const scaleY = maxHeight / textureHeight;

    // For high-DPI mobile screens, allow slightly larger scaling to maintain sharpness
    const baseScale = Math.min(scaleX, scaleY);
    const maxScaleLimit = isMobileDevice && pixelRatio > 1.5 ? 1.2 : 1;
    const scale = Math.min(baseScale, maxScaleLimit);

    scaleCalculationCache.value.set(cacheKey, scale);
    return scale;
  };

  const createWeaponNameText = (
    weaponName: string,
    cardWidth: number,
    isMatched: boolean
  ): Text => {
    // Calculate responsive font size based on card width and device type
    const isMobileDevice = deviceType === "mobile";
    const pixelRatio = deviceCapabilities.pixelRatio || 1;

    // Optimize font size for mobile devices with high-DPI screens
    const baseFontScale = isMobileDevice ? 0.1 : 0.12; // Smaller text on mobile for better fit
    const minFontSize = isMobileDevice ? 6 : 10; // Lower minimum for mobile to fit better
    const maxFontSize = isMobileDevice ? 12 : 18; // Smaller max text on mobile

    // Account for device pixel ratio to ensure crisp text rendering
    const fontSizeMultiplier = pixelRatio > 1.5 ? 1.1 : 1;

    const responsiveFontSize = Math.max(
      minFontSize,
      Math.min(maxFontSize, cardWidth * baseFontScale * fontSizeMultiplier)
    );

    const text = new Text({
      text: weaponName,
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: responsiveFontSize,
        fontWeight: "600",
        fill: isMatched ? 0x000000 : 0xffffff,
        dropShadow: {
          color: 0x000000,
          alpha: 0.5,
          angle: Math.PI / 4,
          blur: 1,
          distance: 1,
        },
        align: "center",
        wordWrap: true,
        wordWrapWidth: cardWidth * 0.8,
      },
    });

    text.anchor.set(0.5);
    text.alpha = isMatched ? 0.9 : 1;

    return text;
  };

  const createHiddenCard = async (
    card: GameCard,
    cardWidth: number,
    cardHeight: number,
    isInteractive: boolean,
    onCardClick: (cardId: string) => void
  ): Promise<Container[]> => {
    const elements: Container[] = [];

    const cardBack = new Graphics()
      .roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12)
      .fill({
        color: 0x4f46e5,
        alpha: 0.9,
      })
      .stroke({
        color: 0x3730a3,
        width: 3,
      });

    const cardBackContainer = new Container();
    cardBackContainer.interactive = isInteractive;
    cardBackContainer.cursor = "pointer";

    cardBack.interactive = false; // Disable individual interaction - container handles it
    cardBackContainer.addChild(cardBack);

    try {
      const logoTexture = (await getTexture("/cs2-logo.svg")) as Texture;
      if (logoTexture && logoTexture.width && logoTexture.height) {
        const logoSprite = new Sprite(logoTexture);

        const maxLogoWidth = cardWidth * 0.6;
        const maxLogoHeight = cardHeight * 0.3;
        const logoScaleX = maxLogoWidth / logoTexture.width;
        const logoScaleY = maxLogoHeight / logoTexture.height;
        const logoScale = Math.min(logoScaleX, logoScaleY, 1);

        logoSprite.scale.set(logoScale);
        logoSprite.anchor.set(0.5);
        logoSprite.position.set(0, 0);
        logoSprite.tint = 0xffffff;
        logoSprite.interactive = false;

        cardBackContainer.addChild(logoSprite);
      } else {
        console.warn("Failed to load CS2 logo, using fallback question mark");
        // TODO - add a fallback image here is twice times
        const questionMark = new Graphics()
          .roundRect(-3, -15, 6, 20, 3)
          .fill(0xffffff)
          .roundRect(-3, 8, 6, 6, 3)
          .fill(0xffffff)
          .roundRect(-3, -8, 6, 6, 3)
          .fill(0xffffff);

        questionMark.interactive = false; // Not interactive - container handles it
        cardBackContainer.addChild(questionMark);
      }
    } catch (err) {
      console.warn(
        "Failed to load CS2 logo, using fallback question mark:",
        err
      );
      // TODO - add a fallback image here is twice times
      const questionMark = new Graphics()
        .roundRect(-3, -15, 6, 20, 3)
        .fill(0xffffff)
        .roundRect(-3, 8, 6, 6, 3)
        .fill(0xffffff)
        .roundRect(-3, -8, 6, 6, 3)
        .fill(0xffffff);

      questionMark.interactive = false; // Not interactive - container handles it
      cardBackContainer.addChild(questionMark);
    }

    // Use more specific click/tap handlers that don't interfere with parallax
    cardBackContainer.on("click", () => onCardClick(card.id));
    cardBackContainer.on("tap", () => onCardClick(card.id));

    if (isInteractive) {
      // Use mouse-specific events to avoid conflicts with touch-based parallax
      cardBackContainer.on("mouseenter", () => {
        cardBack.alpha = 0.7;
      });
      cardBackContainer.on("mouseleave", () => {
        cardBack.alpha = 0.9;
      });

      // Only handle pointerdown/up for visual feedback, not for movement tracking
      let isPointerDown = false;
      cardBackContainer.on("pointerdown", (event) => {
        isPointerDown = true;
        cardBack.alpha = 0.6;
        // Don't stop propagation - let parallax handle movement
      });
      cardBackContainer.on("pointerup", (event) => {
        if (isPointerDown) {
          cardBack.alpha = 0.7;
          isPointerDown = false;
        }
      });
      cardBackContainer.on("pointerupoutside", (event) => {
        if (isPointerDown) {
          cardBack.alpha = 0.9;
          isPointerDown = false;
        }
      });
    }

    elements.push(cardBackContainer);

    return elements;
  };

  const createRevealedCard = async (
    card: GameCard,
    cardWidth: number,
    cardHeight: number
  ): Promise<Container[]> => {
    const elements: Container[] = [];

    const isMatched = card.state === "matched";
    const rarity = card.cs2Item?.rarity || "consumer";
    const rarityConfig = getRarityConfig(rarity, isMatched);

    // Create gradient background
    const gradient = createRarityGradient(rarity);

    const cardFront = new Graphics()
      .roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12)
      .fill({
        fill: gradient,
        alpha: isMatched ? 0.8 : 0.6, // Slightly higher alpha for better gradient visibility
      })
      .stroke({
        color: rarityConfig.color,
        width: rarityConfig.borderWidth,
      });

    elements.push(cardFront);

    if (card.cs2Item?.imageUrl) {
      try {
        const texture = (await getTexture(card.cs2Item.imageUrl)) as Texture;
        if (texture && texture.width && texture.height) {
          const weaponSprite = new Sprite(texture);

          const scale = calculateOptimalScale(
            texture.width,
            texture.height,
            cardWidth,
            cardHeight
          );

          weaponSprite.scale.set(scale);
          weaponSprite.anchor.set(0.5);

          const isMobileDevice = deviceType === "mobile";
          const verticalOffset = isMobileDevice ? -5 : -10;
          weaponSprite.position.set(0, verticalOffset);

          if (isMobileDevice && deviceCapabilities.pixelRatio > 1.5) {
            // Ensure crisp rendering on high-DPI displays
            weaponSprite.roundPixels = true;
          }

          if (isMatched) {
            weaponSprite.alpha = 0.8;
          }

          elements.push(weaponSprite);

          // Add glow effect for matched cards - not working as expected - TODO: fix
          if (isMatched) {
            const glowRadius =
              Math.max(weaponSprite.width, weaponSprite.height) * 0.4;
            const glowFilter = new Graphics().circle(0, 0, glowRadius).fill({
              color: 0x22c55e, // Green glow for matched
              alpha: 0.15,
            });

            glowFilter.position.set(0, -10);
            elements.unshift(glowFilter); // Add glow behind the sprite
          }
        }
      } catch (err) {
        console.warn(`Failed to load texture for card ${card.id}:`, err);
      }
    }

    if (card.cs2Item?.name) {
      const weaponNameText = createWeaponNameText(
        card.cs2Item.name,
        cardWidth,
        isMatched
      );

      const isMobileDevice = deviceType === "mobile";
      const textVerticalPosition = isMobileDevice
        ? cardHeight * 0.35
        : cardHeight * 0.3;
      weaponNameText.position.set(0, textVerticalPosition);

      if (isMobileDevice && deviceCapabilities.pixelRatio > 1.5) {
        weaponNameText.roundPixels = true;
      }

      elements.push(weaponNameText);
    }

    return elements;
  };

  const createCardContainer = async (
    card: GameCard,
    position: { x: number; y: number },
    cardWidth: number,
    cardHeight: number,
    isInteractive: boolean,
    onCardClick: (cardId: string) => void
  ): Promise<Container | null> => {
    try {
      const cardContainer = new Container();
      cardContainer.position.set(position.x, position.y);

      let elements: Container[] = [];

      if (card.state === "hidden") {
        elements = await createHiddenCard(
          card,
          cardWidth,
          cardHeight,
          isInteractive,
          onCardClick
        );
      } else if (card.state === "revealed" || card.state === "matched") {
        elements = await createRevealedCard(card, cardWidth, cardHeight);
      }

      elements.forEach((element) => cardContainer.addChild(element));

      return cardContainer;
    } catch (err) {
      console.error(`Error creating card container for ${card.id}:`, err);
      return null;
    }
  };

  // Performance monitoring and cache management
  const getCacheStats = computed(() => ({
    rarityConfigCacheSize: rarityConfigCache.value.size,
    scaleCalculationCacheSize: scaleCalculationCache.value.size,
    totalCachedItems:
      rarityConfigCache.value.size + scaleCalculationCache.value.size,
  }));

  const clearCache = () => {
    rarityConfigCache.value.clear();
    scaleCalculationCache.value.clear();
  };

  const cleanup = () => {
    clearCache();
  };

  return {
    createCardContainer,
    getRarityColorHex,
    getCacheStats,
    clearCache,
    cleanup,
  };
};
