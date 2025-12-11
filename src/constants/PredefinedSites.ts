/**
 * PredefinedSites - Configuration for predefined streaming sites
 * 
 * These sites are shown in the browser's site suggestions grid
 * for quick access to popular streaming services.
 */

export interface PredefinedSite {
    id: string;
    name: string;
    url: string;
    icon: string;           // Ionicons name
    color: string;          // Background color for card
    description?: string;
}

export const PREDEFINED_SITES: readonly PredefinedSite[] = [
    {
        id: 'youtube',
        name: 'YouTube',
        url: 'https://youtube.com',
        icon: 'logo-youtube',
        color: '#FF0000',
        description: 'Videos e Live Streams'
    },
    {
        id: 'globoplay',
        name: 'Globoplay',
        url: 'https://globoplay.globo.com',
        icon: 'play-circle',
        color: '#FF5F00',
        description: 'Conteudos Globoplay'
    },
    {
        id: 'redecanais',
        name: 'Rede Canais',
        url: 'https://redecanais.do',
        icon: 'tv',
        color: '#4CAF50',
        description: 'Canais de TV'
    },
    {
        id: 'vizer',
        name: 'Vizer',
        url: 'https://vizer.hair',
        icon: 'film',
        color: '#9C27B0',
        description: 'Filmes e Séries'
    },
    {
        id: 'embedinweb',
        name: 'Embed.in',
        url: 'https://embed-in.web.app',
        icon: 'videocam',
        color: '#2196F3',
        description: 'Filmes e Séries'
    },
    {
        id: 'okru',
        name: 'OK.ru',
        url: 'https://ok.ru',
        icon: 'play',
        color: '#EE8208',
        description: 'Streams'
    },
    {
        id: 'topflix',
        name: 'TopFlix Casa',
        url: 'https://top-flix.click/casa/',
        icon: 'home',
        color: '#E91E63',
        description: 'Filmes e Séries'
    },
    {
        id: 'topflixhd',
        name: 'TopFlix HD',
        url: 'https://topflixhd.club',
        icon: 'sparkles',
        color: '#00BCD4',
        description: 'Filmes e Séries'
    }
] as const;