import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Platform, DeviceEventEmitter, findNodeHandle } from 'react-native';
import { Colors } from '../src/constants/Colors';
import { SplashScreen } from '../src/components/SplashScreen';
import { GameSlider } from '../src/components/GameSlider';
import { ChannelList } from '../src/components/ChannelList';
import { ChannelCard, ChannelCardRef } from '../src/components/ChannelCard';
import { Sidebar, SidebarRef } from '../src/components/Sidebar';
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
    const firstChannelRef = useRef<ChannelCardRef>(null);
    const sidebarRef = useRef<SidebarRef>(null);
    const [firstChannelNodeHandle, setFirstChannelNodeHandle] = useState<number | null>(null);
    const [sidebarNodeHandle, setSidebarNodeHandle] = useState<number | null>(null);
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

    // Get node handle for the first channel card for nextFocusDown navigation
    useEffect(() => {
        // Retry mechanism to ensure channel card ref is available
        let attempts = 0;
        const maxAttempts = 10;

        const tryGetHandle = () => {
            if (firstChannelRef.current) {
                const handle = firstChannelRef.current.getNodeHandle();
                if (handle) {
                    console.log('[Navigation] First channel node handle obtained:', handle);
                    setFirstChannelNodeHandle(handle);
                    return true;
                }
            }
            return false;
        };

        const retryTimer = setInterval(() => {
            attempts++;
            if (tryGetHandle() || attempts >= maxAttempts) {
                clearInterval(retryTimer);
                if (attempts >= maxAttempts) {
                    console.warn('[Navigation] Failed to get first channel node handle after', maxAttempts, 'attempts');
                }
            }
        }, 200);

        return () => clearInterval(retryTimer);
    }, [channels]);

    // Get node handle for the sidebar for nextFocusLeft navigation
    useEffect(() => {
        // Retry mechanism to ensure sidebar refs are available
        let attempts = 0;
        const maxAttempts = 20; // Increased attempts

        const tryGetHandle = () => {
            console.log('[Navigation] Attempting to get sidebar handle, attempt:', attempts + 1);
            if (sidebarRef.current) {
                const handle = sidebarRef.current.getFirstItemNodeHandle();
                console.log('[Navigation] Sidebar ref exists, handle:', handle);
                if (handle) {
                    console.log('[Navigation] Sidebar node handle obtained:', handle);
                    setSidebarNodeHandle(handle);
                    return true;
                }
            } else {
                console.log('[Navigation] Sidebar ref is null');
            }
            return false;
        };

        const retryTimer = setInterval(() => {
            attempts++;
            if (tryGetHandle() || attempts >= maxAttempts) {
                clearInterval(retryTimer);
                if (attempts >= maxAttempts) {
                    console.warn('[Navigation] Failed to get sidebar node handle after', maxAttempts, 'attempts');
                }
            }
        }, 300); // Increased interval

        return () => clearInterval(retryTimer);
    }, []);

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

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    style={styles.mainScrollView}
                >
                    <GameSlider
                        onGamePress={handleGamePress}
                        nextFocusDown={firstChannelNodeHandle || undefined}
                        nextFocusLeft={sidebarNodeHandle || undefined}
                        sidebarRef={sidebarRef}
                    />

                    {/* All Channels Section */}
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionTitle}>Todos os canais</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.horizontalList}
                            contentContainerStyle={styles.horizontalListContent}
                        >
                            {channels.map((channel, index) => (
                                <View
                                    key={channel.id}
                                    style={styles.channelCardWrapper}
                                >
                                    <ChannelCard
                                        ref={index === 0 ? firstChannelRef : undefined}
                                        channel={channel}
                                        onPress={() => handleChannelPress(channel)}
                                        onFocus={() => setFocusedChannelId(channel.id)}
                                        onBlur={() => setFocusedChannelId(null)}
                                        nextFocusLeft={index === 0 ? (sidebarNodeHandle || undefined) : undefined}
                                        size="small"
                                    />
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
                        ref={sidebarRef}
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
    mainScrollView: {
        // Keep default clip behavior
    },
    scrollContent: {
        paddingBottom: 50,
    },
    sectionContainer: {
        marginTop: 20,
        paddingLeft: 40,
        paddingRight: 20,
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
    },
    horizontalList: {
        flexGrow: 0,
    },
    horizontalListContent: {
        paddingVertical: 5,
        paddingRight: 40,
        gap: 12,
    },
    channelCardWrapper: {
        // Wrapper for each card
    },
});


