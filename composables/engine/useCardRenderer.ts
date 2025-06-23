import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import { computed, ref } from "vue";
import type { GameCard } from "~/types/game";

export const useCardRenderer = (getTexture: (imageUrl: string) => unknown) => {
  // Simplified cache for card dimensions and rarity configurations
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

  const scaleCalculationCache = ref<Map<string, number>>(new Map());

  const calculateOptimalScale = (
    textureWidth: number,
    textureHeight: number,
    cardWidth: number,
    cardHeight: number
  ): number => {
    const cacheKey = `${textureWidth}x${textureHeight}-${cardWidth}x${cardHeight}`;

    if (scaleCalculationCache.value.has(cacheKey)) {
      return scaleCalculationCache.value.get(cacheKey)!;
    }

    const maxWidth = cardWidth * 0.7;
    const maxHeight = cardHeight * 0.6;
    const scaleX = maxWidth / textureWidth;
    const scaleY = maxHeight / textureHeight;
    const scale = Math.min(scaleX, scaleY, 1);

    scaleCalculationCache.value.set(cacheKey, scale);
    return scale;
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

    // Event handlers will be added to the container, not individual cardBack

    // Create a single interactive card back container
    const cardBackContainer = new Container();
    cardBackContainer.interactive = isInteractive;
    cardBackContainer.cursor = "pointer";

    // Add card background to container
    cardBack.interactive = false; // Disable individual interaction - container handles it
    cardBackContainer.addChild(cardBack);

    // Add CS2 logo to the same container
    try {
      const logoTexture = (await getTexture("/cs2-logo.svg")) as Texture;
      if (logoTexture && logoTexture.width && logoTexture.height) {
        const logoSprite = new Sprite(logoTexture);

        // Calculate scale to fit logo nicely on the card back
        const maxLogoWidth = cardWidth * 0.6;
        const maxLogoHeight = cardHeight * 0.3;
        const logoScaleX = maxLogoWidth / logoTexture.width;
        const logoScaleY = maxLogoHeight / logoTexture.height;
        const logoScale = Math.min(logoScaleX, logoScaleY, 1);

        logoSprite.scale.set(logoScale);
        logoSprite.anchor.set(0.5);
        logoSprite.position.set(0, 0);
        logoSprite.tint = 0xffffff; // White tint for visibility on blue background
        logoSprite.interactive = false; // Not interactive - container handles it

        cardBackContainer.addChild(logoSprite);
      } else {
        console.warn("Failed to load CS2 logo, using fallback question mark");
        // Fallback to question mark if logo fails to load
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
      // Fallback to question mark if logo fails to load
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

    // Add event handlers to the container
    cardBackContainer.on("click", () => onCardClick(card.id));
    cardBackContainer.on("tap", () => onCardClick(card.id));

    if (isInteractive) {
      cardBackContainer.on("pointerover", () => {
        cardBack.alpha = 0.7;
      });
      cardBackContainer.on("pointerout", () => {
        cardBack.alpha = 0.9;
      });
      cardBackContainer.on("pointerdown", () => {
        cardBack.alpha = 0.6;
      });
      cardBackContainer.on("pointerup", () => {
        cardBack.alpha = 0.7;
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
    const rarityConfig = getRarityConfig(
      card.cs2Item?.rarity || "consumer",
      isMatched
    );

    const cardFront = new Graphics()
      .roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12)
      .fill({
        color: rarityConfig.color,
        alpha: rarityConfig.alpha,
      })
      .stroke({
        color: rarityConfig.color,
        width: rarityConfig.borderWidth,
      });

    elements.push(cardFront);

    // Add weapon image if available - optimized texture loading
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
          weaponSprite.position.set(0, -5);

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

            glowFilter.position.set(0, -5);
            elements.unshift(glowFilter); // Add glow behind the sprite
          }
        }
      } catch (err) {
        console.warn(`Failed to load texture for card ${card.id}:`, err);
      }
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
