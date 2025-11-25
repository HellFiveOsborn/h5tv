import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Channel } from '../services/channelService';

interface UseChannelSearchOptions {
    channels: Channel[];
    debounceMs?: number;
    selectedCategory?: string | null;
    initialSearchTerms?: string[]; // Array of terms to search for (e.g., channel names from game broadcasts)
}

interface UseChannelSearchResult {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    debouncedQuery: string;
    filteredChannels: Channel[];
    isSearching: boolean;
    clearSearch: () => void;
    searchTerms: string[]; // Current search terms
    setSearchTerms: (terms: string[]) => void; // Set multiple search terms
}

/**
 * Custom hook for optimized channel search with debounce
 * @param options - Configuration options
 * @returns Search state and filtered channels
 */
export const useChannelSearch = ({
    channels,
    debounceMs = 300,
    selectedCategory = null,
    initialSearchTerms = []
}: UseChannelSearchOptions): UseChannelSearchResult => {
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchTerms, setSearchTerms] = useState<string[]>(initialSearchTerms);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Update search terms when initialSearchTerms changes
    useEffect(() => {
        if (initialSearchTerms.length > 0) {
            setSearchTerms(initialSearchTerms);
        }
    }, [initialSearchTerms]);

    // Debounce the search query
    useEffect(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        if (searchQuery !== debouncedQuery) {
            setIsSearching(true);
            debounceTimerRef.current = setTimeout(() => {
                setDebouncedQuery(searchQuery);
                setIsSearching(false);
            }, debounceMs);
        }

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [searchQuery, debounceMs]);

    // Filter channels based on debounced query, search terms, and category
    // When searching, ignore category filter to search across all channels
    const filteredChannels = useMemo(() => {
        let result = channels;

        // If there are search terms (from game broadcast), filter by those
        if (searchTerms.length > 0) {
            result = result.filter(channel => {
                const channelName = channel.name.toLowerCase();
                return searchTerms.some(term => {
                    const lowerTerm = term.toLowerCase().trim();
                    // Check if channel name contains the term or vice versa
                    return channelName.includes(lowerTerm) || lowerTerm.includes(channelName);
                });
            });
        }
        // If there's a search query, ignore category and search all channels
        else if (debouncedQuery.trim()) {
            const lowerQuery = debouncedQuery.toLowerCase().trim();
            result = result.filter(channel =>
                channel.name.toLowerCase().includes(lowerQuery)
            );
        } else if (selectedCategory) {
            // Only filter by category when not searching
            result = result.filter(channel => channel.category === selectedCategory);
        }

        return result;
    }, [channels, debouncedQuery, selectedCategory, searchTerms]);

    // Clear search callback
    const clearSearch = useCallback(() => {
        setSearchQuery('');
        setDebouncedQuery('');
        setIsSearching(false);
        setSearchTerms([]);
    }, []);

    // Set search terms callback
    const handleSetSearchTerms = useCallback((terms: string[]) => {
        setSearchTerms(terms);
    }, []);

    // Memoized setSearchQuery to avoid unnecessary re-renders
    const handleSetSearchQuery = useCallback((query: string) => {
        setSearchQuery(query);
    }, []);

    return {
        searchQuery,
        setSearchQuery: handleSetSearchQuery,
        debouncedQuery,
        filteredChannels,
        isSearching,
        clearSearch,
        searchTerms,
        setSearchTerms: handleSetSearchTerms
    };
};