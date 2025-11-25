// Pixelated character sprite system for game avatars
import { Container, Graphics } from 'pixi.js';

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface CharacterSprite {
    container: Container;
    direction: Direction;
    frameIndex: number;
    animationTimer: number;
}

const PIXEL_SIZE = 3; // Size of each "pixel" in the character
const ANIMATION_SPEED = 0.15; // Higher = slower animation

/**
 * Parse hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 255, b: 0 };
}

/**
 * Darken a color by a percentage
 */
function darkenColor(hex: string, percent: number): number {
    const rgb = hexToRgb(hex);
    const r = Math.floor(rgb.r * (1 - percent));
    const g = Math.floor(rgb.g * (1 - percent));
    const b = Math.floor(rgb.b * (1 - percent));
    return (r << 16) + (g << 8) + b;
}

/**
 * Lighten a color by a percentage
 */
function lightenColor(hex: string, percent: number): number {
    const rgb = hexToRgb(hex);
    const r = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * percent));
    const g = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * percent));
    const b = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * percent));
    return (r << 16) + (g << 8) + b;
}

/**
 * Draw a single pixel at the specified position
 */
function drawPixel(graphics: Graphics, x: number, y: number, color: number): void {
    graphics.rect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    graphics.fill(color);
}

/**
 * Create a pixelated character sprite facing down (frame 0 = standing, frames 1-2 = walking)
 */
function createDownSprite(color: string, frame: number): Graphics {
    const graphics = new Graphics();
    const baseColor = parseInt(color.replace('#', ''), 16);
    const darkColor = darkenColor(color, 0.3);
    const lightColor = lightenColor(color, 0.2);
    const skinColor = 0xFFDBB5;

    // Head (3x3)
    drawPixel(graphics, 3, 1, skinColor);
    drawPixel(graphics, 4, 1, skinColor);
    drawPixel(graphics, 5, 1, skinColor);
    drawPixel(graphics, 3, 2, skinColor);
    drawPixel(graphics, 4, 2, skinColor);
    drawPixel(graphics, 5, 2, skinColor);

    // Eyes
    drawPixel(graphics, 3, 2, 0x000000);
    drawPixel(graphics, 5, 2, 0x000000);

    // Body (shirt)
    drawPixel(graphics, 3, 3, baseColor);
    drawPixel(graphics, 4, 3, lightColor);
    drawPixel(graphics, 5, 3, baseColor);
    drawPixel(graphics, 3, 4, baseColor);
    drawPixel(graphics, 4, 4, baseColor);
    drawPixel(graphics, 5, 4, baseColor);
    drawPixel(graphics, 3, 5, baseColor);
    drawPixel(graphics, 4, 5, darkColor);
    drawPixel(graphics, 5, 5, baseColor);

    // Legs/Pants (darker)
    if (frame === 0) {
        // Standing - legs together
        drawPixel(graphics, 3, 6, darkColor);
        drawPixel(graphics, 4, 6, darkColor);
        drawPixel(graphics, 5, 6, darkColor);
        drawPixel(graphics, 3, 7, darkColor);
        drawPixel(graphics, 5, 7, darkColor);
    } else if (frame === 1) {
        // Walking - left leg forward
        drawPixel(graphics, 3, 6, darkColor);
        drawPixel(graphics, 5, 6, darkColor);
        drawPixel(graphics, 2, 7, darkColor);
        drawPixel(graphics, 5, 7, darkColor);
    } else {
        // Walking - right leg forward
        drawPixel(graphics, 3, 6, darkColor);
        drawPixel(graphics, 5, 6, darkColor);
        drawPixel(graphics, 3, 7, darkColor);
        drawPixel(graphics, 6, 7, darkColor);
    }

    // Center the sprite
    graphics.pivot.x = 4.5 * PIXEL_SIZE;
    graphics.pivot.y = 4 * PIXEL_SIZE;

    return graphics;
}

/**
 * Create a pixelated character sprite facing up
 */
function createUpSprite(color: string, frame: number): Graphics {
    const graphics = new Graphics();
    const baseColor = parseInt(color.replace('#', ''), 16);
    const darkColor = darkenColor(color, 0.3);
    const lightColor = lightenColor(color, 0.2);
    const skinColor = 0xFFDBB5;
    const hairColor = darkenColor(color, 0.5);

    // Hair back
    drawPixel(graphics, 3, 1, hairColor);
    drawPixel(graphics, 4, 1, hairColor);
    drawPixel(graphics, 5, 1, hairColor);

    // Head
    drawPixel(graphics, 3, 2, skinColor);
    drawPixel(graphics, 4, 2, skinColor);
    drawPixel(graphics, 5, 2, skinColor);

    // Body (shirt)
    drawPixel(graphics, 3, 3, baseColor);
    drawPixel(graphics, 4, 3, lightColor);
    drawPixel(graphics, 5, 3, baseColor);
    drawPixel(graphics, 3, 4, baseColor);
    drawPixel(graphics, 4, 4, baseColor);
    drawPixel(graphics, 5, 4, baseColor);
    drawPixel(graphics, 3, 5, baseColor);
    drawPixel(graphics, 4, 5, darkColor);
    drawPixel(graphics, 5, 5, baseColor);

    // Legs/Pants
    if (frame === 0) {
        // Standing
        drawPixel(graphics, 3, 6, darkColor);
        drawPixel(graphics, 4, 6, darkColor);
        drawPixel(graphics, 5, 6, darkColor);
        drawPixel(graphics, 3, 7, darkColor);
        drawPixel(graphics, 5, 7, darkColor);
    } else if (frame === 1) {
        // Walking - left leg forward
        drawPixel(graphics, 3, 6, darkColor);
        drawPixel(graphics, 5, 6, darkColor);
        drawPixel(graphics, 2, 7, darkColor);
        drawPixel(graphics, 5, 7, darkColor);
    } else {
        // Walking - right leg forward
        drawPixel(graphics, 3, 6, darkColor);
        drawPixel(graphics, 5, 6, darkColor);
        drawPixel(graphics, 3, 7, darkColor);
        drawPixel(graphics, 6, 7, darkColor);
    }

    graphics.pivot.x = 4.5 * PIXEL_SIZE;
    graphics.pivot.y = 4 * PIXEL_SIZE;

    return graphics;
}

