import React, { useState, useEffect, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { syncTimeWithServer } from '../services/timeService';
import { SearchInput } from './SearchInput';
import { TVFocusable } from './TVFocusable';


interface TopBarProps {
    onSearch?: (text: string) => void;
    searchValue?: string;
    onBack?: () => void;
    isSearching?: boolean;
    onClearSearch?: () => void;
    showSearch?: boolean;
    onSearchPress?: () => void;
}

export const TopBar = memo(({
    onSearch,
    searchValue = '',
    onBack,
    isSearching = false,
    onClearSearch,
    showSearch = true,
    onSearchPress
}: TopBarProps) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [timeOffset, setTimeOffset] = useState(0);

    useEffect(() => {
        // Call sync time only once on component mount
        syncTime();

        // Local ticker for smooth seconds updates
        const timer = setInterval(() => {
            setCurrentTime(new Date(Date.now() + timeOffset));
        }, 1000);

        return () => {
            clearInterval(timer);
        };
    }, []); // Empty dependency array means this runs only once on mount

    useEffect(() => {
        // Update interval when timeOffset changes
        const timer = setInterval(() => {
            setCurrentTime(new Date(Date.now() + timeOffset));
        }, 1000);

        return () => {
            clearInterval(timer);
        };
    }, [timeOffset]);

    const syncTime = async () => {
        const offset = await syncTimeWithServer();
        setTimeOffset(offset);
        setCurrentTime(new Date(Date.now() + offset));
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo'
        });
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'America/Sao_Paulo'
        });
    };

    return (
        <View style={styles.container}>
            {/* Search Bar & Back Button */}
            <View style={styles.leftContainer}>
                {onBack && (
                    <TVFocusable
                        onPress={onBack}
                        style={styles.backButton}
                        focusedStyle={styles.backButtonFocused}
                    >
                        {({ isFocused }) => (
                            <Ionicons name="arrow-back" size={28} color={isFocused ? '#00ff88' : '#fff'} />
                        )}
                    </TVFocusable>
                )}
                {showSearch && (
                    onSearchPress ? (
                        <TVFocusable
                            onPress={onSearchPress}
                            style={styles.searchTrigger}
                            focusedStyle={styles.searchTriggerFocused}
                        >
                            {({ isFocused }) => (
                                <>
                                    <Ionicons name="search" size={20} color={isFocused ? '#00ff88' : '#888'} style={styles.searchIcon} />
                                    <Text style={[styles.searchPlaceholder, isFocused && styles.searchPlaceholderFocused]}>Buscar canal ou partida...</Text>
                                    <Ionicons name="mic" size={20} color="#00ff88" />
                                </>
                            )}
                        </TVFocusable>
                    ) : (
                        <SearchInput
                            value={searchValue}
                            onChangeText={onSearch || (() => { })}
                            isSearching={isSearching}
                            onClear={onClearSearch}
                            placeholder="Buscar canal ou partida..."
                        />
                    )
                )}
            </View>

            {/* Clock */}
            <View style={styles.clockContainer}>
                <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                <Text style={styles.dateText}>{formatDate(currentTime)}</Text>
            </View>
        </View>
    );
});

TopBar.displayName = 'TopBar';

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingVertical: 20,
        width: '100%',
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '50%',
    },
    backButton: {
        marginRight: 20,
        padding: 10,
        borderRadius: 25,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    backButtonFocused: {
        borderColor: '#00ff88',
        backgroundColor: 'rgba(0, 255, 136, 0.1)',
    },
    searchTrigger: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 30,
        paddingHorizontal: 15,
        height: 50,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    searchTriggerFocused: {
        borderColor: '#00ff88',
        backgroundColor: 'rgba(0, 255, 136, 0.1)',
    },
    searchIcon: {
        marginRight: 10,
    },
    searchPlaceholder: {
        flex: 1,
        color: '#666',
        fontSize: 16,
    },
    searchPlaceholderFocused: {
        color: '#888',
    },
    clockContainer: {
        alignItems: 'flex-end',
    },
    timeText: {
        color: '#fff',
        fontSize: 32,
        fontWeight: '300',
    },
    dateText: {
        color: '#aaa',
        fontSize: 12,
        textTransform: 'capitalize',
    },
});
