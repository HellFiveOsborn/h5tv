import React, { useEffect, useState, useRef, useCallback, memo } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, FlatList, Animated, Platform, DeviceEventEmitter } from 'react-native';
import { Colors } from '../constants/Colors';
import { fetchGames } from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusArea } from '../constants/FocusContext';
import { TVFocusable } from './TVFocusable';

// Import local assets
const banner1 = require('../../assets/banner1.webp');
const banner2 = require('../../assets/banner2.webp');
const banner3 = require('../../assets/banner3.webp');
const banner4 = require('../../assets/banner4.webp');

const BANNERS = [banner1, banner2, banner3, banner4];

const { width } = Dimensions.get('window');
// Adjust width for Sidebar (100px) and padding
const CONTENT_WIDTH = width - 100;
const CARD_WIDTH = CONTENT_WIDTH * 0.6; // Card takes 60% of content width
const SPACING = 20;
const SNAP_INTERVAL = CARD_WIDTH + SPACING;

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

const BlinkingDot = memo(() => {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    return <Animated.View style={[styles.blinkingDot, { opacity }]} />;
});

// Format game status helper
const formatGameStatus = (startTime: string, status: string, isLive: boolean) => {
    if (isLive) return "AO VIVO";

    const date = new Date(startTime);
    const now = new Date();
    const isToday = date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

    if (isToday) {
        return `Hoje, ${timeStr}`;
    } else {
        const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        return `${dateStr}, ${timeStr}`;
    }
};

// Memoized Game Card component
interface GameCardProps {
    item: GameData;
    index: number;
    isFocused: boolean;
    onFocus: (index: number) => void;
    onBlur: () => void;
    onPress: () => void;
}

