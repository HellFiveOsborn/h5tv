import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from '../constants/StorageKeys';

// Import local channels as fallback
import localChannels from '../../channels.json';

const API_URL = "https://gist.githubusercontent.com/HellFiveOsborn/e792ae1b5b0085418318828ddc282d43/raw/h5tv.channels.json";

export interface Channel {
    id: string;
    name: string;
    logo: string;
    category: string;
    country: string;
    guide: string;
    meuGuiaTv?: string; // New field for meuguia.tv URL
    url: string[];
}

export interface Category {
    id: string;
    name: string;
}

export interface ChannelData {
    categories: Category[];
    channels: Channel[];
}

let cache: { data: ChannelData; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const fetchChannels = async (): Promise<ChannelData> => {
    const now = Date.now();

    if (cache && (now - cache.timestamp < CACHE_DURATION)) {
        console.log("Using memory cached channels data");
        return cache.data;
    }

    // Storage Cache Check
    try {
        const cachedTimestamp = await AsyncStorage.getItem(StorageKeys.CACHE_CHANNELS_TIMESTAMP);
        if (cachedTimestamp) {
            const ts = parseInt(cachedTimestamp, 10);
            if (now - ts < CACHE_DURATION) {
                const cachedData = await AsyncStorage.getItem(StorageKeys.CACHE_CHANNELS_DATA);
                if (cachedData) {
                    console.log("Using storage cached channels data");
                    const data = JSON.parse(cachedData);
                    cache = { data, timestamp: ts }; // Update memory cache
                    return data;
                }
            }
        }
    } catch (e) {
        console.warn('Error reading channels cache', e);
    }

    try {
        console.log("Fetching channels from:", API_URL);
        const noCacheUrl = `${API_URL}?nocache=${Date.now()}`;
        const response = await fetch(noCacheUrl);

        // Check if response is OK
        if (!response.ok) {
            console.warn(`Remote fetch failed with status: ${response.status}`);
            throw new Error(`HTTP error: ${response.status}`);
        }

        // Get response as text first for better error handling
        const responseText = await response.text();

        // Try to parse JSON
        let json;
        try {
            json = JSON.parse(responseText);
        } catch (parseError) {
            console.error("JSON parse error. Response was:", responseText.substring(0, 200));
            throw new Error('Invalid JSON response from server');
        }

        const data: ChannelData = {
            categories: json.categories || [],
            channels: json.channels || []
        };

        cache = {
            data: data,
            timestamp: now
        };

        // Persist cache
        try {
            await AsyncStorage.setItem(StorageKeys.CACHE_CHANNELS_DATA, JSON.stringify(data));
            await AsyncStorage.setItem(StorageKeys.CACHE_CHANNELS_TIMESTAMP, now.toString());
        } catch (e) {
            console.warn('Error saving channels cache', e);
        }

        return data;

    } catch (error) {
        console.warn("Remote channel fetch failed, using local fallback:", error);

        // Fallback to local channels.json
        console.log("Using local channels fallback");
        const data: ChannelData = {
            categories: localChannels.categories || [],
            channels: localChannels.channels || []
        };

        // Still cache the fallback data (with shorter duration for retries)
        cache = { data, timestamp: now };

        // Try to persist fallback data too
        try {
            await AsyncStorage.setItem(StorageKeys.CACHE_CHANNELS_DATA, JSON.stringify(data));
            await AsyncStorage.setItem(StorageKeys.CACHE_CHANNELS_TIMESTAMP, now.toString());
        } catch (e) {
            console.warn('Error saving fallback channels cache', e);
        }

        return data;
    }
};
