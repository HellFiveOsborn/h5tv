import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { View, Text, StyleSheet, Modal, FlatList, Pressable, ActivityIndicator, Image, useWindowDimensions, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Channel, fetchChannels } from '../services/channelService';
import { fetchCurrentProgram, ProgramInfo } from '../services/guideService';
import { useChannelSearch } from '../hooks/useChannelSearch';
import { SearchInput } from './SearchInput';
import { Colors } from '../constants/Colors';
import { TVFocusable } from './TVFocusable';

interface SearchOverlayProps {
    visible: boolean;
    onClose: () => void;
    onChannelSelect?: (channel: Channel) => void;
    initialSearchTerms?: string[]; // Channel names to filter by (e.g., from game broadcasts)
    gameTitle?: string; // Optional title to show (e.g., "Palmeiras x Flamengo")
}

// Memoized search result card
const SearchResultCard = memo(({
    channel,
    programInfo,
    isFocused: externalFocused,
    onPress,
    onFocus,
    onBlur,
    index,
    totalResults,
}: {
    channel: Channel;
    programInfo?: ProgramInfo | null;
    isFocused?: boolean;
    onPress: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
    index: number;
    totalResults: number;
}) => {
    return (
        <View style={styles.cardWrapper}>
            <TVFocusable
                onPress={onPress}
                onFocus={onFocus}
                onBlur={onBlur}
                hasTVPreferredFocus={index === 0}
                style={styles.resultCard}
                focusedStyle={styles.resultCardFocused}
            >
                {({ isFocused: internalFocused }) => {
                    const isFocused = externalFocused !== undefined ? externalFocused : internalFocused;

                    return (
                        <>
                            <View style={styles.logoContainer}>
                                <Image
                                    source={{ uri: channel.logo }}
                                    style={styles.channelLogo}
                                    resizeMode="contain"
                                />
                            </View>
                            <View style={styles.channelInfo}>
                                <Text style={styles.channelName} numberOfLines={1}>
                                    {channel.name}
                                </Text>
                                <Text style={styles.programText} numberOfLines={1}>
                                    {programInfo?.title || 'Carregando programação...'}
                                </Text>
                            </View>
                            <Ionicons
                                name="chevron-forward"
                                size={24}
                                color={isFocused ? '#00ff88' : '#555'}
                            />
                        </>
                    );
                }}
            </TVFocusable>
        </View>
    );
});

SearchResultCard.displayName = 'SearchResultCard';

