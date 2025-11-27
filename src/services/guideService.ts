export interface ProgramInfo {
    time: string;
    title: string;
    description?: string;
    startTime?: Date;
    endTime?: Date;
    next?: {
        time: string;
        title: string;
        description?: string;
    };
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from '../constants/StorageKeys';

interface GuideCache {
    [url: string]: {
        data: ProgramInfo | null;
        timestamp: number;
    };
}

const guideCache: GuideCache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Brazil timezone offset (UTC-3) in milliseconds
const BRAZIL_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Parse date from "data_cabecalho" format like "Quarta-feira, 26/11" or "Quinta-feira, 27/11"
 * Combined with time like "23:30" to create a full Date object.
 * The API always returns times in Brazil timezone (UTC-3), so we explicitly create
 * dates in Brazil time regardless of the device's local timezone.
 */
const parseDateFromApi = (dataCabecalho: string, hora: string): Date | undefined => {
    if (!dataCabecalho || !hora) return undefined;

    try {
        // Extract day/month from "Dia-da-semana, DD/MM"
        const match = dataCabecalho.match(/(\d{1,2})\/(\d{1,2})/);
        if (!match) return undefined;

        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; // JS months are 0-indexed

        // Parse time "HH:mm"
        const [hours, minutes] = hora.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) return undefined;

        // Use current year
        const now = new Date();
        const year = now.getFullYear();

        // Handle year rollover (Dec -> Jan)
        let finalYear = year;
        if (month === 0 && now.getMonth() === 11) {
            finalYear = year + 1;
        } else if (month === 11 && now.getMonth() === 0) {
            finalYear = year - 1;
        }

        // Create date in UTC, then adjust for Brazil timezone (UTC-3)
        // API times are in Brazil local time, so "00:00 Brazil" = "03:00 UTC"
        const utcTimestamp = Date.UTC(finalYear, month, day, hours, minutes, 0, 0);
        return new Date(utcTimestamp + BRAZIL_OFFSET_MS);
    } catch (e) {
        console.warn('Error parsing date from API:', e);
        return undefined;
    }
};

export const fetchCurrentProgram = async (meuGuiaTvUrl: string): Promise<ProgramInfo | null> => {
    if (!meuGuiaTvUrl) return null;

    const now = Date.now();

    // Check memory cache
    if (guideCache[meuGuiaTvUrl] && (now - guideCache[meuGuiaTvUrl].timestamp < CACHE_DURATION)) {
        console.log(`Using memory cached guide data for: ${meuGuiaTvUrl}`);
        return guideCache[meuGuiaTvUrl].data;
    }

    const storageKey = `${StorageKeys.CACHE_GUIDE_PREFIX}${encodeURIComponent(meuGuiaTvUrl)}`;

    // Check storage cache
    try {
        const cachedItem = await AsyncStorage.getItem(storageKey);
        if (cachedItem) {
            const { data, timestamp } = JSON.parse(cachedItem);
            if (now - timestamp < CACHE_DURATION) {
                console.log(`Using storage cached guide data for: ${meuGuiaTvUrl}`);
                guideCache[meuGuiaTvUrl] = { data, timestamp };
                return data;
            }
        }
    } catch (e) {
        console.warn('Error reading guide cache', e);
    }

    try {
        // Use the proxy API to fetch the guide
        const proxyUrl = `https://guiacanais.alwaysdata.net/?url=${encodeURIComponent(meuGuiaTvUrl)}`;
        console.log(`Fetching guide from: ${proxyUrl}`);

        const response = await fetch(proxyUrl);
        const text = await response.text();

        // Try to parse as JSON first
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('Failed to parse EPG response as JSON:', e);
            guideCache[meuGuiaTvUrl] = { data: null, timestamp: now };
            return null;
        }

        // Check if we have the expected JSON structure
        if (!data.programacao || !Array.isArray(data.programacao)) {
            console.warn('Invalid EPG JSON structure - missing programacao array');
            guideCache[meuGuiaTvUrl] = { data: null, timestamp: now };
            return null;
        }

        // Find the current program - use ao_vivo flag from API
        let currentIndex = data.programacao.findIndex((prog: any) => prog.ao_vivo === true);

        // If no live program found, fallback to first program
        if (currentIndex === -1 && data.programacao.length > 0) {
            currentIndex = 0;
        }

        if (currentIndex === -1) {
            console.warn('No current program found in EPG data');
            guideCache[meuGuiaTvUrl] = { data: null, timestamp: now };
            return null;
        }

        const currentProgram = data.programacao[currentIndex];
        const nextProgram = data.programacao[currentIndex + 1];

        // Parse dates using data_cabecalho from API
        const startTime = parseDateFromApi(currentProgram.data_cabecalho, currentProgram.hora);
        let endTime = nextProgram
            ? parseDateFromApi(nextProgram.data_cabecalho, nextProgram.hora)
            : undefined;

        // Fallback for endTime: default to 1 hour duration if not known
        if (startTime && !endTime) {
            endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
        }

        const programInfo: ProgramInfo = {
            time: currentProgram.hora || 'N/A',
            title: currentProgram.titulo || 'Programação Atual',
            description: currentProgram.descricao,
            startTime,
            endTime,
            next: nextProgram ? {
                time: nextProgram.hora,
                title: nextProgram.titulo,
                description: nextProgram.descricao
            } : undefined
        };

        // Cache the result
        const cacheEntry = { data: programInfo, timestamp: now };
        guideCache[meuGuiaTvUrl] = cacheEntry;

        // Persist cache
        try {
            await AsyncStorage.setItem(storageKey, JSON.stringify(cacheEntry));
        } catch (e) {
            console.warn('Error saving guide cache', e);
        }

        console.log('Parsed EPG program info:', programInfo);
        return programInfo;

    } catch (error) {
        console.error("Error fetching program guide:", error);
        guideCache[meuGuiaTvUrl] = { data: null, timestamp: now };
        return null;
    }
};