/**
 * Create a pixelated character sprite facing left
 */
function createLeftSprite(color: string, frame: number): Graphics {
    const graphics = new Graphics();
    const baseColor = parseInt(color.replace('#', ''), 16);
    const darkColor = darkenColor(color, 0.3);
    const lightColor = lightenColor(color, 0.2);
    const skinColor = 0xFFDBB5;
    const hairColor = darkenColor(color, 0.5);

    // Hair
    drawPixel(graphics, 3, 1, hairColor);
    drawPixel(graphics, 4, 1, hairColor);

    // Head
    drawPixel(graphics, 3, 2, skinColor);
    drawPixel(graphics, 4, 2, skinColor);
    drawPixel(graphics, 5, 2, skinColor);

    // Eye
    drawPixel(graphics, 3, 2, 0x000000);

    // Body (shirt) - side view
    drawPixel(graphics, 3, 3, baseColor);
    drawPixel(graphics, 4, 3, lightColor);
    drawPixel(graphics, 5, 3, baseColor);
    drawPixel(graphics, 3, 4, baseColor);
    drawPixel(graphics, 4, 4, baseColor);
    drawPixel(graphics, 5, 4, baseColor);
    drawPixel(graphics, 4, 5, darkColor);
    drawPixel(graphics, 5, 5, baseColor);

    // Legs
    if (frame === 0) {
        // Standing
        drawPixel(graphics, 4, 6, darkColor);
        drawPixel(graphics, 5, 6, darkColor);
        drawPixel(graphics, 4, 7, darkColor);
        drawPixel(graphics, 5, 7, darkColor);
    } else if (frame === 1) {
        // Walking - front leg forward
        drawPixel(graphics, 3, 6, darkColor);
        drawPixel(graphics, 5, 6, darkColor);
        drawPixel(graphics, 3, 7, darkColor);
        drawPixel(graphics, 5, 7, darkColor);
    } else {
        // Walking - back leg forward
        drawPixel(graphics, 4, 6, darkColor);
        drawPixel(graphics, 6, 6, darkColor);
        drawPixel(graphics, 4, 7, darkColor);
        drawPixel(graphics, 6, 7, darkColor);
    }

    graphics.pivot.x = 4.5 * PIXEL_SIZE;
    graphics.pivot.y = 4 * PIXEL_SIZE;

    return graphics;
}

/**
 * Create a pixelated character sprite facing right (mirror of left)
 */
function createRightSprite(color: string, frame: number): Graphics {
    const graphics = createLeftSprite(color, frame);
    graphics.scale.x = -1; // Flip horizontally
    return graphics;
}

/**
 * Create a character sprite container with animation
 */
export function createCharacterSprite(color: string): CharacterSprite {
    const container = new Container();

    // Start with down-facing standing sprite
    const initialSprite = createDownSprite(color, 0);
    container.addChild(initialSprite);

    return {
        container,
        direction: 'down',
        frameIndex: 0,
        animationTimer: 0
    };
}

/**
 * Update character sprite animation
 */
export function updateCharacterSprite(
    sprite: CharacterSprite,
    color: string,
    direction: Direction,
    isMoving: boolean,
    deltaTime: number
): void {
    // Update direction if changed
    if (sprite.direction !== direction) {
        sprite.direction = direction;
        sprite.frameIndex = 0;
        sprite.animationTimer = 0;
    }

    // Update animation
    if (isMoving) {
        sprite.animationTimer += deltaTime;

        if (sprite.animationTimer >= ANIMATION_SPEED) {
            sprite.animationTimer = 0;
            sprite.frameIndex = (sprite.frameIndex + 1) % 3; // Cycle through 0, 1, 2

            // Skip frame 0 during walking (0 is standing pose)
            if (sprite.frameIndex === 0) {
                sprite.frameIndex = 1;
            }
        }
    } else {
        // Not moving - use standing frame
        sprite.frameIndex = 0;
        sprite.animationTimer = 0;
    }

    // Remove old sprite and add new one
    sprite.container.removeChildren();

    let newSprite: Graphics;
    switch (direction) {
        case 'up':
            newSprite = createUpSprite(color, sprite.frameIndex);
            break;
        case 'down':
            newSprite = createDownSprite(color, sprite.frameIndex);
            break;
        case 'left':
            newSprite = createLeftSprite(color, sprite.frameIndex);
            break;
        case 'right':
            newSprite = createRightSprite(color, sprite.frameIndex);
            break;
    }

    sprite.container.addChild(newSprite);
}

/**
 * Determine direction based on movement delta
 */
export function getDirectionFromMovement(dx: number, dy: number): Direction {
    // Prioritize vertical movement if both axes are moving
    if (Math.abs(dy) > Math.abs(dx)) {
        return dy < 0 ? 'up' : 'down';
    } else if (dx !== 0) {
        return dx < 0 ? 'left' : 'right';
    }
    // Default to down if no movement
    return 'down';
}
