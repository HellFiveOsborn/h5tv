import React, { useState, useEffect, memo } from 'react';
import { View, StyleSheet } from 'react-native';

interface ProgramProgressBarProps {
    startTime?: Date | string;
    endTime?: Date | string;
    color?: string;
    backgroundColor?: string;
    height?: number;
}

/**
 * Helper to parse date - handles both Date objects and ISO strings
 */
const parseDate = (date: Date | string | undefined): Date | null => {
    if (!date) return null;
    if (date instanceof Date) return date;
    if (typeof date === 'string') {
        const parsed = new Date(date);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
};

/**
 * Progress bar that shows the current progress of a TV program
 * Updates every minute to reflect current time
 * Shows a placeholder bar when times are not available
 */
export const ProgramProgressBar = memo(({
    startTime,
    endTime,
    color = '#1ed760',
    backgroundColor = 'rgba(255,255,255,0.2)',
    height = 4,
}: ProgramProgressBarProps) => {
    const [progress, setProgress] = useState(0);
    const [hasValidTimes, setHasValidTimes] = useState(false);

    useEffect(() => {
        const calculateProgress = () => {
            const start = parseDate(startTime);
            const end = parseDate(endTime);

            if (!start || !end) {
                setHasValidTimes(false);
                setProgress(0);
                return;
            }

            setHasValidTimes(true);
            const now = new Date();
            const startMs = start.getTime();
            const endMs = end.getTime();
            const currentMs = now.getTime();

            if (currentMs <= startMs) {
                setProgress(0);
                return;
            }

            if (currentMs >= endMs) {
                setProgress(100);
                return;
            }

            const totalDuration = endMs - startMs;
            const elapsed = currentMs - startMs;
            const percentage = (elapsed / totalDuration) * 100;
            setProgress(Math.min(100, Math.max(0, percentage)));
        };

        // Calculate immediately
        calculateProgress();

        // Update every 30 seconds for more accurate progress
        const interval = setInterval(calculateProgress, 30000);

        return () => clearInterval(interval);
    }, [startTime, endTime]);

    // Always show the bar, but with 0% progress if no valid times
    return (
        <View style={[styles.container, { height, backgroundColor }]}>
            <View
                style={[
                    styles.progress,
                    {
                        width: `${progress}%`,
                        backgroundColor: color,
                        height,
                    },
                ]}
            />
        </View>
    );
});

ProgramProgressBar.displayName = 'ProgramProgressBar';

const styles = StyleSheet.create({
    container: {
        width: '100%',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progress: {
        borderRadius: 2,
    },
});