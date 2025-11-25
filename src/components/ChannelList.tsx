import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Dimensions, LayoutAnimation, Platform, UIManager, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/Colors';
import { fetchChannels, Channel, Category } from '../services/channelService';
import { fetchCurrentProgram, ProgramInfo } from '../services/guideService';
import { Ionicons } from '@expo/vector-icons';
import { TopBar } from './TopBar';
import { ChannelCard } from './ChannelCard';
import { SearchOverlay } from './SearchOverlay';

const { width } = Dimensions.get('window');

// Calculate card dimensions for FlatList optimization
const CARD_ASPECT_RATIO = 1.6;
const NUM_COLUMNS = 2;
const CARD_GAP = 20;
const CONTAINER_PADDING = 40;
const CARD_WIDTH = (width - 100 - CONTAINER_PADDING * 2 - 250 - 20 - CARD_GAP) / NUM_COLUMNS; // Account for sidebar, categories, gaps
const CARD_HEIGHT = CARD_WIDTH / CARD_ASPECT_RATIO;

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

interface ChannelListProps {
    onChannelSelect?: (channel: Channel) => void;
    onBack?: () => void;
    transparent?: boolean;
}

// Memoized Category Item
const CategoryItem = memo(({
    category,
    isSelected,
    isFocused,
    onPress,
    onFocus,
    onBlur
}: {
    category: Category;
    isSelected: boolean;
    isFocused: boolean;
    onPress: () => void;
    onFocus: () => void;
    onBlur: () => void;
}) => (
    <Pressable
        onPress={onPress}
        onFocus={onFocus}
        onBlur={onBlur}
        style={[
            styles.categoryItem,
            isSelected && styles.categorySelected,
            isFocused && styles.categoryFocused
        ]}
    >
        <Ionicons
            name={getIconForCategory(category.id)}
            size={20}
            color={isSelected ? '#fff' : '#888'}
            style={styles.categoryIcon}
        />
        <Text style={[
            styles.categoryText,
            isSelected && styles.categoryTextSelected
        ]}>
            {category.name}
        </Text>
    </Pressable>
));

CategoryItem.displayName = 'CategoryItem';

// Helper to map categories to icons
const getIconForCategory = (id: string): any => {
    const lowerId = id.toLowerCase();
    if (lowerId.includes('futebol') || lowerId.includes('esporte')) return 'football';
    if (lowerId.includes('filme')) return 'film';
    if (lowerId.includes('serie')) return 'tv';
    if (lowerId.includes('infantil') || lowerId.includes('kids') || lowerId.includes('desenho')) return 'happy';
    if (lowerId.includes('noticia')) return 'newspaper';
    if (lowerId.includes('aberta')) return 'radio';
    return 'grid';
};

