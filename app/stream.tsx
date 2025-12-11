import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableWithoutFeedback, Animated, BackHandler, ActivityIndicator, Platform } from 'react-native';
import Video, { ResizeMode, VideoRef, OnBufferData, OnLoadData } from 'react-native-video';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Channel } from '../src/services/channelService';
import { fetchCurrentProgram, ProgramInfo } from '../src/services/guideService';
import { syncTimeWithServer } from '../src/services/timeService';
import { detectStreamType, extractStreamUrl } from '../src/utils/streamInterceptor';
import { ChannelListOverlay } from '../src/components/ChannelListOverlay';
import { StreamWebView } from '../src/components/player/StreamWebView';
import { PlayerOverlay } from '../src/components/player/PlayerOverlay';
import { ConnectionInfo } from '../src/components/player/ConnectionInfo';
import { Colors } from '../src/constants/Colors';

export default function StreamScreen() {
    const params = useLocalSearchParams();
    const router = useRouter();

    // Initial Params
    // Check if stream originated from browser mode
    const isFromBrowser = params.fromBrowser === 'true';

    const [currentChannel, setCurrentChannel] = useState<Partial<Channel>>({
        name: params.name as string,
        logo: params.logo as string,
        url: params.urls ? JSON.parse(params.urls as string) : [],
        guide: params.guide as string,
        meuGuiaTv: params.meuGuiaTv as string,
        category: params.category as string
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

            // Check double press FIRST - always go back on double press
            if (now - lastBackPress.current < DOUBLE_PRESS_DELAY) {
                // Double press detected - Go back to channel list screen
                router.back();
                return true;
            }

            // Update last press time
            lastBackPress.current = now;

            // Single press handling
            if (channelListVisible) {
                setChannelListVisible(false);
                return true;
            }

            if (uiVisible) {
                hideUi();
                return true;
            }

            // Single press with nothing visible - Show Channel List
            setChannelListVisible(true);
            return true;
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
        if (isOverlayFocused) {
            console.log('[UI] Auto-hide paused - overlay is focused');
            return;
        }

        console.log('[UI] Setting auto-hide timeout (5s)');
        const timeout = setTimeout(() => {
            console.log('[UI] Auto-hiding overlay');
            hideUi();
        }, 5000); // 5 seconds - faster hide when not interacting
        setUiTimeout(timeout);
    };

    // React to focus changes to pause/resume auto-hide
    useEffect(() => {
        if (uiVisible) {
            if (isOverlayFocused) {
                console.log('[UI] Focus detected - clearing timeout');
                if (uiTimeout) clearTimeout(uiTimeout);
            } else {
                console.log('[UI] Focus lost - resetting timeout');
                resetUiTimeout();
            }
        }
    }, [isOverlayFocused, uiVisible]);

    // Safety: Always hide UI after max time even if focused
    useEffect(() => {
        if (!uiVisible) return;

        const maxTimeout = setTimeout(() => {
            console.log('[UI] Max time reached - force hiding');
            hideUi();
        }, 30000); // 30 seconds max

        return () => clearTimeout(maxTimeout);
    }, [uiVisible]);

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
                    {/* WebView - key forces complete destruction on channel/URL change */}
                    {webViewVisible && currentUrl ? (
                        <StreamWebView
                            key={`webview-${currentChannel.name}-${currentUrlIndex}`}
                            url={currentUrl}
                            onStreamDetected={handleStreamDetected}
                        />
                    ) : null}

                    {/* Native Player - key forces complete destruction on stream change */}
                    {!webViewVisible && streamData ? (
                        <StreamPlayer
                            key={`player-${currentChannel.name}-${currentUrlIndex}-${streamData.url}`}
                            url={extractStreamUrl(streamData.url)}
                            headers={streamData.headers}
                        />
                    ) : null}
                </View>
            </TouchableWithoutFeedback>

            {/* Connection Info - Always visible in bottom left */}
            <View style={styles.connectionInfoContainer} pointerEvents="none">
                <ConnectionInfo />
            </View>

            {/* Bottom UI Overlay - Only show when NOT from browser mode */}
            {!isFromBrowser && (
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
            )}

            {/* Channel List Overlay - Only show when NOT from browser mode */}
            {!isFromBrowser && (
                <ChannelListOverlay
                    visible={channelListVisible}
                    onClose={() => setChannelListVisible(false)}
                    onChannelSelect={handleChannelSelect}
                    onExit={() => router.back()}
                    initialCategory={currentChannel.category}
                />
            )}
        </View>
    );
}

