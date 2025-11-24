import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Dimensions, Alert, Platform } from 'react-native';
import { Colors } from '../src/constants/Colors';
import { SplashScreen } from '../src/components/SplashScreen';
import { GameSlider } from '../src/components/GameSlider';
import { ChannelList } from '../src/components/ChannelList';
import { Sidebar } from '../src/components/Sidebar';
import { TopBar } from '../src/components/TopBar';
import { SettingsScreen } from '../src/components/SettingsScreen';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { syncTimeWithServer } from '../src/services/timeService';
import { StorageKeys } from '../src/constants/StorageKeys';
// import { IntentLauncherAndroid } from 'expo'; // Removed unused import
import * as Linking from 'expo-linking';

const { width } = Dimensions.get('window');

export default function Home() {
    const [isSplashVisible, setSplashVisible] = useState(true);
    const [currentScreen, setCurrentScreen] = useState('home');

    useEffect(() => {
        // Sync time when app starts
        syncTimeWithServer();

        checkWifiSettings();
        const timer = setTimeout(() => {
            setSplashVisible(false);
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

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
                <TopBar />

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <GameSlider />

                    {/* Next Broadcasts Section */}
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionTitle}>Próximas Transmissões</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalList}>
                            {/* Mock Data for Next Broadcasts */}
                            {[1, 2, 3, 4].map((item) => (
                                <View key={item} style={styles.nextGameCard}>
                                    <Image
                                        source={{ uri: 'https://img.freepik.com/free-photo/soccer-stadium-night-generative-ai_188544-8056.jpg' }}
                                        style={styles.nextGameImage}
                                    />
                                    <View style={styles.nextGameOverlay}>
                                        <Text style={styles.nextGameText}>Palmeiras x Flamengo</Text>
                                        <Text style={styles.nextGameTime}>Amanhã, 21:30</Text>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </ScrollView>
            </LinearGradient>
        );
    };

    return (
        <View style={styles.container}>
            {isSplashVisible && <SplashScreen />}

            {/* Main Layout: Sidebar + Content */}
            <View style={styles.mainLayout}>
                <Sidebar activeRoute={currentScreen} onNavigate={setCurrentScreen} />

                {/* Right Side Content */}
                <View style={styles.contentContainer}>
                    {renderContent()}
                </View>
            </View>
        </View>
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
    },
    nextGameCard: {
        width: 200,
        height: 120,
        marginRight: 15,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#222',
    },
    nextGameImage: {
        width: '100%',
        height: '100%',
        opacity: 0.6,
    },
    nextGameOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    nextGameText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    nextGameTime: {
        color: '#ccc',
        fontSize: 12,
    },
});