export const SearchOverlay = memo(({ visible, onClose, onChannelSelect, initialSearchTerms = [], gameTitle }: SearchOverlayProps) => {
    const router = useRouter();
    const [channels, setChannels] = useState<Channel[]>([]);
    const [loading, setLoading] = useState(true);
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
    const [programInfos, setProgramInfos] = useState<{ [channelId: string]: ProgramInfo | null }>({});
    const searchInputRef = useRef<View>(null);
    const flatListRef = useRef<FlatList>(null);
    const { height: screenHeight, width: screenWidth } = useWindowDimensions();

    // Responsive calculations
    const isSmallScreen = screenHeight < 600;
    const dynamicStyles = {
        gradient: {
            paddingHorizontal: isSmallScreen ? 20 : 60,
            paddingTop: isSmallScreen ? 15 : 40,
            paddingBottom: isSmallScreen ? 10 : 0,
        },
        header: {
            marginBottom: isSmallScreen ? 15 : 30,
        },
        closeButton: {
            padding: isSmallScreen ? 6 : 10,
            marginRight: isSmallScreen ? 12 : 20,
        },
        closeIcon: isSmallScreen ? 22 : 28,
        gameModeTitle: {
            fontSize: isSmallScreen ? 18 : 24,
        },
        gameModeSubtitle: {
            fontSize: isSmallScreen ? 13 : 16,
            marginTop: isSmallScreen ? 4 : 6,
        },
        resultsCount: {
            fontSize: isSmallScreen ? 12 : 14,
            marginBottom: isSmallScreen ? 8 : 15,
        },
        footer: {
            paddingVertical: isSmallScreen ? 10 : 20,
        },
        footerText: {
            fontSize: isSmallScreen ? 10 : 12,
        },
        resultCard: {
            padding: isSmallScreen ? 10 : 15,
            height: isSmallScreen ? 56 : 70,
        },
        logoContainer: {
            width: isSmallScreen ? 40 : 50,
            height: isSmallScreen ? 40 : 50,
            marginRight: isSmallScreen ? 10 : 15,
        },
        channelLogo: {
            width: isSmallScreen ? 32 : 40,
            height: isSmallScreen ? 32 : 40,
        },
        channelName: {
            fontSize: isSmallScreen ? 14 : 16,
        },
        programText: {
            fontSize: isSmallScreen ? 10 : 12,
        },
    };

    // Determine if we're in "game mode" (showing channels for a specific game)
    const isGameMode = initialSearchTerms.length > 0;

    const {
        searchQuery,
        setSearchQuery,
        filteredChannels,
        isSearching,
        clearSearch,
        searchTerms,
        setSearchTerms
    } = useChannelSearch({
        channels,
        debounceMs: 300,
        initialSearchTerms
    });

    // Update search terms when initialSearchTerms prop changes
    useEffect(() => {
        if (visible && initialSearchTerms.length > 0) {
            setSearchTerms(initialSearchTerms);
        }
    }, [visible, initialSearchTerms, setSearchTerms]);

    // Load channels on mount
    useEffect(() => {
        if (visible) {
            loadChannels();
        }
    }, [visible]);

    // Reset state when overlay closes
    useEffect(() => {
        if (!visible) {
            clearSearch();
            setFocusedIndex(null);
        }
    }, [visible, clearSearch]);

    const loadChannels = async () => {
        try {
            setLoading(true);
            const data = await fetchChannels();
            setChannels(data.channels);

            // Load program info for all channels (in background)
            loadProgramInfos(data.channels);
        } catch (err) {
            console.error('Failed to load channels for search:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadProgramInfos = async (channelList: Channel[]) => {
        const infos: { [channelId: string]: ProgramInfo | null } = {};

        await Promise.all(
            channelList.map(async (channel) => {
                const guideUrl = channel.meuGuiaTv || channel.guide;
                if (guideUrl) {
                    try {
                        const info = await fetchCurrentProgram(guideUrl);
                        infos[channel.id] = info;
                    } catch (e) {
                        infos[channel.id] = null;
                    }
                }
            })
        );

        setProgramInfos(infos);
    };

    const handleChannelPress = useCallback((channel: Channel) => {
        if (onChannelSelect) {
            onChannelSelect(channel);
        } else {
            router.push({
                pathname: '/stream',
                params: {
                    name: channel.name,
                    logo: channel.logo,
                    urls: JSON.stringify(channel.url),
                    guide: channel.guide
                }
            });
        }
        onClose();
    }, [onChannelSelect, router, onClose]);

    const handleClose = useCallback(() => {
        clearSearch();
        onClose();
    }, [clearSearch, onClose]);

    const renderItem = useCallback(({ item, index }: { item: Channel; index: number }) => (
        <SearchResultCard
            channel={item}
            programInfo={programInfos[item.id]}
            isFocused={focusedIndex === index}
            onPress={() => handleChannelPress(item)}
            onFocus={() => setFocusedIndex(index)}
            onBlur={() => setFocusedIndex(null)}
            index={index}
            totalResults={filteredChannels.length}
        />
    ), [focusedIndex, handleChannelPress, filteredChannels.length, programInfos]);

    const keyExtractor = useCallback((item: Channel) => item.id, []);

    const getItemLayout = useCallback((data: ArrayLike<Channel> | null | undefined, index: number) => ({
        length: 80,
        offset: 80 * index,
        index,
    }), []);

    // Show results when there's a search query OR when in game mode (initial search terms provided)
    const showResults = searchQuery.trim().length > 0 || isGameMode;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={handleClose}
            statusBarTranslucent={true}
        >
            <View style={styles.container}>
                <StatusBar backgroundColor="transparent" barStyle="light-content" translucent />
                <LinearGradient
                    colors={['rgba(0, 0, 0, 0.95)', 'rgba(0, 0, 0, 0.98)']}
                    style={[styles.gradient, dynamicStyles.gradient]}
                >
                    {/* Header with Search Input or Game Title */}
                    <View style={[styles.header, dynamicStyles.header]}>
                        <TVFocusable
                            onPress={handleClose}
                            style={[styles.closeButton, dynamicStyles.closeButton]}
                            focusedStyle={styles.closeButtonFocused}
                        >
                            {({ isFocused }) => (
                                <Ionicons name="close" size={dynamicStyles.closeIcon} color={isFocused ? '#00ff88' : '#fff'} />
                            )}
                        </TVFocusable>

                        {isGameMode ? (
                            <View style={styles.gameModeHeader}>
                                <View style={styles.gameTitleContainer}>
                                    <Ionicons name="tv" size={isSmallScreen ? 18 : 24} color="#00ff88" style={styles.gameModeIcon} />
                                    <Text style={[styles.gameModeTitle, dynamicStyles.gameModeTitle]}>
                                        {gameTitle || 'Canais que transmitem'}
                                    </Text>
                                </View>
                                <Text style={[styles.gameModeSubtitle, dynamicStyles.gameModeSubtitle]}>
                                    Transmissão: {initialSearchTerms.join(' / ')}
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.searchContainer}>
                                <SearchInput
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    isSearching={isSearching}
                                    onClear={clearSearch}
                                    placeholder="Digite para buscar canais..."
                                    autoFocus={true}
                                />
                            </View>
                        )}
                    </View>

                    {/* Results Section */}
                    <View style={styles.resultsContainer}>
                        {loading ? (
                            <View style={styles.centerContainer}>
                                <ActivityIndicator size={isSmallScreen ? "small" : "large"} color={Colors.primary} />
                                <Text style={styles.loadingText}>Carregando canais...</Text>
                            </View>
                        ) : !showResults ? (
                            <View style={styles.centerContainer}>
                                <Ionicons name="search" size={isSmallScreen ? 48 : 64} color="#333" />
                                <Text style={styles.hintText}>
                                    Digite o nome do canal que deseja encontrar
                                </Text>
                            </View>
                        ) : filteredChannels.length === 0 ? (
                            <View style={styles.centerContainer}>
                                <Ionicons name="sad-outline" size={isSmallScreen ? 48 : 64} color="#333" />
                                <Text style={styles.noResultsText}>
                                    {isGameMode
                                        ? `Nenhum canal disponível para ${initialSearchTerms.join(' / ')}`
                                        : `Nenhum canal encontrado para "${searchQuery}"`
                                    }
                                </Text>
                            </View>
                        ) : (
                            <>
                                <Text style={[styles.resultsCount, dynamicStyles.resultsCount]}>
                                    {isGameMode
                                        ? `${filteredChannels.length} ${filteredChannels.length === 1 ? 'canal disponível' : 'canais disponíveis'}`
                                        : `${filteredChannels.length} ${filteredChannels.length === 1 ? 'resultado' : 'resultados'} para "${searchQuery}"`
                                    }
                                </Text>
                                <FlatList
                                    ref={flatListRef}
                                    data={filteredChannels}
                                    renderItem={renderItem}
                                    keyExtractor={keyExtractor}
                                    getItemLayout={getItemLayout}
                                    contentContainerStyle={styles.listContent}
                                    showsVerticalScrollIndicator={false}
                                    removeClippedSubviews={true}
                                    maxToRenderPerBatch={10}
                                    windowSize={5}
                                    initialNumToRender={10}
                                    extraData={focusedIndex}
                                />
                            </>
                        )}
                    </View>

                    {/* Footer hint */}
                    <View style={[styles.footer, dynamicStyles.footer]}>
                        <Text style={[styles.footerText, dynamicStyles.footerText]}>
                            {isGameMode
                                ? 'Selecione um canal para assistir • ESC para fechar'
                                : 'Use as setas para navegar • Enter para selecionar • ESC para fechar'
                            }
                        </Text>
                    </View>
                </LinearGradient>
            </View>
        </Modal>
    );
});