// Consistent User-Agent for all video player requests (matches WebView interception)
const PLAYER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

// Buffer configuration for TV/TV Box (stable WiFi, good hardware)
const TV_BUFFER_CONFIG = {
    minBufferMs: 30000,      // 30s - larger initial buffer
    maxBufferMs: 120000,     // 2min - can store more
    bufferForPlaybackMs: 5000,  // 5s - start faster with more buffer
    bufferForPlaybackAfterRebufferMs: 10000, // 10s - recover better
    backBufferDurationMs: 30000,  // 30s back buffer
    cacheSizeMB: 0,          // No cache for live streams
    live: {
        targetOffsetMs: 3000,  // Closer to live edge
    },
};

// Buffer configuration for Mobile (variable network, limited resources)
const MOBILE_BUFFER_CONFIG = {
    minBufferMs: 15000,      // 15s
    maxBufferMs: 50000,      // 50s
    bufferForPlaybackMs: 2500,  // 2.5s - quick start
    bufferForPlaybackAfterRebufferMs: 5000, // 5s
    backBufferDurationMs: 15000,  // 15s
    cacheSizeMB: 0,          // No cache for live streams
    live: {
        targetOffsetMs: 5000,  // Slightly behind live
    },
};

// Separate component for video player
function StreamPlayer({ url, headers }: { url: string, headers: any }) {
    const videoRef = useRef<VideoRef>(null);
    // Pass headers to detectStreamType for better detection via Content-Type
    // Memoize streamType to prevent re-calculations
    const streamType = useMemo(() => detectStreamType(url, headers), [url, headers]);
    const hasLoggedRef = useRef(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasTimedOut, setHasTimedOut] = useState(false);

    // Device-aware player configuration
    const playerConfig = useMemo(() => {
        const isTV = Platform.isTV;

        console.log('[Player] Using', isTV ? 'TV' : 'Mobile', 'configuration');

        return {
            bufferConfig: isTV ? TV_BUFFER_CONFIG : MOBILE_BUFFER_CONFIG,
            // Limit bitrate for mobile to save battery/prevent overheating
            maxBitRate: isTV ? undefined : 4000000, // 4Mbps limit for mobile
            // TV can use cover mode for full screen, mobile uses contain to avoid cropping
            resizeMode: isTV ? ResizeMode.COVER : ResizeMode.CONTAIN,
        };
    }, []);

    // Log only once per URL
    useEffect(() => {
        if (!hasLoggedRef.current) {
            console.log('[Video] Playing:', url, 'Type:', streamType);
            hasLoggedRef.current = true;
        }
        return () => {
            hasLoggedRef.current = false;
        };
    }, [url, streamType]);

    // Playback timeout detection - detects if stream is stuck buffering
    useEffect(() => {
        let timeout: NodeJS.Timeout | null = null;

        if (isBuffering && !isPlaying && !hasTimedOut) {
            timeout = setTimeout(() => {
                console.log('[Video] Playback timeout (15s) - stream may be incompatible or server rejected request');
                setHasTimedOut(true);
            }, 15000);
        }

        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, [url, isBuffering, isPlaying, hasTimedOut]);

    // Reset timeout state when URL changes
    useEffect(() => {
        setHasTimedOut(false);
        setIsPlaying(false);
    }, [url]);

    // Callbacks for video events
    const onBuffer = useCallback((data: OnBufferData) => {
        setIsBuffering(data.isBuffering);
        if (data.isBuffering) {
            console.log('[Video] Buffering...');
        }
    }, []);

    const onError = useCallback((error: { error: { errorString?: string; errorCode?: string } }) => {
        console.log('[Video] Error:', error.error?.errorString || error.error?.errorCode || 'Unknown error');
    }, []);

    const onLoad = useCallback((data: OnLoadData) => {
        console.log('[Video] Loaded, duration:', data.duration);
        setIsBuffering(false);
        setIsPlaying(true);
        setHasTimedOut(false);
    }, []);

    const onLoadStart = useCallback(() => {
        console.log('[Video] Load started');
        setIsBuffering(true);
    }, []);

    // Helper function to extract host from URL
    const getHostFromUrl = useCallback((urlString: string): string => {
        try {
            const urlObj = new URL(urlString);
            return urlObj.host.toLowerCase();
        } catch {
            return '';
        }
    }, []);

    // Helper function to construct Referer from URL's origin
    const getRefererFromUrl = useCallback((streamUrl: string): string => {
        try {
            const urlObj = new URL(streamUrl);
            return `${urlObj.protocol}//${urlObj.host}/`;
        } catch {
            return '';
        }
    }, []);

    // Helper function to construct Origin from URL
    const getOriginFromUrl = useCallback((streamUrl: string): string => {
        try {
            const urlObj = new URL(streamUrl);
            return `${urlObj.protocol}//${urlObj.host}`;
        } catch {
            return '';
        }
    }, []);

    // Build headers with consistent User-Agent and proper Referer
    const videoHeaders = useMemo(() => {
        // Get provided Referer/Origin from headers
        const providedReferer = headers?.Referer || headers?.referer || '';
        const providedOrigin = headers?.Origin || headers?.origin || '';

        // Get the stream URL's host for comparison
        const streamHost = getHostFromUrl(url);
        const refererHost = providedReferer ? getHostFromUrl(providedReferer) : '';

        // Construct fallback Referer from stream URL if:
        // 1. Provided Referer is empty, OR
        // 2. Provided Referer is from a different domain than the stream URL
        //    (this happens when stream is extracted from a player wrapper like
        //    guiacanais.alwaysdata.net/iptvplayer/vjs.html?url=http://stream.server/...)
        //    Many stream servers reject requests with Referer from different domains
        let finalReferer = providedReferer;
        const isDifferentDomain = refererHost && streamHost &&
            !refererHost.includes(streamHost) && !streamHost.includes(refererHost);

        if (!providedReferer || providedReferer.trim() === '') {
            finalReferer = getRefererFromUrl(url);
            console.log('[Video] Empty Referer detected, using stream origin:', finalReferer);
        } else if (isDifferentDomain) {
            finalReferer = getRefererFromUrl(url);
            console.log('[Video] Referer domain mismatch (', refererHost, '!=', streamHost, '), using stream origin:', finalReferer);
        }

        // Construct fallback Origin from stream URL if provided one is empty or mismatched
        let finalOrigin = providedOrigin;
        const originHost = providedOrigin ? getHostFromUrl(providedOrigin) : '';
        const isOriginMismatch = originHost && streamHost &&
            !originHost.includes(streamHost) && !streamHost.includes(originHost);

        if (!providedOrigin || providedOrigin.trim() === '' || isOriginMismatch) {
            finalOrigin = getOriginFromUrl(url);
        }

        // Log critical headers for debugging
        if (!hasLoggedRef.current) {
            console.log('[Video] Using headers:', {
                'User-Agent': PLAYER_USER_AGENT,
                'Referer': finalReferer,
                'Origin': finalOrigin
            });
        }

        return {
            'User-Agent': PLAYER_USER_AGENT,
            'Referer': finalReferer,
            'Origin': finalOrigin,
            ...headers,
            // Override any empty/mismatched Referer/Origin from headers spread
            ...(finalReferer ? { 'Referer': finalReferer } : {}),
            ...(finalOrigin ? { 'Origin': finalOrigin } : {}),
        };
    }, [headers, url, getHostFromUrl, getRefererFromUrl, getOriginFromUrl]);

    return (
        <View style={styles.videoContainer}>
            <Video
                ref={videoRef}
                source={{
                    uri: url,
                    headers: videoHeaders,
                    type: streamType,
                }}
                style={styles.video}
                resizeMode={playerConfig.resizeMode}
                controls={false}
                repeat={true}
                paused={false}
                playInBackground={false}
                playWhenInactive={false}
                volume={1.0}
                muted={false}
                rate={1.0}
                // Disable LIVE badge and notification controls (Android)
                showNotificationControls={false}
                hideShutterView={true}
                disableFocus={true}
                // Mobile compatibility settings
                ignoreSilentSwitch="ignore"
                preventsDisplaySleepDuringVideoPlayback={true}
                allowsExternalPlayback={false}
                automaticallyWaitsToMinimizeStalling={true}
                // Device-aware buffer configuration
                bufferConfig={playerConfig.bufferConfig}
                // Bitrate limit for mobile devices (battery/heat management)
                maxBitRate={playerConfig.maxBitRate}
                // Additional Android ExoPlayer settings
                subtitleStyle={{ opacity: 0 }}
                onBuffer={onBuffer}
                onError={onError}
                onLoad={onLoad}
                onLoadStart={onLoadStart}
            />
            {isBuffering && (
                <View style={styles.bufferingContainer}>
                    <ActivityIndicator size="large" color={Colors.text} />
                </View>
            )}
        </View>
    );
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoContainer: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
    },
    video: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
    },
    bufferingContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    connectionInfoContainer: {
        position: 'absolute',
        bottom: 15,
        left: 15,
    },
});

