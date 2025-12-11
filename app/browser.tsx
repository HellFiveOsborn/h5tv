/**
 * Browser Screen - Full-screen browser with stream detection
 * 
 * Features:
 * - Site suggestions grid for quick access
 * - URL navigation and editing
 * - Stream detection via NativeStreamWebView
 * - TV cursor navigation with D-Pad
 * - Hardware back button handling
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    View,
    StyleSheet,
    BackHandler,
    DeviceEventEmitter,
    Platform,
    Dimensions,
    Animated
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { BrowserNavBar, SiteSuggestionsGrid, TVCursor, StreamFAB, CapturedStream } from '../src/components/browser';
import { NativeStreamWebView, NativeStreamWebViewRef } from '../src/components/player/NativeStreamWebView';
import { useTVCursor } from '../src/hooks/useTVCursor';
import { PredefinedSite } from '../src/constants/PredefinedSites';
import { Colors } from '../src/constants/Colors';
import type { StreamHeaders } from '../src/utils/streamInterceptor';

// D-Pad key codes for Android TV
const DPAD_UP = 19;
const DPAD_DOWN = 20;
const DPAD_LEFT = 21;
const DPAD_RIGHT = 22;
const DPAD_CENTER = 23;
const ENTER = 66;
const BACK = 4;

// Cursor injection script for WebView
const CURSOR_INJECTION_SCRIPT = `
  (function() {
    // Remove existing cursor if present
    const existing = document.getElementById('tv-cursor');
    if (existing) existing.remove();
    
    // Create cursor element
    const cursor = document.createElement('div');
    cursor.id = 'tv-cursor';
    cursor.style.cssText = \`
      position: fixed;
      width: 24px;
      height: 24px;
      border: 3px solid #00ff88;
      border-radius: 50%;
      pointer-events: none;
      z-index: 999999;
      transform: translate(-50%, -50%);
      box-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
      transition: transform 0.1s ease-out;
      display: none;
    \`;
    document.body.appendChild(cursor);
    
    // Cursor state
    window.tvCursorX = window.innerWidth / 2;
    window.tvCursorY = window.innerHeight / 2;
    
    // Move cursor function (called from React Native)
    window.moveTVCursor = function(dx, dy) {
      window.tvCursorX = Math.max(0, Math.min(window.innerWidth, window.tvCursorX + dx));
      window.tvCursorY = Math.max(0, Math.min(window.innerHeight, window.tvCursorY + dy));
      cursor.style.left = window.tvCursorX + 'px';
      cursor.style.top = window.tvCursorY + 'px';
      
      // Auto-scroll when near edges
      const threshold = window.innerHeight * 0.15;
      if (window.tvCursorY > window.innerHeight - threshold) {
        window.scrollBy(0, 50);
      } else if (window.tvCursorY < threshold && window.scrollY > 0) {
        window.scrollBy(0, -50);
      }
    };
    
    // Click at cursor position
    window.clickTVCursor = function() {
      const element = document.elementFromPoint(window.tvCursorX, window.tvCursorY);
      if (element) {
        // Visual feedback
        cursor.style.transform = 'translate(-50%, -50%) scale(0.8)';
        setTimeout(() => cursor.style.transform = 'translate(-50%, -50%)', 100);
        
        // Simulate click
        element.click();
        
        // Also dispatch events for React/Vue apps
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: window.tvCursorX,
          clientY: window.tvCursorY
        });
        element.dispatchEvent(clickEvent);
      }
    };
    
    // Show/hide cursor
    window.showTVCursor = function(show) {
      cursor.style.display = show ? 'block' : 'none';
      if (show) {
        cursor.style.left = window.tvCursorX + 'px';
        cursor.style.top = window.tvCursorY + 'px';
      }
    };
    
    // Initial position
    window.moveTVCursor(0, 0);
  })();
  true;
`;

export default function BrowserScreen() {
    const router = useRouter();
    const webViewRef = useRef<NativeStreamWebViewRef>(null);

    // Browser state
    const [currentUrl, setCurrentUrl] = useState('');
    const [pageTitle, setPageTitle] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);
    const [showWebView, setShowWebView] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);

    // TV cursor state
    const [cursorEnabled, setCursorEnabled] = useState(false);
    const [navBarFocused, setNavBarFocused] = useState(true);
    const [isClicking, setIsClicking] = useState(false);

    // Captured streams state
    const [capturedStreams, setCapturedStreams] = useState<CapturedStream[]>([]);

    // Loading progress state
    const [loadingProgress, setLoadingProgress] = useState(0);
    const progressAnim = useRef(new Animated.Value(0)).current;

    const screenDimensions = Dimensions.get('window');
    const cursor = useTVCursor({
        speed: 25,
        bounds: { width: screenDimensions.width, height: screenDimensions.height - 60 } // Subtract nav bar height
    });

    // Handle site selection from suggestions
    const handleSiteSelect = useCallback((site: PredefinedSite) => {
        setShowSuggestions(false);
        setCurrentUrl(site.url);
        setPageTitle(site.name);
        setShowWebView(true);
    }, []);

    // Handle URL submission from nav bar
    const handleUrlSubmit = useCallback((url: string) => {
        setShowSuggestions(false);
        setCurrentUrl(url);
        setShowWebView(true);
    }, []);

    // Determine stream type from URL
    const getStreamType = useCallback((url: string): string => {
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('.m3u8') || lowerUrl.includes('/manifest')) return 'm3u8';
        if (lowerUrl.includes('.mpd')) return 'mpd';
        if (lowerUrl.includes('.mp4')) return 'mp4';
        if (lowerUrl.includes('googlevideo.com')) return 'youtube';
        return 'stream';
    }, []);

    // Handle stream detection - collect streams instead of navigating immediately
    const handleStreamDetected = useCallback((data: { url: string; headers: StreamHeaders }) => {
        console.log('[Browser] Stream detected:', data.url);

        // Check if stream already exists (avoid duplicates)
        setCapturedStreams(prev => {
            const exists = prev.some(s => s.url === data.url);
            if (exists) {
                console.log('[Browser] Stream already captured, skipping:', data.url);
                return prev;
            }

            const newStream: CapturedStream = {
                url: data.url,
                headers: data.headers,
                type: getStreamType(data.url),
                timestamp: new Date(),
            };

            console.log('[Browser] Adding stream to collection:', newStream.type);
            return [...prev, newStream];
        });
    }, [getStreamType]);

    // Handle stream selection from FAB - navigate to player
    const handleSelectStream = useCallback((stream: CapturedStream) => {
        console.log('[Browser] Stream selected:', stream.url);

        router.replace({
            pathname: '/stream',
            params: {
                name: pageTitle || 'Browser Stream',
                logo: '',
                urls: JSON.stringify([stream.url]),
                guide: '',
                meuGuiaTv: '',
                category: 'Browser',
                fromBrowser: 'true'
            }
        });
    }, [pageTitle, router]);

    // Handle clearing all captured streams
    const handleClearStreams = useCallback(() => {
        console.log('[Browser] Clearing all captured streams');
        setCapturedStreams([]);
        webViewRef.current?.clearDetectedUrls();
    }, []);

    // Navigation handlers
    const handleGoBack = useCallback(() => {
        if (canGoBack) {
            webViewRef.current?.goBack();
        }
    }, [canGoBack]);

    const handleGoForward = useCallback(() => {
        if (canGoForward) {
            webViewRef.current?.goForward();
        }
    }, [canGoForward]);

    const handleReload = useCallback(() => {
        if (isLoading) {
            webViewRef.current?.stopLoading();
        } else {
            webViewRef.current?.reload();
        }
    }, [isLoading]);

    const handleClose = useCallback(() => {
        router.back();
    }, [router]);

    // Animate progress bar
    useEffect(() => {
        Animated.timing(progressAnim, {
            toValue: loadingProgress,
            duration: 150,
            useNativeDriver: false,
        }).start();
    }, [loadingProgress, progressAnim]);

    // WebView event handlers
    const handleLoadStart = useCallback(() => {
        setIsLoading(true);
        setLoadingProgress(0.1); // Start with small progress
    }, []);

    const handleLoadEnd = useCallback((loadedUrl: string) => {
        setIsLoading(false);
        setLoadingProgress(1);
        // Hide progress bar after short delay
        setTimeout(() => setLoadingProgress(0), 300);

        // Update current URL to reflect actual loaded page
        if (loadedUrl) {
            setCurrentUrl(loadedUrl);
        }

        // Inject cursor script when page loads
        if (cursorEnabled) {
            webViewRef.current?.injectJavaScript(CURSOR_INJECTION_SCRIPT);
            webViewRef.current?.injectJavaScript('window.showTVCursor(true); true;');
        }
    }, [cursorEnabled]);

    // Handle navigation state changes (canGoBack, canGoForward, URL updates)
    const handleNavigationStateChange = useCallback((state: {
        url: string;
        canGoBack: boolean;
        canGoForward: boolean;
        title?: string
    }) => {
        console.log('[Browser] Navigation state changed:', state);

        // Update URL in navbar
        if (state.url) {
            setCurrentUrl(state.url);
        }

        // Update navigation button states
        setCanGoBack(state.canGoBack);
        setCanGoForward(state.canGoForward);

        // Update page title if provided
        if (state.title) {
            setPageTitle(state.title);
        }
    }, []);

    // Handle errors - DO NOT reload on 403 errors (Cloudflare captcha)
    const handleError = useCallback((error: string) => {
        console.log('[Browser] Error:', error);
        setIsLoading(false);
        setLoadingProgress(0);

        // Specifically ignore 403 errors - these are often Cloudflare challenges
        // that the user needs to solve manually. Do NOT trigger any reload.
        if (error.includes('http_403') || error.includes('403')) {
            console.log('[Browser] 403 error detected - letting user handle Cloudflare challenge');
            // Do nothing - let the page stay as is so user can solve captcha
            return;
        }

        // For other errors, we could show a toast or error message, but don't reload
        // This prevents infinite reload loops
    }, []);

    // Inject cursor into WebView when enabled
    const enableWebViewCursor = useCallback(() => {
        webViewRef.current?.injectJavaScript(CURSOR_INJECTION_SCRIPT);
        webViewRef.current?.injectJavaScript('window.showTVCursor(true); true;');
    }, []);

    const disableWebViewCursor = useCallback(() => {
        webViewRef.current?.injectJavaScript('window.showTVCursor(false); true;');
    }, []);

    const moveWebViewCursor = useCallback((dx: number, dy: number) => {
        webViewRef.current?.injectJavaScript(`window.moveTVCursor(${dx}, ${dy}); true;`);
    }, []);

    const clickWebViewCursor = useCallback(() => {
        webViewRef.current?.injectJavaScript('window.clickTVCursor(); true;');
        setIsClicking(true);
        setTimeout(() => setIsClicking(false), 150);
    }, []);

    // TV D-Pad key event handling
    useEffect(() => {
        if (Platform.OS !== 'android') return;

        const handleKeyDown = (event: { keyCode: number }) => {
            const { keyCode } = event;

            // Only handle cursor mode when WebView is visible and nav bar is not focused
            if (!showWebView || showSuggestions) return;

            if (!cursorEnabled && !navBarFocused) {
                // Enable cursor mode when pressing down from nav bar
                if (keyCode === DPAD_DOWN) {
                    setCursorEnabled(true);
                    cursor.enable();
                    enableWebViewCursor();
                    return;
                }
            }

            if (!cursorEnabled) return;

            const CURSOR_SPEED = 25;

            switch (keyCode) {
                case DPAD_UP:
                    cursor.move('up');
                    moveWebViewCursor(0, -CURSOR_SPEED);
                    break;
                case DPAD_DOWN:
                    cursor.move('down');
                    moveWebViewCursor(0, CURSOR_SPEED);
                    break;
                case DPAD_LEFT:
                    cursor.move('left');
                    moveWebViewCursor(-CURSOR_SPEED, 0);
                    break;
                case DPAD_RIGHT:
                    cursor.move('right');
                    moveWebViewCursor(CURSOR_SPEED, 0);
                    break;
                case DPAD_CENTER:
                case ENTER:
                    clickWebViewCursor();
                    break;
            }
        };

        const subscription = DeviceEventEmitter.addListener('onKeyDown', handleKeyDown);
        return () => subscription.remove();
    }, [showWebView, showSuggestions, cursorEnabled, navBarFocused, cursor, enableWebViewCursor, moveWebViewCursor, clickWebViewCursor]);

    // Hardware back button handling
    useEffect(() => {
        const backAction = () => {
            // If cursor mode is enabled, disable it first
            if (cursorEnabled) {
                setCursorEnabled(false);
                cursor.disable();
                disableWebViewCursor();
                return true;
            }

            // If suggestions are showing, close browser
            if (showSuggestions) {
                router.back();
                return true;
            }

            // If WebView can go back, do so
            if (canGoBack) {
                webViewRef.current?.goBack();
                return true;
            }

            // Otherwise show suggestions
            setShowWebView(false);
            setShowSuggestions(true);
            setCurrentUrl('');
            setPageTitle('');
            return true;
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [cursorEnabled, showSuggestions, canGoBack, cursor, disableWebViewCursor, router]);

    // Toggle cursor when nav bar focus changes
    useEffect(() => {
        if (navBarFocused && cursorEnabled) {
            setCursorEnabled(false);
            cursor.disable();
            disableWebViewCursor();
        }
    }, [navBarFocused, cursorEnabled, cursor, disableWebViewCursor]);

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Navigation Bar */}
            <BrowserNavBar
                url={currentUrl}
                pageTitle={pageTitle}
                isLoading={isLoading}
                canGoBack={canGoBack}
                canGoForward={canGoForward}
                onBack={handleGoBack}
                onForward={handleGoForward}
                onReload={handleReload}
                onClose={handleClose}
                onUrlSubmit={handleUrlSubmit}
                onFocusChange={setNavBarFocused}
            />

            {/* Content Area */}
            <View style={styles.webViewContainer}>
                {showSuggestions ? (
                    /* Site Suggestions - rendered inline in content area */
                    <SiteSuggestionsGrid
                        onSiteSelect={handleSiteSelect}
                    />
                ) : showWebView && currentUrl ? (
                    /* WebView with TV Cursor */
                    <>
                        {/* Loading Progress Bar */}
                        {loadingProgress > 0 && (
                            <View style={styles.progressBarContainer}>
                                <Animated.View
                                    style={[
                                        styles.progressBar,
                                        {
                                            width: progressAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: ['0%', '100%'],
                                            }),
                                        },
                                    ]}
                                />
                            </View>
                        )}
                        <NativeStreamWebView
                            ref={webViewRef}
                            url={currentUrl}
                            onStreamDetected={handleStreamDetected}
                            onLoadStart={handleLoadStart}
                            onLoadEnd={handleLoadEnd}
                            onNavigationStateChange={handleNavigationStateChange}
                            onError={handleError}
                        />
                        {/* TV Cursor Overlay - rendered on top of WebView */}
                        <TVCursor
                            visible={cursorEnabled}
                            position={cursor.position}
                            isClicking={isClicking}
                        />

                        {/* Stream Collection FAB */}
                        <StreamFAB
                            streams={capturedStreams}
                            onSelectStream={handleSelectStream}
                            onClearStreams={handleClearStreams}
                        />
                    </>
                ) : (
                    <View style={styles.emptyState} />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    webViewContainer: {
        flex: 1,
        position: 'relative',
    },
    progressBarContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        zIndex: 10,
    },
    progressBar: {
        height: '100%',
        backgroundColor: Colors.primary,
    },
    emptyState: {
        flex: 1,
        backgroundColor: Colors.surface,
    },
});