/**
 * Service to handle time synchronization with external servers.
 *
 * Strategy:
 * - UI should preferably show system time for display
 * - API is used to calculate offset if device time is incorrect
 * - Offset is cached to avoid excessive API calls
 * - If API fails, we assume system time is correct (offset = 0)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from '../constants/StorageKeys';

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache for time offset
const FETCH_TIMEOUT = 5000; // 5 second timeout for API calls
const DEFAULT_OFFSET_THRESHOLD = 30 * 1000; // 30 seconds - configurable threshold
const MAX_OFFSET_THRESHOLD = 5 * 60 * 1000; // 5 minutes - if offset is larger, device clock is definitely wrong

// In-memory cache for quick access
let cachedTimeOffset: number = 0;
let lastSyncAttempt: number = 0;
let syncInProgress: boolean = false;
let useAdjustedTime: boolean = false; // Flag to determine if we should use adjusted time

/**
 * Helper function to fetch with timeout
 */
const fetchWithTimeout = async (url: string, timeout: number): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
};

/**
 * Synchronizes time with server and returns the offset.
 * Returns cached offset if available and valid.
 */
export const syncTimeWithServer = async (): Promise<number> => {
    const now = Date.now();

    // Prevent multiple simultaneous sync attempts
    if (syncInProgress) {
        return cachedTimeOffset;
    }

    // Check in-memory cache first (fastest)
    if (cachedTimeOffset !== 0 && (now - lastSyncAttempt < CACHE_DURATION)) {
        return cachedTimeOffset;
    }

    // Check persistent cache
    try {
        const cachedData = await AsyncStorage.getItem(StorageKeys.CACHE_TIME_OFFSET);
        if (cachedData) {
            const { offset, timestamp } = JSON.parse(cachedData);
            if (now - timestamp < CACHE_DURATION) {
                cachedTimeOffset = offset;
                lastSyncAttempt = timestamp;
                return offset;
            }
        }
    } catch (e) {
        // Ignore cache read errors
    }

    syncInProgress = true;
    lastSyncAttempt = now;

    const saveOffset = async (offset: number) => {
        cachedTimeOffset = offset;
        try {
            await AsyncStorage.setItem(StorageKeys.CACHE_TIME_OFFSET, JSON.stringify({
                offset,
                timestamp: Date.now()
            }));
        } catch (e) {
            // Ignore cache write errors
        }
    };

    try {
        // Try AiSense API first (primary)
        const response = await fetchWithTimeout(
            'https://aisenseapi.com/services/v1/datetime/-0300',
            FETCH_TIMEOUT
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const serverTime = new Date(data.datetime).getTime();
        const localTime = Date.now();
        const offset = serverTime - localTime;

        await saveOffset(offset);

        // Determine if we should use adjusted time based on threshold
        if (Math.abs(offset) > DEFAULT_OFFSET_THRESHOLD) {
            useAdjustedTime = true;
            console.log('[TimeService] Significant time difference detected:', offset, 'ms - using adjusted time');
        } else {
            useAdjustedTime = false;
            console.log('[TimeService] Synced with AiSense API, offset:', offset, 'ms - within threshold, using device time');
        }

        return offset;
    } catch (error) {
        // Silently try fallback
        try {
            const response = await fetchWithTimeout(
                'http://worldtimeapi.org/api/timezone/America/Sao_Paulo',
                FETCH_TIMEOUT
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const serverTime = new Date(data.datetime).getTime();
            const localTime = Date.now();
            const offset = serverTime - localTime;

            await saveOffset(offset);

            // Determine if we should use adjusted time based on threshold
            if (Math.abs(offset) > DEFAULT_OFFSET_THRESHOLD) {
                useAdjustedTime = true;
                console.log('[TimeService] Significant time difference detected:', offset, 'ms - using adjusted time');
            } else {
                useAdjustedTime = false;
                console.log('[TimeService] Synced with WorldTimeAPI, offset:', offset, 'ms - within threshold, using device time');
            }

            return offset;
        } catch (fallbackError) {
            // Both APIs failed - use system time (offset = 0)
            console.log('[TimeService] API sync failed, using system time');
            useAdjustedTime = false;
            await saveOffset(0);
            return 0;
        }
    } finally {
        syncInProgress = false;
    }
};

/**
 * Gets the current corrected time (system time + offset).
 * Use this for time-sensitive calculations like EPG comparison.
 */
export const getCorrectedTime = (): Date => {
    return new Date(Date.now() + cachedTimeOffset);
};

/**
 * Gets the current system time (without offset).
 * Use this for displaying time to the user.
 */
export const getSystemTime = (): Date => {
    return new Date();
};

/**
 * Gets the adjusted time - returns corrected time if offset exceeds threshold,
 * otherwise returns device time. Use this for all time displays in the app.
 */
export const getAdjustedTime = (): Date => {
    if (useAdjustedTime) {
        return new Date(Date.now() + cachedTimeOffset);
    }
    return new Date();
};

/**
 * Gets the adjusted timestamp in milliseconds.
 */
export const getAdjustedTimestamp = (): number => {
    if (useAdjustedTime) {
        return Date.now() + cachedTimeOffset;
    }
    return Date.now();
};

/**
 * Formats time for display in pt-BR timezone.
 * Uses adjusted time when offset exceeds threshold, otherwise uses device time.
 */
export const formatDisplayTime = (date?: Date): string => {
    const displayDate = date || getAdjustedTime();
    return displayDate.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
    });
};

/**
 * Checks if the device clock appears to be significantly off.
 * Returns true if offset is greater than threshold.
 */
export const isDeviceClockOff = (): boolean => {
    return Math.abs(cachedTimeOffset) > MAX_OFFSET_THRESHOLD;
};

/**
 * Gets the cached time offset in milliseconds.
 */
export const getTimeOffset = (): number => {
    return cachedTimeOffset;
};

/**
 * Returns whether the app is currently using adjusted time.
 */
export const isUsingAdjustedTime = (): boolean => {
    return useAdjustedTime;
};

/**
 * Gets the current offset threshold in milliseconds.
 */
export const getOffsetThreshold = (): number => {
    return DEFAULT_OFFSET_THRESHOLD;
};