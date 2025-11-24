import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableWithoutFeedback, Animated, BackHandler } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Channel } from '../src/services/channelService';
import { fetchCurrentProgram, ProgramInfo } from '../src/services/guideService';
import { syncTimeWithServer } from '../src/services/timeService';
import { ChannelListOverlay } from '../src/components/ChannelListOverlay';
import { StreamWebView } from '../src/components/player/StreamWebView';
import { PlayerOverlay } from '../src/components/player/PlayerOverlay';
import { ConnectionInfo } from '../src/components/player/ConnectionInfo';

export default function StreamScreen() {
    const params = useLocalSearchParams();
    const router = useRouter();

    // Initial Params
    const [currentChannel, setCurrentChannel] = useState<Partial<Channel>>({
        name: params.name as string,
        logo: params.logo as string,
        url: params.urls ? JSON.parse(params.urls as string) : [],
        guide: params.guide as string,
        meuGuiaTv: params.meuGuiaTv as string
    });

    const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
    const [streamData, setStreamData] = useState<{ url: string, headers: any } | null>(null);
    const [webViewVisible, setWebViewVisible] = useState(true);

    // UI State
    const [uiVisible, setUiVisible] = useState(false);
    const [channelListVisible, setChannelListVisible] = useState(false);
    const [programInfo, setProgramInfo] = useState<ProgramInfo | null>(null);
    const [currentTime, setCurrentTime] = useState('');
    const [uiTimeout, setUiTimeout] = useState<NodeJS.Timeout | null>(null);
    const [isOverlayFocused, setIsOverlayFocused] = useState(false);
    const timeOffset = useRef(0);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const lastBackPress = useRef(0);

    const currentUrl = currentChannel.url ? currentChannel.url[currentUrlIndex] : '';

    // Clock
    useEffect(() => {
        const initTime = async () => {
            timeOffset.current = await syncTimeWithServer();
            updateTime();
        };

        const updateTime = () => {
            const now = new Date(Date.now() + timeOffset.current);
            setCurrentTime(now.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Sao_Paulo'
            }));
        };

        initTime();
        const interval = setInterval(updateTime, 1000 * 60);
        return () => clearInterval(interval);
    }, []);

    // Reset state when channel changes
    useEffect(() => {
        setStreamData(null);
        setWebViewVisible(true);
        setCurrentUrlIndex(0);
    }, [currentChannel.name]);

    // Reset stream data when URL index changes
    useEffect(() => {
        if (currentUrlIndex > 0) {
            setStreamData(null);
            setWebViewVisible(true);
        }
    }, [currentUrlIndex]);

    // Fetch Program Guide
    useEffect(() => {
        let isMounted = true;
        setProgramInfo(null);

        // Use meuGuiaTv if available, otherwise fall back to guide
        const guideUrl = currentChannel.meuGuiaTv || currentChannel.guide;

        if (guideUrl) {
            fetchCurrentProgram(guideUrl).then(info => {
                if (isMounted && info) {
                    setProgramInfo(info);
                }
            });
        }

        return () => { isMounted = false; };
    }, [currentChannel.meuGuiaTv, currentChannel.guide]);

    // Back Handler Logic
    useEffect(() => {
        const backAction = () => {
            const now = Date.now();
            const DOUBLE_PRESS_DELAY = 300; // ms

            if (channelListVisible) {
                setChannelListVisible(false);
                return true;
            }

            if (uiVisible) {
                hideUi();
                return true;
            }

            if (now - lastBackPress.current < DOUBLE_PRESS_DELAY) {
                // Double press detected - Exit
                return false; // Let default behavior happen (exit)
            } else {
                lastBackPress.current = now;
                // Single press - Show Channel List
                setChannelListVisible(true);
                return true;
            }
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [channelListVisible, uiVisible]);

    // UI Toggle Logic
    const showUi = () => {
        setUiVisible(true);
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();

        resetUiTimeout();
    };

    const resetUiTimeout = () => {
        if (uiTimeout) clearTimeout(uiTimeout);

        // Don't auto-hide if user is interacting with the overlay
        if (isOverlayFocused) return;

        const timeout = setTimeout(() => {
            hideUi();
        }, 8000); // Increased to 8 seconds
        setUiTimeout(timeout);
    };

    // React to focus changes to pause/resume auto-hide
    useEffect(() => {
        if (uiVisible) {
            if (isOverlayFocused) {
                if (uiTimeout) clearTimeout(uiTimeout);
            } else {
                resetUiTimeout();
            }
        }
    }, [isOverlayFocused]);

    const hideUi = () => {
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start(() => setUiVisible(false));
    };

    const toggleUi = () => {
        if (uiVisible) {
            hideUi();
        } else {
            showUi();
        }
    };

    const handleStreamDetected = (data: { url: string, headers: any }) => {
        if (!streamData) {
            setStreamData(data);
            setWebViewVisible(false);
        }
    };

    const handleChannelSelect = (channel: Channel) => {
        setCurrentChannel(channel);
        setChannelListVisible(false);
    };

    const handleSourceSwitch = () => {
        if (currentChannel.url) {
            const nextIndex = (currentUrlIndex + 1) % currentChannel.url.length;
            setCurrentUrlIndex(nextIndex);
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <TouchableWithoutFeedback onPress={toggleUi}>
                <View style={styles.content}>
                    {/* WebView */}
                    {webViewVisible && currentUrl ? (
                        <StreamWebView
                            url={currentUrl}
                            onStreamDetected={handleStreamDetected}
                        />
                    ) : null}

                    {/* Native Player */}
                    {!webViewVisible && streamData ? (
                        <Video
                            style={styles.video}
                            source={{ uri: streamData.url, headers: streamData.headers }}
                            resizeMode={ResizeMode.CONTAIN}
                            isLooping
                            shouldPlay
                            onError={(e) => console.log('Video Error:', e)}
                        />
                    ) : null}
                </View>
            </TouchableWithoutFeedback>

            {/* Connection Info - Always visible in bottom left */}
            <View style={styles.connectionInfoContainer} pointerEvents="none">
                <ConnectionInfo />
            </View>

            {/* Bottom UI Overlay */}
            <PlayerOverlay
                visible={uiVisible}
                fadeAnim={fadeAnim}
                currentChannel={currentChannel}
                programInfo={programInfo}
                currentTime={currentTime}
                currentUrlIndex={currentUrlIndex}
                totalUrls={currentChannel.url?.length || 0}
                onSourceSwitch={handleSourceSwitch}
                onFocusChange={setIsOverlayFocused}
            />

            {/* Channel List Overlay */}
            <ChannelListOverlay
                visible={channelListVisible}
                onClose={() => setChannelListVisible(false)}
                onChannelSelect={handleChannelSelect}
                onExit={() => router.back()}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    video: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
    },
    connectionInfoContainer: {
        position: 'absolute',
        bottom: 15,
        left: 15,
    },
});

