import React, { useRef } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '../../constants/Colors';

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
const VIDEO_REGEX = /\.(mp4|mp4v|mpv|m1v|m4v|mpg|mpg2|mpeg|xvid|webm|3gp|avi|mov|mkv|ogg|ogv|ogm|m3u8|mpd|ism(?:[vc]|\/manifest)?)(?:[\?#]|$)/i;

const INJECTED_JAVASCRIPT = `
(function() {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  window.open = function() { return null; };
  window.alert = function() { return null; };
  window.confirm = function() { return true; };
  const style = document.createElement('style');
  style.innerHTML = \`
    iframe[src*="ads"], iframe[src*="google"], 
    div[id*="ad"], div[class*="ad"], 
    a[href*="bet"], a[href*="casino"] { display: none !important; }
  \`;
  document.head.appendChild(style);
  var originalOpen = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function(method, url) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'xhr', url: url, headers: { 'Cookie': document.cookie, 'User-Agent': navigator.userAgent, 'Referer': window.location.href, 'Origin': window.location.origin }
    }));
    originalOpen.apply(this, arguments);
  };
  var originalFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = input;
    if (typeof input === 'object' && input.url) url = input.url;
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'fetch', url: url, headers: { 'Cookie': document.cookie, 'User-Agent': navigator.userAgent, 'Referer': window.location.href, 'Origin': window.location.origin }
    }));
    return originalFetch.apply(this, arguments);
  };
})();
`;

interface StreamWebViewProps {
    url: string;
    onStreamDetected: (data: { url: string, headers: any }) => void;
}

export const StreamWebView = ({ url, onStreamDetected }: StreamWebViewProps) => {
    const webViewRef = useRef<WebView>(null);

    const handleMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.url && VIDEO_REGEX.test(data.url)) {
                const headers = data.headers || {};
                if (!headers['User-Agent']) headers['User-Agent'] = USER_AGENT;
                if (!headers['Referer'] && data.headers?.Referer) headers['Referer'] = data.headers.Referer;
                if (!headers['Origin'] && data.headers?.Origin) headers['Origin'] = data.headers.Origin;

                onStreamDetected({ url: data.url, headers: headers });
            }
        } catch (e) { }
    };

    return (
        <View style={styles.webViewContainer}>
            <WebView
                ref={webViewRef}
                source={{ uri: url }}
                userAgent={USER_AGENT}
                injectedJavaScript={INJECTED_JAVASCRIPT}
                onMessage={handleMessage}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                style={{ flex: 1, backgroundColor: '#000' }}
                onShouldStartLoadWithRequest={() => true}
            />
            <View style={styles.overlayIndicator}>
                <Text style={styles.overlayText}>Carregando...</Text>
                <ActivityIndicator size="small" color={Colors.primary} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    webViewContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
    },
    overlayIndicator: {
        position: 'absolute',
        bottom: 40,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        pointerEvents: 'none',
    },
    overlayText: {
        color: '#fff',
        marginRight: 10,
        fontSize: 14,
    },
});