export const ChannelList = memo(({ onChannelSelect, onBack, transparent = false }: ChannelListProps) => {
    const router = useRouter();
    const [categories, setCategories] = useState<Category[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [focusedCategory, setFocusedCategory] = useState<string | null>(null);
    const [focusedChannel, setFocusedChannel] = useState<string | null>(null);
    const [programInfos, setProgramInfos] = useState<{ [channelId: string]: ProgramInfo | null }>({});

    const [searchOverlayVisible, setSearchOverlayVisible] = useState(false);
    const firstCategoryRef = useRef<View>(null);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (transparent && categories.length > 0) {
            const timer = setTimeout(() => {
                if (firstCategoryRef.current) {
                    (firstCategoryRef.current as any)?.requestTVFocus?.();
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [categories, transparent]);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await fetchChannels();
            setCategories(data.categories);
            setChannels(data.channels);
            if (data.categories.length > 0) {
                setSelectedCategory(data.categories[0].id);
            }

            loadProgramInfos(data.channels);
        } catch (err) {
            setError('Falha ao carregar canais');
            console.error(err);
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

    // Filter channels by category only (search is handled by overlay)
    const filteredChannels = channels.filter(c =>
        selectedCategory ? c.category === selectedCategory : true
    );

    const handleCategorySelect = useCallback((id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSelectedCategory(id);
    }, []);

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
    }, [onChannelSelect, router]);

    const getCategoryName = useCallback((id: string) => {
        return categories.find(c => c.id === id)?.name || 'Canais';
    }, [categories]);

    // Optimized FlatList item renderer
    const renderChannelItem = useCallback(({ item }: { item: Channel }) => (
        <ChannelCard
            channel={item}
            programInfo={programInfos[item.id]}
            isFocused={focusedChannel === item.id}
            onPress={() => handleChannelPress(item)}
            onFocus={() => setFocusedChannel(item.id)}
            onBlur={() => setFocusedChannel(null)}
        />
    ), [programInfos, focusedChannel, handleChannelPress]);

    // Key extractor for FlatList
    const keyExtractor = useCallback((item: Channel) => item.id, []);

    // Get item layout for FlatList optimization
    const getItemLayout = useCallback((data: ArrayLike<Channel> | null | undefined, index: number) => ({
        length: CARD_HEIGHT + CARD_GAP,
        offset: (CARD_HEIGHT + CARD_GAP) * Math.floor(index / NUM_COLUMNS),
        index,
    }), []);

    if (loading) {
        return (
            <View style={[styles.loadingContainer, transparent && styles.transparentBackground]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={[styles.loadingContainer, transparent && styles.transparentBackground]}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable onPress={loadData} style={styles.retryButton}>
                    <Text style={styles.retryText}>Tentar Novamente</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <LinearGradient
            colors={transparent ? ['transparent', 'transparent'] : ['#121212', '#000000']}
            style={styles.container}
        >
            <TopBar
                onSearchPress={() => setSearchOverlayVisible(true)}
                onBack={onBack}
            />

            {/* Search Overlay */}
            <SearchOverlay
                visible={searchOverlayVisible}
                onClose={() => setSearchOverlayVisible(false)}
                onChannelSelect={handleChannelPress}
            />

            <View style={styles.contentWrapper}>
                <Text style={styles.pageTitle}>Canais</Text>

                <View style={styles.mainContent}>
                    {/* Categories Sidebar */}
                    <View style={styles.categoriesSidebar}>
                        <Text style={styles.sectionTitle}>Categorias</Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {categories.map((category) => (
                                <CategoryItem
                                    key={category.id}
                                    category={category}
                                    isSelected={selectedCategory === category.id}
                                    isFocused={focusedCategory === category.id}
                                    onPress={() => handleCategorySelect(category.id)}
                                    onFocus={() => setFocusedCategory(category.id)}
                                    onBlur={() => setFocusedCategory(null)}
                                />
                            ))}
                        </ScrollView>
                    </View>

                    {/* Channels Grid - Using FlatList for optimization */}
                    <View style={styles.channelsContainer}>
                        <View style={styles.header}>
                            <Text style={styles.subHeader}>
                                {selectedCategory ? getCategoryName(selectedCategory) : 'Todos'} • {filteredChannels.length} canais ao vivo
                            </Text>
                        </View>

                        <FlatList
                            data={filteredChannels}
                            renderItem={renderChannelItem}
                            keyExtractor={keyExtractor}
                            numColumns={NUM_COLUMNS}
                            columnWrapperStyle={styles.gridRow}
                            contentContainerStyle={styles.gridContent}
                            showsVerticalScrollIndicator={false}
                            removeClippedSubviews={true}
                            maxToRenderPerBatch={10}
                            windowSize={5}
                            initialNumToRender={8}
                            getItemLayout={getItemLayout}
                            extraData={focusedChannel}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="tv" size={48} color="#555" />
                                    <Text style={styles.emptyText}>
                                        Nenhum canal disponível nesta categoria
                                    </Text>
                                </View>
                            }
                        />
                    </View>
                </View>
            </View>
        </LinearGradient>
    );
});

ChannelList.displayName = 'ChannelList';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    contentWrapper: {
        flex: 1,
        paddingHorizontal: 40,
    },
    pageTitle: {
        color: '#fff',
        fontSize: 48,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    mainContent: {
        flex: 1,
        flexDirection: 'row',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    transparentBackground: {
        backgroundColor: 'transparent',
    },
    errorText: {
        color: '#e50914',
        marginBottom: 20,
    },
    retryButton: {
        padding: 10,
        backgroundColor: '#333',
        borderRadius: 5,
    },
    retryText: {
        color: '#fff',
    },

    // Categories Sidebar
    categoriesSidebar: {
        width: 250,
        paddingRight: 20,
    },
    sectionTitle: {
        color: '#ccc',
        fontSize: 18,
        marginBottom: 15,
        fontWeight: '500',
    },
    categoryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderRadius: 8,
        marginBottom: 8,
    },
    categorySelected: {
        backgroundColor: 'rgba(30, 215, 96, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(30, 215, 96, 0.5)',
        shadowColor: '#1ed760',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
    },
    categoryFocused: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    categoryIcon: {
        marginRight: 12,
    },
    categoryText: {
        color: '#888',
        fontSize: 16,
        fontWeight: '500',
    },
    categoryTextSelected: {
        color: '#fff',
        fontWeight: 'bold',
    },

    // Channels Grid
    channelsContainer: {
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        flex: 1,
        padding: 20,
        overflow: 'visible',
        marginTop: -70,
    },
    header: {
        marginBottom: 15,
    },
    subHeader: {
        color: '#888',
        fontSize: 18,
    },
    gridContent: {
        paddingBottom: 50,
        paddingTop: 10,
        paddingHorizontal: 5,
        overflow: 'visible',
    },
    gridRow: {
        justifyContent: 'flex-start',
        gap: CARD_GAP,
        marginBottom: CARD_GAP,
        overflow: 'visible',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        color: '#555',
        fontSize: 16,
        marginTop: 16,
        textAlign: 'center',
    },
});
