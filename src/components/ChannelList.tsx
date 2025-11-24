import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, ActivityIndicator, Dimensions, LayoutAnimation, Platform, UIManager, findNodeHandle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/Colors';
import { fetchChannels, Channel, Category } from '../services/channelService';
import { fetchCurrentProgram, ProgramInfo } from '../services/guideService';
import { Ionicons } from '@expo/vector-icons';
import { TopBar } from './TopBar';

const { width } = Dimensions.get('window');

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

export const ChannelList = ({ onChannelSelect, onBack, transparent = false }: { onChannelSelect?: (channel: Channel) => void, onBack?: () => void, transparent?: boolean }) => {
    const router = useRouter();
    const [categories, setCategories] = useState<Category[]>([]);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [focusedCategory, setFocusedCategory] = useState<string | null>(null);
    const [focusedChannel, setFocusedChannel] = useState<string | null>(null);
    const [programInfos, setProgramInfos] = useState<{ [channelId: string]: ProgramInfo | null }>({});

    const [searchQuery, setSearchQuery] = useState('');
    const firstCategoryRef = useRef<View>(null);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (transparent && categories.length > 0) {
            // Force focus on the first category when in overlay mode
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

            // Fetch program info for all channels
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

    const handleCategorySelect = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSelectedCategory(id);
    };

    const filteredChannels = channels.filter(c => {
        const matchesCategory = selectedCategory ? c.category === selectedCategory : true;
        const matchesSearch = searchQuery
            ? c.name.toLowerCase().includes(searchQuery.toLowerCase())
            : true;
        return matchesCategory && matchesSearch;
    });

    const getCategoryName = (id: string) => {
        return categories.find(c => c.id === id)?.name || 'Canais';
    };

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
            <TopBar onSearch={setSearchQuery} searchValue={searchQuery} onBack={onBack} />

            <View style={styles.contentWrapper}>
                <Text style={styles.pageTitle}>Canais</Text>

                <View style={styles.mainContent}>
                    {/* Categories Sidebar (Transparent) */}
                    <View style={styles.categoriesSidebar}>
                        <Text style={styles.sectionTitle}>Categorias</Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {categories.map((category) => (
                                <Pressable
                                    key={category.id}
                                    onPress={() => handleCategorySelect(category.id)}
                                    onFocus={() => setFocusedCategory(category.id)}
                                    onBlur={() => setFocusedCategory(null)}
                                    style={[
                                        styles.categoryItem,
                                        selectedCategory === category.id && styles.categorySelected,
                                        focusedCategory === category.id && styles.categoryFocused
                                    ]}
                                >
                                    <Ionicons
                                        name={getIconForCategory(category.id)}
                                        size={20}
                                        color={selectedCategory === category.id ? '#fff' : '#888'}
                                        style={styles.categoryIcon}
                                    />
                                    <Text style={[
                                        styles.categoryText,
                                        selectedCategory === category.id && styles.categoryTextSelected
                                    ]}>
                                        {category.name}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Channels Grid */}
                    <View style={styles.channelsContainer}>
                        <View style={styles.header}>
                            <Text style={styles.subHeader}>
                                {selectedCategory ? getCategoryName(selectedCategory) : 'Todos'} • {filteredChannels.length} canais ao vivo
                            </Text>
                        </View>

                        <ScrollView contentContainerStyle={styles.gridContent} showsVerticalScrollIndicator={false}>
                            <View style={styles.grid}>
                                {filteredChannels.map((channel) => (
                                    <Pressable
                                        key={channel.id}
                                        onPress={() => {
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
                                        }}
                                        onFocus={() => setFocusedChannel(channel.id)}
                                        onBlur={() => setFocusedChannel(null)}
                                        style={[
                                            styles.channelCard,
                                            focusedChannel === channel.id && styles.channelCardFocused
                                        ]}
                                    >
                                        <View style={styles.cardContent}>
                                            <View style={styles.logoContainer}>
                                                <Image
                                                    source={{ uri: channel.logo }}
                                                    style={styles.channelLogo}
                                                    resizeMode="contain"
                                                />
                                            </View>
                                            <View style={styles.channelInfo}>
                                                <Text style={styles.channelName} numberOfLines={1}>{channel.name}</Text>
                                                {programInfos[channel.id] ? (
                                                    <Text style={styles.programInfo} numberOfLines={1}>
                                                        {programInfos[channel.id]!.time} • {programInfos[channel.id]!.title}
                                                    </Text>
                                                ) : (
                                                    <Text style={styles.programInfo} numberOfLines={1}>AO VIVO</Text>
                                                )}
                                            </View>
                                        </View>
                                    </Pressable>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </View>
        </LinearGradient>
    );
};

// Helper to map categories to icons (simple mapping based on common names)
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
        // Removed background color and border
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
        backgroundColor: 'rgba(30, 215, 96, 0.1)', // Green tint
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
        flex: 1,
        paddingLeft: 20,
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
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 20,
        justifyContent: 'flex-start',
    },
    channelCard: {
        width: '48%', // 2 columns with gap
        minWidth: 210,
        maxWidth: 450,
        aspectRatio: 1.6,
        backgroundColor: 'rgba(255,255,255,0.05)', // More transparent
        borderRadius: 12,
        padding: 0,
        overflow: 'hidden',
    },
    channelCardFocused: {
        backgroundColor: '#333',
        transform: [{ scale: 1.05 }],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        zIndex: 1,
    },
    cardContent: {
        width: '100%',
        height: '100%',
    },
    logoContainer: {
        width: '100%',
        height: '65%',
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
    },
    channelLogo: {
        width: '100%',
        height: '100%',
    },
    channelInfo: {
        width: '100%',
        height: '35%',
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    channelName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    programInfo: {
        color: '#e50914', // Red for live
        fontSize: 12,
        marginBottom: 6,
    },
    progressBar: {
        width: '100%',
        height: 3,
        backgroundColor: '#444',
        borderRadius: 2,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#1ed760', // Spotify green
        borderRadius: 2,
    },
});
