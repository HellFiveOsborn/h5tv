import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, FlatList, ListRenderItemInfo, Animated, Pressable } from 'react-native';
import { Colors } from '../constants/Colors';
import { fetchGames } from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';

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

const BlinkingDot = () => {
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
};

export const GameSlider = () => {
    const [games, setGames] = useState<GameData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        loadGames();
    }, []);

    // Scroll to focused index when it changes
    useEffect(() => {
        if (games.length > 0 && flatListRef.current) {
            flatListRef.current.scrollToIndex({
                index: focusedIndex,
                animated: true,
                viewPosition: 0.5
            });
        }
    }, [focusedIndex, games]);

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

    const renderItem = ({ item, index }: ListRenderItemInfo<GameData>) => {
        const isLive = item.status.toLowerCase().includes('vivo') || item.status.toLowerCase().includes('int');
        const isFocused = index === focusedIndex;
        const bannerSource = BANNERS[index % BANNERS.length];
        const statusText = formatGameStatus(item.startTime, item.status, isLive);

        return (
            <Pressable
                onFocus={() => setFocusedIndex(index)}
                style={[styles.cardContainer, isFocused && styles.activeCardGlow]}
            >
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
            </Pressable>
        );
    };

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

            <FlatList
                ref={flatListRef}
                data={games}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                // TV Specific Props
                removeClippedSubviews={false}
                scrollEnabled={false} // Disable manual scroll, rely on focus
                getItemLayout={(data, index) => (
                    { length: SNAP_INTERVAL, offset: SNAP_INTERVAL * index, index }
                )}
            />

            <View style={styles.dotsContainer}>
                {games.map((_, index) => (
                    <View
                        key={index}
                        style={[
                            styles.dot,
                            focusedIndex === index ? styles.activeDot : null
                        ]}
                    />
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 20,
        width: '100%',
    },
    centerContainer: {
        height: 300,
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
        marginLeft: 40, // Match layout padding
        marginBottom: 15,
        letterSpacing: 0.5,
    },
    listContent: {
        paddingHorizontal: 40, // Start padding
    },
    cardContainer: {
        width: CARD_WIDTH,
        height: 300,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
        borderWidth: 2,
        borderColor: 'transparent',
        marginRight: SPACING,
    },
    activeCardGlow: {
        borderColor: '#00ff88',
        shadowColor: '#00ff88',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 15,
        elevation: 10,
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
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#333',
        marginHorizontal: 3,
    },
    activeDot: {
        backgroundColor: '#00ff88',
        width: 20,
        height: 6,
    },
});
