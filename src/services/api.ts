import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from '../constants/StorageKeys';

const API_BASE = "https://webws.365scores.com/web/games/allscores/";

interface GameData {
    id: number;
    homeTeam: { name: string; logo: string };
    awayTeam: { name: string; logo: string };
    score: string;
    status: string;
    channel: string;
    competition: string;
    startTime: string;
}

let cache: { data: GameData[]; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const fetchGames = async (): Promise<GameData[]> => {
    const now = Date.now();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const formatDate = (date: Date) => `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;

    const startDateStr = formatDate(today);
    const endDateStr = formatDate(tomorrow);

    // Simple cache check (Memory)
    if (cache && (now - cache.timestamp < CACHE_DURATION)) {
        console.log("Using memory cached games data");
        return cache.data;
    }

    // Storage Cache Check
    try {
        const cachedTimestamp = await AsyncStorage.getItem(StorageKeys.CACHE_GAMES_TIMESTAMP);
        if (cachedTimestamp) {
            const ts = parseInt(cachedTimestamp, 10);
            if (now - ts < CACHE_DURATION) {
                const cachedData = await AsyncStorage.getItem(StorageKeys.CACHE_GAMES_DATA);
                if (cachedData) {
                    console.log("Using storage cached games data");
                    const data = JSON.parse(cachedData);
                    cache = { data, timestamp: ts }; // Update memory cache
                    return data;
                }
            }
        }
    } catch (e) {
        console.warn('Error reading games cache', e);
    }

    const url = `${API_BASE}?appTypeId=5&langId=31&timezoneName=America/Sao_Paulo&userCountryId=21&startDate=${startDateStr}&endDate=${endDateStr}&withTop=true&topBookmaker=161&onlyOnTv=true`;

    try {
        console.log("Fetching games from:", url);
        const response = await fetch(url);
        const json = await response.json();

        if (!json.games) {
            return [];
        }

        const games: GameData[] = [];

        for (const game of json.games) {
            const home = game.homeCompetitor;
            const away = game.awayCompetitor;

            const homeScore = home.score >= 0 ? home.score : '';
            const awayScore = away.score >= 0 ? away.score : '';

            let scoreDisplay = 'vs';
            if (homeScore !== '' && awayScore !== '') {
                scoreDisplay = `${homeScore} - ${awayScore}`;
            } else if (game.justEnded) {
                scoreDisplay = `${homeScore} - ${awayScore}`;
            }

            const channel = game.tvNetworkName || 'Indisponível';
            const competition = game.competitionDisplayName || 'Campeonato';

            // Status text logic
            const status = game.shortStatusText || game.statusText || 'Indisponível';

            games.push({
                id: game.id,
                homeTeam: {
                    name: home.name || 'Indisponível',
                    logo: `https://imagecache.365scores.com/image/upload/f_png,w_64,h_64,c_limit,q_auto:eco,dpr_3,d_Competitors:default1.png/v11/Competitors/${home.id}`
                },
                awayTeam: {
                    name: away.name || 'Indisponível',
                    logo: `https://imagecache.365scores.com/image/upload/f_png,w_64,h_64,c_limit,q_auto:eco,dpr_3,d_Competitors:default1.png/v11/Competitors/${away.id}`
                },
                score: scoreDisplay,
                status: status,
                channel: channel,
                competition: competition,
                startTime: game.startTime
            });
        }

        // Sort games: Priority to Brazilian competitions
        games.sort((a, b) => {
            const isBrazilianA = a.competition.includes('Brasil') || a.competition.includes('Série A') || a.competition.includes('Série B');
            const isBrazilianB = b.competition.includes('Brasil') || b.competition.includes('Série A') || b.competition.includes('Série B');

            if (isBrazilianA && !isBrazilianB) return -1;
            if (!isBrazilianA && isBrazilianB) return 1;
            return 0;
        });

        cache = {
            data: games,
            timestamp: now
        };

        // Persist cache
        try {
            await AsyncStorage.setItem(StorageKeys.CACHE_GAMES_DATA, JSON.stringify(games));
            await AsyncStorage.setItem(StorageKeys.CACHE_GAMES_TIMESTAMP, now.toString());
        } catch (e) {
            console.warn('Error saving games cache', e);
        }

        return games;

    } catch (error) {
        console.error("Error fetching games:", error);
        throw error;
    }
};
