import { ref, computed } from "vue";
import { Assets, Container, Graphics, Sprite, Text } from "pixi.js";
import type { Texture } from "pixi.js";
import type { Card } from "~/types/pixi";
import type { GameCard } from "~/types/game";

export const useCardRenderer = () => {
  const cardSprites = ref<Map<string, Card>>(new Map());
  const _textureCache = ref<Map<string, Texture>>(new Map());

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

  // Function to create card back
  const createBackCard = (cardWidth: number, cardHeight: number): Container => {
    const cardBack = new Container();

    // Create background
    const background = new Graphics();
    background
      .roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10)
      .fill(0x2563eb) // Blue card back
      .stroke({ color: 0x1e40af, width: 2 });
    cardBack.addChild(background);

    // Add back pattern (question mark or CS2 logo)
    const backPattern = new Graphics();
    backPattern.circle(0, 0, 30).fill(0x3b82f6);
    cardBack.addChild(backPattern);

    return cardBack;
  };

  // Function to create card front with weapon image
  const _createCardFront = async (
    card: GameCard,
    cardWidth: number,
    cardHeight: number
  ): Promise<Container> => {
    const cardFront = new Container();

    // Create background with rarity colors
    const rarity = card.cs2Item?.rarity || "consumer";
    const colors =
      rarityGradients[rarity as keyof typeof rarityGradients] ||
      rarityGradients.consumer;

    const background = new Graphics();
    background
      .roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10)
      .fill(colors[0])
      .stroke({ color: colors[1], width: 2 });

    cardFront.addChild(background);

    // Load and add weapon image if available
    const imageUrl = card.cs2Item?.imageUrl;
    if (imageUrl) {
      try {
        // Create sprite directly from URL
        const texture = await Assets.load(imageUrl);
        const imageSprite = new Sprite(texture);

        // Calculate image dimensions with padding
        const padding = 15;
        const maxWidth = cardWidth - padding * 2;
        const maxHeight = cardHeight - padding * 2;

        // Scale image to fit within card bounds
        const scale = Math.min(
          maxWidth / imageSprite.texture.width,
          maxHeight / imageSprite.texture.height
        );
        imageSprite.scale.set(scale);

        // // Center the image
        // imageSprite.x = -imageSprite.width / 2;
        // imageSprite.y = -imageSprite.height / 2;

        // // // Set initial position (will be adjusted when loaded)
        // imageSprite.x = -cardWidth / 4;
        // imageSprite.y = -cardHeight / 4;

        imageSprite.x = 0;
        imageSprite.y = 0;
        imageSprite.anchor.set(0.5);

        // imageSprite.scale.set(0);
        // imageSprite.alpha = 0;

        cardFront.addChild(imageSprite);
      } catch (error: unknown) {
        // Fallback: show error text if sprite creation fails
        const errorText = new Text({
          text: `Image\nError: ${error instanceof Error ? error.message : "Unknown error"}`,
          style: {
            fontSize: 14,
            fill: 0xff0000,
            align: "center",
            fontFamily: "Arial, sans-serif",
          },
        });

        errorText.x = -errorText.width / 2;
        errorText.y = -errorText.height / 2;
        cardFront.addChild(errorText);
      }
    } else {
      // Fallback: show weapon name if no image URL
      const weaponName = card.cs2Item?.name || "Unknown";
      const nameText = new Text({
        text: weaponName,
        style: {
          fontSize: 12,
          fill: 0xffffff,
          align: "center",
          fontFamily: "Arial, sans-serif",
          wordWrap: true,
          wordWrapWidth: cardWidth - 20,
        },
      });

      nameText.x = -nameText.width / 2;
      nameText.y = -nameText.height / 2;
      cardFront.addChild(nameText);
    }

    return cardFront;
  };

  const createCard = async (
    card: GameCard,
    position: { x: number; y: number }
  ) => {
    const cardWidth = 120;
    const cardHeight = 160;

    // Create container for card
    const cardObject = Object.assign(new Container(), {
      cardId: card.id,
      cardData: card,
      isFlipping: false,
      flipProgress: 0,
      parallaxOffset: { x: 0, y: 0 },
      originalPosition: { x: position.x, y: position.y }, // Store original position
    }) as Card;

    // Positioning
    // cardObject.x = position.x;
    // cardObject.y = position.y;
    cardObject.x = position.x + cardWidth / 2;
    cardObject.y = position.y + cardHeight / 2;
    cardObject.pivot.set(cardWidth / 2, cardHeight / 2);

    // Create card back using the extracted function
    const cardBack = createBackCard(cardWidth, cardHeight);

    // Create card front with weapon image (hidden initially)
    // const cardFront = await createCardFront(card, cardWidth, cardHeight);
    // cardFront.alpha = 0; // Hidden initially
    // cardObject.addChild(cardFront);
    cardObject.addChild(cardBack);

    // Store references to card faces
    // cardObject.cardFront = cardFront;
    // cardObject.cardBack = cardBack;

    // Add to cache
    cardSprites.value.set(card.id, cardObject);

    return cardObject;
  };

  const updateCardState = (cardId: string, state: GameCard["state"]) => {
    console.log("Run updateCardState");
    const sprite = cardSprites.value.get(cardId);
    if (!sprite) return;

    // Flip animation based on state
    switch (state) {
      case "revealed":
        animateFlip(sprite as Card, true);
        break;
      case "hidden":
        animateFlip(sprite as Card, false);
        break;
      case "matched":
        animateMatch(sprite as Card);
        break;
    }
  };

  const animateFlip = (sprite: Card, reveal: boolean) => {
    console.log("Run animateFlip");
    if (sprite.isFlipping) return; // Prevent multiple animations

    sprite.isFlipping = true;
    const cardBack = sprite.cardBack;
    const cardFront = sprite.cardFront;

    if (!cardBack || !cardFront) {
      sprite.isFlipping = false;
      return;
    }

    let progress = 0;
    const duration = 0.5; // 500ms animation
    const startTime = Date.now();

    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      progress = Math.min(elapsed / duration, 1);

      // Calculate scale for flip effect (goes from 1 to 0 to 1)
      const scale = Math.abs(Math.cos(progress * Math.PI));
      sprite.scale.x = scale;

      // Switch content at the middle of animation (when scale is near 0)
      if (progress > 0.5) {
        if (reveal) {
          cardBack.alpha = 0;
          cardFront.alpha = 1;
        } else {
          cardBack.alpha = 1;
          cardFront.alpha = 0;
        }
      }

      sprite.flipProgress = progress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        sprite.isFlipping = false;
        sprite.scale.x = 1; // Ensure final scale is 1
      }
    };

    animate();
  };

  const animateMatch = (sprite: Card) => {
    console.log("Run animateMatch");
    // Success animation - pulsing
    const originalScale = sprite.scale.y;
    sprite.scale.set(originalScale * 1.2);

    setTimeout(() => {
      sprite.scale.set(originalScale);
      sprite.alpha = 0.7; // Darken matched cards
    }, 200);
  };

  const applyParallaxEffect = (
    cardId: string,
    mouseX: number,
    mouseY: number,
    _canvasWidth: number,
    _canvasHeight: number
  ) => {
    console.log("Run applyParallaxEffect");
    const sprite = cardSprites.value.get(cardId) as Card;
    if (!sprite || !sprite.originalPosition) return;

    // Calculate distance from mouse to card center
    const cardCenterX = sprite.originalPosition.x;
    const cardCenterY = sprite.originalPosition.y;

    // Calculate distance from mouse to card
    const distanceX = mouseX - cardCenterX;
    const distanceY = mouseY - cardCenterY;

    // Maximum distance for effect (adjust this value to control the effect radius)
    const maxDistance = 200; // Increased for wider effect area
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

    // Calculate effect strength based on distance (closer = stronger effect)
    const effectStrength = Math.max(0, 1 - distance / maxDistance);

    // Calculate parallax offset based on mouse position relative to card
    const parallaxStrength = 0.8; // Significantly increased for more visible effect
    const offsetX =
      (distanceX / maxDistance) * parallaxStrength * effectStrength * 50; // Increased multiplier
    const offsetY =
      (distanceY / maxDistance) * parallaxStrength * effectStrength * 50; // Increased multiplier

    sprite.parallaxOffset = { x: offsetX, y: offsetY };
    // Use original position as base, not current position
    sprite.x = sprite.originalPosition.x + offsetX;
    sprite.y = sprite.originalPosition.y + offsetY;
  };

  return {
    cardSprites: computed(() => cardSprites.value),
    createCard,
    updateCardState,
    applyParallaxEffect,
  };
};
