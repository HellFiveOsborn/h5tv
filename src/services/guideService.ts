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
                guideCache[meuGuiaTvUrl] = { data, timestamp }; // Update memory
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
            guideCache[meuGuiaTvUrl] = {
                data: null,
                timestamp: now
            };
            return null;
        }

        // Check if we have the expected JSON structure
        if (!data.programacao || !Array.isArray(data.programacao)) {
            console.warn('Invalid EPG JSON structure - missing programacao array');
            guideCache[meuGuiaTvUrl] = {
                data: null,
                timestamp: now
            };
            return null;
        }

        // Find the current program index
        let currentIndex = -1;

        // First, try to find a program with ao_vivo = true
        currentIndex = data.programacao.findIndex((prog: any) => prog.ao_vivo === true);

        // If no live program found, try to match by current time
        if (currentIndex === -1 && data.programacao.length > 0) {
            const currentTime = new Date();
            // Use local date for comparison as API returns local times without date
            const currentHour = currentTime.getHours();
            const currentMinute = currentTime.getMinutes();
            const currentTimeInMinutes = currentHour * 60 + currentMinute;

            // Find the program that matches or is closest to current time
            for (let i = 0; i < data.programacao.length; i++) {
                const prog = data.programacao[i];
                if (prog.hora) {
                    const [hour, minute] = prog.hora.split(':').map(Number);
                    const progTimeInMinutes = hour * 60 + minute;

                    // Check if this program is currently airing
                    if (progTimeInMinutes <= currentTimeInMinutes) {
                        const nextProg = data.programacao[i + 1];
                        if (!nextProg) {
                            // This is the last program, assume it's current
                            currentIndex = i;
                            break;
                        } else if (nextProg.hora) {
                            const [nextHour, nextMinute] = nextProg.hora.split(':').map(Number);
                            let nextProgTimeInMinutes = nextHour * 60 + nextMinute;

                            // Handle midnight crossover if needed (though simplistic here)
                            if (nextProgTimeInMinutes < progTimeInMinutes) {
                                nextProgTimeInMinutes += 24 * 60;
                            }

                            if (nextProgTimeInMinutes > currentTimeInMinutes) {
                                currentIndex = i;
                                break;
                            }
                        }
                    }
                }
            }
        }

        // If still no program found, use the first one as fallback
        if (currentIndex === -1 && data.programacao.length > 0) {
            currentIndex = 0;
        }

        if (currentIndex === -1) {
            console.warn('No current program found in EPG data');
            guideCache[meuGuiaTvUrl] = {
                data: null,
                timestamp: now
            };
            return null;
        }

        const currentProgram = data.programacao[currentIndex];
        const nextProgram = data.programacao[currentIndex + 1];

        // Parse start and end times
        const nowTime = new Date();

        // Helper to create Date object from "HH:mm"
        const createDateFromTime = (timeStr: string) => {
            if (!timeStr) return undefined;
            const [hours, minutes] = timeStr.split(':').map(Number);
            const date = new Date(nowTime);
            date.setHours(hours, minutes, 0, 0);
            return date;
        };

        const startTime = createDateFromTime(currentProgram.hora);
        let endTime = nextProgram ? createDateFromTime(nextProgram.hora) : undefined;

        // Handle day rollover for endTime if it's earlier than startTime
        if (startTime && endTime && endTime < startTime) {
            endTime.setDate(endTime.getDate() + 1);
        }

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
        const cacheEntry = {
            data: programInfo,
            timestamp: now
        };
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

        // Cache null result to avoid repeated failed requests
        guideCache[meuGuiaTvUrl] = {
            data: null,
            timestamp: now
        };

        return null;
    }
};