const GameCard = memo(({ item, index, isFocused: externalFocused, onFocus, onBlur, onPress, nextFocusDown, nextFocusLeft }: GameCardProps & { nextFocusDown?: number; nextFocusLeft?: number }) => {
    const isLive = item.status.toLowerCase().includes('vivo') || item.status.toLowerCase().includes('int');
    const bannerSource = BANNERS[index % BANNERS.length];
    const statusText = formatGameStatus(item.startTime, item.status, isLive);

    return (
        <TVFocusable
            onFocus={() => onFocus(index)}
            onBlur={onBlur}
            onPress={onPress}
            style={styles.cardContainer}
            focusedStyle={styles.activeCardGlow}
            nextFocusDown={nextFocusDown}
            nextFocusLeft={nextFocusLeft}
        >
            {({ isFocused: internalFocused }) => {
                const isFocused = externalFocused !== undefined ? externalFocused : internalFocused;

                return (
                    <>
                        <Image
                            source={bannerSource}
                            style={styles.backgroundImage}
                            resizeMode="cover"
                        />
                        <LinearGradient
                            colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']}
                            style={styles.cardGradient}
                        >
                            {/* Header: Status Badge (Top Left) */}
                            <View style={styles.headerRow}>
                                <View style={[styles.statusBadge, isLive ? styles.liveBadge : styles.scheduledBadge]}>
                                    {isLive && <BlinkingDot />}
                                    <Text style={styles.statusText}>
                                        {statusText}
                                    </Text>
                                </View>
                            </View>

                            {/* Main Content: Logos & Score (Center) */}
                            <View style={styles.mainContent}>
                                {/* Home Team Logo */}
                                <Image source={{ uri: item.homeTeam.logo }} style={styles.logo} resizeMode="contain" />

                                {/* Score & Time */}
                                <View style={styles.scoreContainer}>
                                    <Text style={styles.scoreText}>{item.score}</Text>
                                    {isLive && <Text style={styles.gameTimeText}>68'</Text>}
                                </View>

                                {/* Away Team Logo */}
                                <Image source={{ uri: item.awayTeam.logo }} style={styles.logo} resizeMode="contain" />
                            </View>

                            {/* Footer: Team Names & Info (Bottom Center) */}
                            <View style={styles.footerContent}>
                                <Text style={styles.versusText}>
                                    {item.homeTeam.name} <Text style={{ color: '#aaa' }}>x</Text> {item.awayTeam.name}
                                </Text>
                                <View style={styles.footerInfoRow}>
                                    <Text style={styles.channelText}>{item.channel}</Text>
                                    <Text style={styles.footerStatusText}> • {item.competition}</Text>
                                </View>
                            </View>
                        </LinearGradient>
                    </>
                );
            }}
        </TVFocusable>
    );
});

interface GameSliderProps {
    onGamePress?: (channels: string[], gameTitle: string) => void;
    nextFocusDown?: number;
    nextFocusLeft?: number;
    sidebarRef?: React.RefObject<any>;
}

export const GameSlider = ({ onGamePress, nextFocusDown, nextFocusLeft, sidebarRef }: GameSliderProps) => {
    // Log nextFocusLeft changes
    useEffect(() => {
        console.log('[GameSlider] nextFocusLeft prop changed:', nextFocusLeft);
    }, [nextFocusLeft]);

    const [games, setGames] = useState<GameData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isNavigatingByFocusRef = useRef(false); // Track if navigation is via focus (D-pad)
    const AUTO_PLAY_DELAY = 5000; // 5 seconds between auto-advances

    const { isAutoPlayAllowed, setFocusArea, currentFocusArea } = useFocusArea();
    const isSliderFocusedRef = useRef(false);
    const currentFocusAreaRef = useRef(currentFocusArea);
    const focusedIndexRef = useRef(focusedIndex);

    // Keep focusedIndexRef in sync
    useEffect(() => {
        focusedIndexRef.current = focusedIndex;
    }, [focusedIndex]);

    // Keep ref in sync with current focus area
    useEffect(() => {
        currentFocusAreaRef.current = currentFocusArea;
    }, [currentFocusArea]);

    // TV Key Event Handler for navigation - REMOVED
    // We are now relying on native nextFocusLeft prop which is more robust
    // The previous implementation was conflicting with native focus behavior

    useEffect(() => {
        loadGames();
        return () => {
            if (autoPlayRef.current) {
                clearInterval(autoPlayRef.current);
            }
            if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
            }
        };
    }, []);

    // Auto-play effect - starts/stops based on global focus area
    useEffect(() => {
        console.log('[GameSlider] AutoPlay effect - isAutoPlayAllowed:', isAutoPlayAllowed, 'games:', games.length, 'currentFocusArea:', currentFocusArea);
        if (games.length > 0 && isAutoPlayAllowed) {
            // Start auto-play when focus is on sidebar, search, or none
            if (!autoPlayRef.current) {
                console.log('[GameSlider] Starting autoplay');
                autoPlayRef.current = setInterval(() => {
                    setFocusedIndex((prev) => (prev + 1) % games.length);
                }, AUTO_PLAY_DELAY);
            }
        } else {
            // Stop auto-play when focus is on slider or other content
            if (autoPlayRef.current) {
                console.log('[GameSlider] Stopping autoplay');
                clearInterval(autoPlayRef.current);
                autoPlayRef.current = null;
            }
        }

        return () => {
            if (autoPlayRef.current) {
                clearInterval(autoPlayRef.current);
                autoPlayRef.current = null;
            }
        };
    }, [games.length, isAutoPlayAllowed, currentFocusArea]);

    // Scroll to focused index when it changes
    useEffect(() => {
        if (games.length > 0 && flatListRef.current) {
            flatListRef.current.scrollToOffset({
                offset: focusedIndex * SNAP_INTERVAL,
                animated: true
            });
        }
    }, [focusedIndex, games.length]);

    const handleCardFocus = useCallback((index: number) => {
        console.log('[GameSlider] Card focused:', index);

        // Cancel any pending blur timeout (focus moved to another card)
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }

        // Mark that we're navigating via focus (D-pad), not swipe
        isNavigatingByFocusRef.current = true;
        isSliderFocusedRef.current = true;

        // Always set focus area to slider when a card receives focus
        setFocusArea('slider');
        setFocusedIndex(index);
    }, [setFocusArea]);

    const handleCardBlur = useCallback(() => {
        console.log('[GameSlider] Card blur, will check in 300ms');

        // Set a timeout to check if focus left the slider entirely
        blurTimeoutRef.current = setTimeout(() => {
            console.log('[GameSlider] Blur timeout check, isSliderFocused:', isSliderFocusedRef.current);
            // Only set to 'none' if no slider card currently has focus
            // AND if the current focus area is still 'slider' (sidebar/search hasn't claimed it)
            if (!isSliderFocusedRef.current && currentFocusAreaRef.current === 'slider') {
                console.log('[GameSlider] Focus left slider, setting to none');
                setFocusArea('none');
            }
        }, 300); // 300ms delay - enough time for next focus event to fire

        // Mark slider as not focused
        // If focus moves to another card, handleCardFocus will set this back to true before timeout fires
        isSliderFocusedRef.current = false;
    }, [setFocusArea]);

    const handleCardPress = useCallback((item: GameData) => {
        if (onGamePress && item.channel) {
            // Parse channel names - split by '/' to handle multiple channels
            const channelNames = item.channel.split('/').map(name => name.trim()).filter(name => name.length > 0);
            const gameTitle = `${item.homeTeam.name} x ${item.awayTeam.name}`;
            onGamePress(channelNames, gameTitle);
        }
    }, [onGamePress]);

    const loadGames = async () => {
        try {
            setLoading(true);
            const data = await fetchGames();
            setGames(data);
            setError(false);
        } catch (err) {
            console.error(err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = useCallback(({ item, index }: { item: GameData; index: number }) => {
        // Only pass nextFocusLeft to the first item
        const shouldNavigateToSidebar = index === 0;
        if (shouldNavigateToSidebar && nextFocusLeft) {
            console.log('[GameSlider] First card rendering with nextFocusLeft:', nextFocusLeft);
        }

        // Use a key that includes navigation props to force remount when they change
        const cardKey = `game-${item.id}-nav-${shouldNavigateToSidebar ? nextFocusLeft : 0}-${nextFocusDown || 0}`;

        return (
            <View style={styles.cardWrapper} key={cardKey}>
                <GameCard
                    item={item}
                    index={index}
                    isFocused={index === focusedIndex}
                    onFocus={handleCardFocus}
                    onBlur={handleCardBlur}
                    onPress={() => handleCardPress(item)}
                    nextFocusDown={nextFocusDown}
                    // IMPORTANT: Pass nextFocusLeft explicitly to the first card
                    // This ensures the native focus engine knows where to go when pressing left
                    nextFocusLeft={shouldNavigateToSidebar ? nextFocusLeft : undefined}
                />
            </View>
        );
    }, [focusedIndex, handleCardFocus, handleCardBlur, handleCardPress, nextFocusDown, nextFocusLeft]);

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.text}>Carregando jogos...</Text>
            </View>
        );
    }

    if (error || games.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.text}>
                    {error ? "Não foi possível carregar os jogos" : "Nenhum jogo disponível"}
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>Jogos de Hoje • Ao Vivo e Em Breve</Text>

            <View style={styles.sliderContainer}>
                <FlatList
                    ref={flatListRef}
                    data={games}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    style={styles.flatList}
                    // Scroll behavior
                    bounces={false}
                    overScrollMode="never"
                    scrollEnabled={true}
                    snapToInterval={SNAP_INTERVAL}
                    snapToAlignment="start"
                    decelerationRate="fast"
                    disableIntervalMomentum={true}
                    // Force re-render when navigation props change
                    extraData={{ focusedIndex, nextFocusLeft, nextFocusDown }}
                    // Performance
                    removeClippedSubviews={false}
                    getItemLayout={(data, index) => (
                        { length: SNAP_INTERVAL, offset: SNAP_INTERVAL * index, index }
                    )}
                    // Event handlers
                    onScrollBeginDrag={() => {
                        // Only set focus area for swipe gestures
                        isNavigatingByFocusRef.current = false;
                        setFocusArea('slider');
                    }}
                    onMomentumScrollEnd={(event) => {
                        // Only update focusedIndex if this was a swipe gesture, not D-pad navigation
                        if (!isNavigatingByFocusRef.current) {
                            const newIndex = Math.round(event.nativeEvent.contentOffset.x / SNAP_INTERVAL);
                            const clampedIndex = Math.max(0, Math.min(newIndex, games.length - 1));
                            setFocusedIndex(clampedIndex);
                            // Note: We don't reset focus area here anymore
                            // Autoplay will resume naturally when focus leaves the slider
                        }
                        // Reset the flag after scroll ends
                        isNavigatingByFocusRef.current = false;
                    }}
                />
            </View>

            <View style={styles.dotsContainer}>
                {/* Fixed 3 dots indicator: left (has previous), center (active), right (has next) */}
                <View style={[styles.dot, focusedIndex > 0 ? styles.visibleDot : styles.hiddenDot]} />
                <View style={[styles.dot, styles.activeDot]} />
                <View style={[styles.dot, focusedIndex < games.length - 1 ? styles.visibleDot : styles.hiddenDot]} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 10,
        width: '100%',
    },
    sliderContainer: {
        // Remove overflow visible - use clip to prevent overlapping sidebar
    },
    flatList: {
        // Keep default overflow behavior
    },
    centerContainer: {
        height: 280,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: Colors.text,
        fontSize: 16,
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginLeft: 40,
        marginBottom: 15,
        letterSpacing: 0.5,
    },
    listContent: {
        paddingHorizontal: 40,
        paddingVertical: 5,
    },
    cardWrapper: {
        marginRight: SPACING,
    },
    cardContainer: {
        width: CARD_WIDTH,
        height: 280,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
        borderWidth: 3,
        borderColor: 'transparent',
    },
    activeCardGlow: {
        borderColor: '#00ff88',
        backgroundColor: '#222',
        // No transform scale - use only border and shadow
        shadowColor: '#00ff88',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8,
    },
    backgroundImage: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.5,
    },
    cardGradient: {
        flex: 1,
        padding: 20,
        justifyContent: 'space-between',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        width: '100%',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 4,
        backgroundColor: '#e50914',
    },
    liveBadge: {
        backgroundColor: '#e50914',
    },
    scheduledBadge: {
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    statusText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    blinkingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#fff',
        marginRight: 6,
    },
    mainContent: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        flex: 1,
        paddingHorizontal: 10,
    },
    logo: {
        width: 70,
        height: 70,
    },
    scoreContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    scoreText: {
        color: '#fff',
        fontSize: 36,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    gameTimeText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginTop: 4,
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    footerContent: {
        alignItems: 'center',
        marginBottom: 10,
    },
    versusText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    footerInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    channelText: {
        color: '#00ff88', // Highlight channel
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    footerStatusText: {
        color: '#ccc',
        fontSize: 12,
        fontWeight: '400',
    },
    dotsContainer: {
        flexDirection: 'row',
        marginTop: 15,
        justifyContent: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginHorizontal: 4,
    },
    visibleDot: {
        backgroundColor: '#555',
    },
    hiddenDot: {
        backgroundColor: 'transparent',
    },
    activeDot: {
        backgroundColor: '#00ff88',
        width: 24,
        height: 8,
        borderRadius: 4,
    },
});
