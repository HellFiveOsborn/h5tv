import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from '../constants/StorageKeys';

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
        const json = await response.json();

        // Transform the object-based structure to arrays if necessary, 
        // but based on the user prompt, it seems the JSON might be structured as arrays or objects.
        // The prompt says:
        // categories[1]{id,name}: futebol,Futebol
        // channels[1]: [0]{...}
        // Let's assume the JSON matches the interfaces directly or adapt if needed.
        // If the API returns exactly what's in the prompt description, it should map directly.

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
        console.error("Error fetching channels:", error);
        throw error;
    }
};
