/**
 * useTVCursor - Hook for managing TV cursor state and movement
 * 
 * Handles cursor position, visibility, and movement for TV D-Pad navigation.
 * Includes smooth movement with configurable speed.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Dimensions } from 'react-native';

interface UseTVCursorOptions {
    speed?: number;           // Pixels per key press (default: 20)
    acceleration?: number;    // Speed multiplier for held keys
    bounds?: { width: number; height: number };
    initialPosition?: { x: number; y: number };
}

interface UseTVCursorReturn {
    position: { x: number; y: number };
    isVisible: boolean;
    enable: () => void;
    disable: () => void;
    toggle: () => void;
    move: (direction: 'up' | 'down' | 'left' | 'right') => void;
    moveTo: (x: number, y: number) => void;
    reset: () => void;
    getScrollOffset: () => { x: number; y: number };
}

const DEFAULT_SPEED = 20;
const SCROLL_THRESHOLD = 0.15; // 15% from edge triggers scroll
const SCROLL_AMOUNT = 100;

export function useTVCursor(options: UseTVCursorOptions = {}): UseTVCursorReturn {
    const {
        speed = DEFAULT_SPEED,
        bounds,
        initialPosition
    } = options;

    // Get screen dimensions as default bounds
    const screenDimensions = Dimensions.get('window');
    const actualBounds = bounds || {
        width: screenDimensions.width,
        height: screenDimensions.height
    };

    // Initial position defaults to center of screen
    const defaultPosition = initialPosition || {
        x: actualBounds.width / 2,
        y: actualBounds.height / 2
    };

    const [position, setPosition] = useState(defaultPosition);
    const [isVisible, setIsVisible] = useState(false);
    const scrollOffsetRef = useRef({ x: 0, y: 0 });

    // Update bounds when screen dimensions change
    useEffect(() => {
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            if (!bounds) {
                // Re-center cursor if using screen bounds
                setPosition({
                    x: Math.min(position.x, window.width),
                    y: Math.min(position.y, window.height)
                });
            }
        });
        return () => subscription?.remove();
    }, [bounds, position]);

    const enable = useCallback(() => {
        setIsVisible(true);
    }, []);

    const disable = useCallback(() => {
        setIsVisible(false);
    }, []);

    const toggle = useCallback(() => {
        setIsVisible(prev => !prev);
    }, []);

    const move = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
        setPosition(prev => {
            let newX = prev.x;
            let newY = prev.y;

            switch (direction) {
                case 'up':
                    newY = Math.max(0, prev.y - speed);
                    break;
                case 'down':
                    newY = Math.min(actualBounds.height, prev.y + speed);
                    break;
                case 'left':
                    newX = Math.max(0, prev.x - speed);
                    break;
                case 'right':
                    newX = Math.min(actualBounds.width, prev.x + speed);
                    break;
            }

            // Check if we need to scroll the page
            const threshold = actualBounds.height * SCROLL_THRESHOLD;

            if (direction === 'down' && newY > actualBounds.height - threshold) {
                scrollOffsetRef.current.y += SCROLL_AMOUNT;
            } else if (direction === 'up' && newY < threshold) {
                scrollOffsetRef.current.y = Math.max(0, scrollOffsetRef.current.y - SCROLL_AMOUNT);
            }

            return { x: newX, y: newY };
        });
    }, [speed, actualBounds]);

    const moveTo = useCallback((x: number, y: number) => {
        setPosition({
            x: Math.max(0, Math.min(actualBounds.width, x)),
            y: Math.max(0, Math.min(actualBounds.height, y))
        });
    }, [actualBounds]);

    const reset = useCallback(() => {
        setPosition(defaultPosition);
        scrollOffsetRef.current = { x: 0, y: 0 };
    }, [defaultPosition]);

    const getScrollOffset = useCallback(() => {
        return { ...scrollOffsetRef.current };
    }, []);

    return {
        position,
        isVisible,
        enable,
        disable,
        toggle,
        move,
        moveTo,
        reset,
        getScrollOffset
    };
}

export default useTVCursor;