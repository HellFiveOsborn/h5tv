import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Dimensions, LayoutAnimation, Platform, UIManager, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/Colors';
import { fetchChannels, Channel, Category } from '../services/channelService';
import { fetchCurrentProgram, ProgramInfo } from '../services/guideService';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TopBar } from './TopBar';
import { ChannelListItem } from './ChannelListItem';
import { SearchOverlay } from './SearchOverlay';
import { TVFocusable } from './TVFocusable';

const { width } = Dimensions.get('window');

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

// Global cache for channels data to avoid refetching on every overlay open
let cachedCategories: Category[] | null = null;
let cachedChannels: Channel[] | null = null;
let cachedProgramInfos: { [channelId: string]: ProgramInfo | null } = {};
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface ChannelListProps {
    onChannelSelect?: (channel: Channel) => void;
    onBack?: () => void;
    transparent?: boolean;
    initialCategory?: string;
}

// Memoized Category Item
const CategoryItem = memo(({
    category,
    isSelected,
    onPress,
    onFocus,
    onBlur,
    hasTVPreferredFocus = false
}: {
    category: Category;
    isSelected: boolean;
    onPress: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
    hasTVPreferredFocus?: boolean;
}) => (
    <TVFocusable
        isActive={isSelected}
        onPress={onPress}
        onFocus={onFocus}
        onBlur={onBlur}
        hasTVPreferredFocus={hasTVPreferredFocus}
        style={styles.categoryItem}
        activeStyle={styles.categorySelected}
        focusedStyle={styles.categoryFocused}
    >
        {({ isFocused, isActive }) => (
            <>
                <Ionicons
                    name={getIconForCategory(category.id)}
                    size={20}
                    color={isActive ? '#fff' : (isFocused ? '#fff' : '#888')}
                    style={styles.categoryIcon}
                />
                <Text style={[
                    styles.categoryText,
                    isActive && styles.categoryTextSelected,
                    isFocused && !isActive && styles.categoryTextFocused
                ]}>
                    {category.name}
                </Text>
            </>
        )}
    </TVFocusable>
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

export const ChannelList = memo(({ onChannelSelect, onBack, transparent = false, initialCategory }: ChannelListProps) => {
    const router = useRouter();
    const [categories, setCategories] = useState<Category[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory || null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [focusedCategory, setFocusedCategory] = useState<string | null>(null);
    const [focusedChannel, setFocusedChannel] = useState<string | null>(null);
    const [programInfos, setProgramInfos] = useState<{ [channelId: string]: ProgramInfo | null }>({});

    const [searchOverlayVisible, setSearchOverlayVisible] = useState(false);
    const firstCategoryRef = useRef<View>(null);

    // Load data on mount
    useEffect(() => {
        loadData();
    }, []);

    // React to initialCategory changes (when overlay reopens with different channel)
    useEffect(() => {
        if (initialCategory && categories.length > 0) {
            const categoryExists = categories.some(c => c.id === initialCategory);
            if (categoryExists) {
                console.log('[ChannelList] Updating selected category to:', initialCategory);
                setSelectedCategory(initialCategory);
            }
        }
    }, [initialCategory, categories]);

    // Check if cache is valid
    const isCacheValid = useCallback(() => {
        const now = Date.now();
        return cachedCategories && cachedChannels && (now - cacheTimestamp < CACHE_DURATION);
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
            // Use cache if valid
            if (isCacheValid()) {
                console.log('[ChannelList] Using cached data, initialCategory:', initialCategory);
                setCategories(cachedCategories!);
                setChannels(cachedChannels!);
                setProgramInfos(cachedProgramInfos);

                // Always prioritize initialCategory when provided
                if (initialCategory && cachedCategories!.some(c => c.id === initialCategory)) {
                    console.log('[ChannelList] Setting initial category:', initialCategory);
                    setSelectedCategory(initialCategory);
                } else if (!selectedCategory) {
                    // Only set default if no category is selected
                    setSelectedCategory(cachedCategories![0]?.id || null);
                }

                setLoading(false);
                return;
            }

            console.log('[ChannelList] Fetching fresh data');
            setLoading(true);
            const data = await fetchChannels();

            // Update cache
            cachedCategories = data.categories;
            cachedChannels = data.channels;
            cacheTimestamp = Date.now();

            setCategories(data.categories);
            setChannels(data.channels);

            // Always prioritize initialCategory when provided
            if (initialCategory && data.categories.some(c => c.id === initialCategory)) {
                console.log('[ChannelList] Setting initial category:', initialCategory);
                setSelectedCategory(initialCategory);
            } else if (!selectedCategory) {
                setSelectedCategory(data.categories[0]?.id || null);
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

        // Load in batches of 5 to avoid overwhelming the network
        const batchSize = 5;
        for (let i = 0; i < channelList.length; i += batchSize) {
            const batch = channelList.slice(i, i + batchSize);
            await Promise.all(
                batch.map(async (channel) => {
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
            // Update state progressively for better UX
            setProgramInfos(prev => ({ ...prev, ...infos }));
        }

        // Update global cache
        cachedProgramInfos = { ...cachedProgramInfos, ...infos };
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
                    guide: channel.guide || '',
                    meuGuiaTv: channel.meuGuiaTv || '',
                    category: channel.category || ''
                }
            });
        }
    }, [onChannelSelect, router]);

    const getCategoryName = useCallback((id: string) => {
        return categories.find(c => c.id === id)?.name || 'Canais';
    }, [categories]);

    // Optimized FlatList item renderer for vertical carousel
    const renderChannelItem = useCallback(({ item }: { item: Channel }) => (
        <ChannelListItem
            channel={item}
            programInfo={programInfos[item.id]}
            onPress={() => handleChannelPress(item)}
            onFocus={() => setFocusedChannel(item.id)}
            onBlur={() => setFocusedChannel(null)}
        />
    ), [programInfos, handleChannelPress]);

    // Key extractor for FlatList
    const keyExtractor = useCallback((item: Channel) => item.id, []);

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
                            {categories.map((category, index) => {
                                // Give preferred focus to initialCategory or first item
                                const shouldHaveFocus = initialCategory
                                    ? category.id === initialCategory
                                    : index === 0;
                                return (
                                    <CategoryItem
                                        key={category.id}
                                        category={category}
                                        isSelected={selectedCategory === category.id}
                                        onPress={() => handleCategorySelect(category.id)}
                                        onFocus={() => setFocusedCategory(category.id)}
                                        onBlur={() => setFocusedCategory(null)}
                                        hasTVPreferredFocus={shouldHaveFocus}
                                    />
                                );
                            })}
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
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                            removeClippedSubviews={true}
                            maxToRenderPerBatch={10}
                            windowSize={5}
                            initialNumToRender={10}
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
    categoryTextFocused: {
        color: '#fff',
    },

    // Channels List (Vertical Carousel)
    channelsContainer: {
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        flex: 1,
        paddingHorizontal: 15,
        paddingTop: 10,
        marginTop: -70,
    },
    header: {
        marginBottom: 10,
    },
    subHeader: {
        color: '#888',
        fontSize: 16,
    },
    listContent: {
        paddingBottom: 50,
        paddingTop: 5,
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
