import React, { useState, useRef } from 'react';
import { View, StyleSheet, Text, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { Video, ResizeMode } from 'expo-av';
import { Stack } from 'expo-router';
import { Colors } from '../../src/constants/Colors';

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";

// Regex from Android-WebCast
const VIDEO_REGEX = /\.(mp4|mp4v|mpv|m1v|m4v|mpg|mpg2|mpeg|xvid|webm|3gp|avi|mov|mkv|ogg|ogv|ogm|m3u8|mpd|ism(?:[vc]|\/manifest)?)(?:[\?#]|$)/i;

const INJECTED_JAVASCRIPT = `
(function() {
  // Hide navigator.webdriver
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined
  });

  // Mock plugins
  Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5]
  });

  // Mock languages
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en']
  });

  // Block Popups and Ads
  window.open = function() { return null; };
  window.alert = function() { return null; };
  window.confirm = function() { return true; };
  
  // Remove common ad elements
  const style = document.createElement('style');
  style.innerHTML = \`
    iframe[src*="ads"], iframe[src*="google"], 
    div[id*="ad"], div[class*="ad"], 
    a[href*="bet"], a[href*="casino"] { 
      display: none !important; 
    }
  \`;
  document.head.appendChild(style);

  // Intercept XMLHttpRequest
  var originalOpen = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function(method, url) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'xhr', 
      url: url,
      headers: {
        'Cookie': document.cookie,
        'User-Agent': navigator.userAgent,
        'Referer': window.location.href,
        'Origin': window.location.origin
      }
    }));
    originalOpen.apply(this, arguments);
  };

  // Intercept fetch
  var originalFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = input;
    if (typeof input === 'object' && input.url) {
      url = input.url;
    }
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'fetch', 
      url: url,
      headers: {
        'Cookie': document.cookie,
        'User-Agent': navigator.userAgent,
        'Referer': window.location.href,
        'Origin': window.location.origin
      }
    }));
    return originalFetch.apply(this, arguments);
  };
})();
`;

export default function StreamTest() {
    const [streamData, setStreamData] = useState<{ url: string, headers: any } | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const webViewRef = useRef<WebView>(null);

    const handleMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.url) {
                // Check if URL matches video regex
                if (VIDEO_REGEX.test(data.url)) {
                    if (!streamData) {
                        const headers = data.headers || {};

                        // Ensure we have the User Agent
                        if (!headers['User-Agent']) {
                            headers['User-Agent'] = USER_AGENT;
                        }

                        // Ensure Referer and Origin are set if missing
                        // (Though they should be coming from the injected JS now)
                        if (!headers['Referer'] && data.headers?.Referer) {
                            headers['Referer'] = data.headers.Referer;
                        }
                        if (!headers['Origin'] && data.headers?.Origin) {
                            headers['Origin'] = data.headers.Origin;
                        }

                        setStreamData({
                            url: data.url,
                            headers: headers
                        });
                        setLogs(prev => [`FOUND STREAM: ${data.url}`, ...prev]);
                    }
                }
            }
        } catch (e) {
            // Ignore parse errors
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.row}>
                {/* Left side: WebView (Visible for interaction) */}
                <View style={styles.webViewContainer}>
                    <WebView
                        ref={webViewRef}
                        source={{ uri: 'https://embedtv.org/cartoonnetwork/' }}
                        userAgent={USER_AGENT}
                        injectedJavaScript={INJECTED_JAVASCRIPT}
                        onMessage={handleMessage}
                        style={styles.webView}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        allowsInlineMediaPlayback={true}
                        mediaPlaybackRequiresUserAction={false}
                        sharedCookiesEnabled={true}
                        thirdPartyCookiesEnabled={true}
                        originWhitelist={['*']}
                        setSupportMultipleWindows={false}
                        onShouldStartLoadWithRequest={(request) => {
                            // Block clicks that would navigate away
                            if (request.navigationType === 'click') {
                                return false;
                            }
                            return true;
                        }}
                    />
                </View>

                {/* Right side: Player & Logs */}
                <View style={styles.playerContainer}>
                    {streamData ? (
                        <Video
                            style={styles.video}
                            source={{
                                uri: streamData.url,
                                headers: streamData.headers
                            }}
                            useNativeControls
                            resizeMode={ResizeMode.CONTAIN}
                            isLooping
                            shouldPlay
                            onError={(e) => setLogs(prev => [`ERROR: ${e}`, ...prev])}
                        />
                    ) : (
                        <View style={styles.placeholder}>
                            <Text style={styles.placeholderText}>Waiting for stream...</Text>
                        </View>
                    )}

                    <View style={styles.logs}>
                        <Text style={styles.logTitle}>Logs:</Text>
                        {logs.map((log, index) => (
                            <Text key={index} style={styles.logText} numberOfLines={1}>{log}</Text>
                        ))}
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    row: {
        flex: 1,
        flexDirection: 'row',
    },
    webViewContainer: {
        flex: 1,
        borderRightWidth: 1,
        borderRightColor: Colors.border,
    },
    webView: {
        flex: 1,
    },
    playerContainer: {
        flex: 1,
        padding: 10,
        justifyContent: 'center',
    },
    video: {
        width: '100%',
        height: 300,
        backgroundColor: '#000',
    },
    placeholder: {
        width: '100%',
        height: 300,
        backgroundColor: '#222',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        color: '#fff',
    },
    logs: {
        marginTop: 10,
        height: 150,
        backgroundColor: '#111',
        padding: 5,
    },
    logTitle: {
        color: '#aaa',
        fontWeight: 'bold',
        marginBottom: 5,
    },
    logText: {
        color: '#0f0',
        fontSize: 10,
        fontFamily: 'monospace',
    },
});