SearchOverlay.displayName = 'SearchOverlay';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.54)',
    },
    gradient: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
    },
    closeButton: {
        padding: 10,
        marginRight: 20,
        borderRadius: 25,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    closeButtonFocused: {
        borderColor: '#00ff88',
        backgroundColor: 'rgba(0, 255, 136, 0.1)',
    },
    searchContainer: {
        flex: 1,
        // maxWidth: 600,
    },
    gameModeHeader: {
        flex: 1,
    },
    gameTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    gameModeIcon: {
        marginRight: 12,
    },
    gameModeTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    gameModeSubtitle: {
        color: '#00ff88',
        fontSize: 16,
        marginTop: 6,
        fontWeight: '600',
    },
    resultsContainer: {
        flex: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#888',
        fontSize: 16,
        marginTop: 16,
    },
    hintText: {
        color: '#555',
        fontSize: 18,
        marginTop: 20,
        textAlign: 'center',
    },
    noResultsText: {
        color: '#555',
        fontSize: 18,
        marginTop: 20,
        textAlign: 'center',
    },
    resultsCount: {
        color: '#888',
        fontSize: 14,
        marginBottom: 15,
    },
    listContent: {
        paddingBottom: 30,
    },
    cardWrapper: {
        marginBottom: 10,
    },
    resultCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 10,
        padding: 15,
        height: 70,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    resultCardFocused: {
        backgroundColor: 'rgba(0, 255, 136, 0.1)',
        borderColor: 'rgba(0, 255, 136, 0.6)',
    },
    logoContainer: {
        width: 50,
        height: 50,
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 15,
    },
    channelLogo: {
        width: 40,
        height: 40,
    },
    channelInfo: {
        flex: 1,
    },
    channelName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    programText: {
        color: '#00ff88',
        fontSize: 12,
        marginTop: 2,
    },
    footer: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    footerText: {
        color: '#444',
        fontSize: 12,
    },
});