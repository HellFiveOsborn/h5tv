import React, { useState, useEffect, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { syncTimeWithServer, getAdjustedTime, getTimeOffset } from '../services/timeService';
import { SearchInput } from './SearchInput';
import { TVFocusable } from './TVFocusable';
import { Colors } from '../constants/Colors';


interface TopBarProps {
    onSearch?: (text: string) => void;
    searchValue?: string;
    onBack?: () => void;
    isSearching?: boolean;
    onClearSearch?: () => void;
    showSearch?: boolean;
    onSearchPress?: () => void;
    onBrowserPress?: () => void;
    showBrowserIcon?: boolean;
}

export const TopBar = memo(({
    onSearch,
    searchValue = '',
    onBack,
    isSearching = false,
    onClearSearch,
    showSearch = true,
    onSearchPress,
    onBrowserPress,
    showBrowserIcon = true
}: TopBarProps) => {
    const [currentTime, setCurrentTime] = useState(getAdjustedTime());

    useEffect(() => {
        // Sync time on mount (may already be synced from _layout.tsx)
        const initTime = async () => {
            await syncTimeWithServer();
            setCurrentTime(getAdjustedTime());
        };
        initTime();

        // Local ticker for smooth seconds updates using centralized adjusted time
        const timer = setInterval(() => {
            setCurrentTime(getAdjustedTime());
        }, 1000);

        return () => {
            clearInterval(timer);
        };
    }, []);

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
                            <Ionicons name="arrow-back" size={28} color={isFocused ? Colors.primaryDark : Colors.text} />
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
                                    <Ionicons name="search" size={20} color={isFocused ? Colors.primaryDark : Colors.textMuted} style={styles.searchIcon} />
                                    <Text style={[styles.searchPlaceholder, isFocused && styles.searchPlaceholderFocused]}>Buscar canal ou partida...</Text>
                                    <Ionicons name="mic" size={20} color={Colors.primaryDark} />
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
                {showBrowserIcon && onBrowserPress && (
                    <TVFocusable
                        onPress={onBrowserPress}
                        style={styles.browserButton}
                        focusedStyle={styles.browserButtonFocused}
                    >
                        {({ isFocused }) => (
                            <Ionicons
                                name="globe-outline"
                                size={24}
                                color={isFocused ? Colors.primaryDark : Colors.text}
                            />
                        )}
                    </TVFocusable>
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
        borderColor: Colors.primaryDark,
        backgroundColor: Colors.successLight,
    },
    searchTrigger: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.focusBackground,
        borderRadius: 30,
        paddingHorizontal: 15,
        height: 50,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    searchTriggerFocused: {
        borderColor: Colors.primaryDark,
        backgroundColor: Colors.successLight,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchPlaceholder: {
        flex: 1,
        color: Colors.textDark,
        fontSize: 16,
    },
    searchPlaceholderFocused: {
        color: Colors.textMuted,
    },
    browserButton: {
        marginLeft: 12,
        padding: 10,
        borderRadius: 25,
        borderWidth: 2,
        borderColor: 'transparent',
        backgroundColor: Colors.focusBackground,
    },
    browserButtonFocused: {
        borderColor: Colors.primaryDark,
        backgroundColor: Colors.successLight,
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
