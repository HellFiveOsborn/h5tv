import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Dimensions, Alert, Platform, DeviceEventEmitter, Pressable } from 'react-native';
import { Colors } from '../src/constants/Colors';
import { SplashScreen } from '../src/components/SplashScreen';
import { GameSlider } from '../src/components/GameSlider';
import { ChannelList } from '../src/components/ChannelList';
import { Sidebar } from '../src/components/Sidebar';
import { TopBar } from '../src/components/TopBar';
import { SettingsScreen } from '../src/components/SettingsScreen';
import { SearchOverlay } from '../src/components/SearchOverlay';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { syncTimeWithServer } from '../src/services/timeService';
import { StorageKeys } from '../src/constants/StorageKeys';
import { FocusProvider } from '../src/constants/FocusContext';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { fetchChannels, Channel } from '../src/services/channelService';

const { width } = Dimensions.get('window');

export default function Home() {
    const [isSplashVisible, setSplashVisible] = useState(true);
    const [currentScreen, setCurrentScreen] = useState('home');
    const [searchOverlayVisible, setSearchOverlayVisible] = useState(false);
    const [gameSearchTerms, setGameSearchTerms] = useState<string[]>([]);
    const [gameTitle, setGameTitle] = useState<string>('');
    const [channels, setChannels] = useState<Channel[]>([]);
    const [focusedChannelId, setFocusedChannelId] = useState<string | null>(null);
    const contentRef = useRef<View>(null);
    const router = useRouter();

    useEffect(() => {
        // Sync time when app starts
        syncTimeWithServer();

        checkWifiSettings();
        loadChannels();
        const timer = setTimeout(() => {
            setSplashVisible(false);
        }, 3000);

        // TV Event Handler for key logging (Android TV)
        const keyEventSubscription = DeviceEventEmitter.addListener('onKeyDown', (event: any) => {
            console.log('[TV Key Event - onKeyDown]', {
                keyCode: event?.keyCode,
                action: event?.action,
                eventTime: event?.eventTime,
                rawEvent: event,
            });
        });

        const keyUpSubscription = DeviceEventEmitter.addListener('onKeyUp', (event: any) => {
            console.log('[TV Key Event - onKeyUp]', {
                keyCode: event?.keyCode,
                action: event?.action,
                rawEvent: event,
            });
        });

        return () => {
            clearTimeout(timer);
            keyEventSubscription.remove();
            keyUpSubscription.remove();
        };
    }, []);

    const loadChannels = async () => {
        try {
            const data = await fetchChannels();
            setChannels(data.channels.slice(0, 15));
        } catch (error) {
            console.error('Error loading channels:', error);
        }
    };

    const handleChannelPress = (channel: Channel) => {
        router.push({
            pathname: '/stream',
            params: {
                name: channel.name,
                logo: channel.logo,
                urls: JSON.stringify(channel.url),
                guide: channel.guide || '',
                meuGuiaTv: channel.meuGuiaTv || ''
            }
        });
    };

    const handleGamePress = (channels: string[], title: string) => {
        setGameSearchTerms(channels);
        setGameTitle(title);
        setSearchOverlayVisible(true);
    };

    const handleSearchClose = () => {
        setSearchOverlayVisible(false);
        setGameSearchTerms([]);
        setGameTitle('');
    };

    const handleOpenSearch = () => {
        setGameSearchTerms([]);
        setGameTitle('');
        setSearchOverlayVisible(true);
    };

    const checkWifiSettings = async () => {
        try {
            const forceWifi = await AsyncStorage.getItem(StorageKeys.SETTINGS_FORCE_WIFI);
            // Default to true if not set
            if (forceWifi === 'true' || forceWifi === null) {
                const networkState = await Network.getNetworkStateAsync();
                if (!networkState.isConnected || networkState.type !== Network.NetworkStateType.WIFI) {
                    // Attempt to prompt user or open settings
                    // On Android 10+ directly enabling WiFi is restricted.
                    // We can open settings.
                    if (Platform.OS === 'android') {
                        // Alert.alert(
                        //     'Wi-Fi Desligado',
                        //     'O aplicativo requer conexão Wi-Fi. Deseja ativar agora?',
                        //     [
                        //         { text: 'Não', style: 'cancel' },
                        //         { text: 'Sim', onPress: () => Linking.openSettings() }
                        //     ]
                        // );
                        // For "Force" behavior as requested, we can try to open settings immediately if we detect it's off
                        // But for better UX, let's just log or show a non-blocking toast if we could.
                        // Given the requirement "Force ligar", we'll try to redirect to settings.
                        Linking.openSettings();
                    }
                }
            }
        } catch (e) {
            console.error('Error checking wifi settings', e);
        }
    };

    const renderContent = () => {
        if (currentScreen === 'channels') {
            return <ChannelList />;
        }

        if (currentScreen === 'settings') {
            return <SettingsScreen />;
        }

        // Default Home Content
        return (
            <LinearGradient
                colors={['#121212', '#000000']}
                style={styles.gradientBackground}
            >
                <TopBar onSearchPress={handleOpenSearch} />

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <GameSlider onGamePress={handleGamePress} />

                    {/* All Channels Section */}
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionTitle}>Todos os canais</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.horizontalList}
                            contentContainerStyle={styles.horizontalListContent}
                        >
                            {channels.map((channel) => (
                                <View key={channel.id} style={styles.channelCardWrapper}>
                                    <Pressable
                                        onPress={() => handleChannelPress(channel)}
                                        onFocus={() => setFocusedChannelId(channel.id)}
                                        onBlur={() => setFocusedChannelId(null)}
                                        style={[
                                            styles.channelCard,
                                            focusedChannelId === channel.id && styles.channelCardFocused
                                        ]}
                                    >
                                        <View style={styles.channelLogoContainer}>
                                            <Image
                                                source={{ uri: channel.logo }}
                                                style={styles.channelLogo}
                                                resizeMode="contain"
                                            />
                                        </View>
                                        <View style={styles.channelInfoContainer}>
                                            <Text style={styles.channelName} numberOfLines={1}>
                                                {channel.name}
                                            </Text>
                                            <Text style={styles.channelLive}>AO VIVO</Text>
                                        </View>
                                    </Pressable>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </ScrollView>
            </LinearGradient>
        );
    };

    return (
        <FocusProvider>
            <View style={styles.container}>
                {isSplashVisible && <SplashScreen />}

                {/* Main Layout: Sidebar + Content */}
                <View style={styles.mainLayout}>
                    <Sidebar
                        activeRoute={currentScreen}
                        onNavigate={setCurrentScreen}
                        contentRef={contentRef}
                    />

                    {/* Right Side Content */}
                    <View ref={contentRef} style={styles.contentContainer}>
                        {renderContent()}
                    </View>
                </View>

                {/* Search Overlay */}
                <SearchOverlay
                    visible={searchOverlayVisible}
                    onClose={handleSearchClose}
                    initialSearchTerms={gameSearchTerms}
                    gameTitle={gameTitle}
                />
            </View>
        </FocusProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    mainLayout: {
        flex: 1,
        flexDirection: 'row',
    },
    contentContainer: {
        flex: 1,
    },
    gradientBackground: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 50,
    },
    sectionContainer: {
        marginTop: 30,
        paddingLeft: 40, // Align with TopBar padding
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 15,
    },
    horizontalList: {
        flexGrow: 0,
        overflow: 'visible',
    },
    horizontalListContent: {
        paddingVertical: 10,
        paddingRight: 40,
    },
    channelCardWrapper: {
        marginRight: 15,
        overflow: 'visible',
    },
    channelCard: {
        width: 180,
        height: 130,
        borderRadius: 12,
        backgroundColor: '#1a1a1a',
    },
    channelCardFocused: {
        backgroundColor: '#333',
        transform: [{ scale: 1.08 }],
        borderWidth: 2,
        borderColor: '#00ff88',
        elevation: 8,
        shadowColor: '#00ff88',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    channelLogoContainer: {
        width: '100%',
        height: '65%',
        backgroundColor: '#0d0d0d',
        alignItems: 'center',
        justifyContent: 'center',
    },
    channelLogo: {
        width: '100%',
        height: '100%',
    },
    channelInfoContainer: {
        width: '100%',
        height: '35%',
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    channelName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    channelLive: {
        color: '#e50914',
        fontSize: 11,
    },
});


