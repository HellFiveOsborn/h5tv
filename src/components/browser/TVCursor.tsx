/**
 * TVCursor - Virtual cursor component for TV D-Pad navigation
 *
 * Renders a simple round ball cursor that can be moved with D-Pad.
 * Used in browser mode to navigate and click on web elements.
 */

import React, { memo, useEffect, useRef } from 'react';
import { StyleSheet, Animated } from 'react-native';

interface TVCursorProps {
    visible: boolean;
    position: { x: number; y: number };
    isClicking?: boolean;
}

export const TVCursor = memo(({
    visible,
    position,
    isClicking = false
}: TVCursorProps) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    // Fade in/out animation
    useEffect(() => {
        Animated.timing(opacityAnim, {
            toValue: visible ? 1 : 0,
            duration: 200,
            useNativeDriver: true
        }).start();
    }, [visible, opacityAnim]);

    // Click animation
    useEffect(() => {
        if (isClicking) {
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 0.7,
                    duration: 50,
                    useNativeDriver: true
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true
                })
            ]).start();
        }
    }, [isClicking, scaleAnim]);

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                styles.cursor,
                {
                    transform: [
                        { translateX: position.x - 12 }, // Center the cursor (24px / 2)
                        { translateY: position.y - 12 },
                        { scale: scaleAnim }
                    ],
                    opacity: opacityAnim
                }
            ]}
            pointerEvents="none"
        />
    );
});

TVCursor.displayName = 'TVCursor';

const styles = StyleSheet.create({
    cursor: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(34, 197, 94, 0.8)', // Green with transparency
        borderWidth: 2,
        borderColor: 'white',
        // Shadow/glow effect
        shadowColor: '#22C55E',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
        elevation: 5,
        zIndex: 999999,
    },
});

export default TVCursor;