/**
 * Service to handle time synchronization with external servers.
 * Provides functions to get the time offset between local device and server.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from '../constants/StorageKeys';

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache for time offset (avoid spamming APIs)

export const syncTimeWithServer = async (): Promise<number> => {
    const now = Date.now();

    try {
        const cachedOffset = await AsyncStorage.getItem(StorageKeys.CACHE_TIME_OFFSET);
        if (cachedOffset) {
            const { offset, timestamp } = JSON.parse(cachedOffset);
            if (now - timestamp < CACHE_DURATION) {
                console.log("Using cached time offset");
                return offset;
            }
        }
    } catch (e) {
        console.warn("Error reading time cache", e);
    }

    const saveOffset = async (offset: number) => {
        try {
            await AsyncStorage.setItem(StorageKeys.CACHE_TIME_OFFSET, JSON.stringify({ offset, timestamp: Date.now() }));
        } catch (e) {
            console.warn("Error saving time cache", e);
        }
    };

    try {
        // Try AiSense API first
        const response = await fetch('https://aisenseapi.com/services/v1/datetime/-0300');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const serverTime = new Date(data.datetime).getTime();
        const localTime = Date.now();
        const offset = serverTime - localTime;
        saveOffset(offset);
        return offset;
    } catch (error) {
        console.warn("Failed to sync time with AiSense API, trying fallback:", error);

        // Fallback to worldtimeapi
        try {
            const response = await fetch('http://worldtimeapi.org/api/timezone/America/Sao_Paulo');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const text = await response.text();
            try {
                const data = JSON.parse(text);
                const serverTime = new Date(data.datetime).getTime();
                const localTime = Date.now();
                const offset = serverTime - localTime;
                saveOffset(offset);
                return offset;
            } catch (e) {
                console.warn("Time sync fallback API returned non-JSON:", text.substring(0, 50));
                // Use local time (offset 0)
                return 0;
            }
        } catch (fallbackError) {
            console.warn("Failed to sync time with fallback API:", fallbackError);
            // Use local time (offset 0)
            return 0;
        }
    }
};