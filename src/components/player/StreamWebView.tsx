import React, { useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Platform } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { Colors } from '../../constants/Colors';

// Import do módulo centralizado
import {
  USER_AGENT,
  VIDEO_REGEX,
  isAdUrl,
  isValidStreamUrl,
  generateInjectedJavaScript,
  type StreamHeaders,
} from '../../utils/streamInterceptor';

// Import do componente nativo Android
import { NativeStreamWebView } from './NativeStreamWebView';

// Script injetado gerado pelo módulo compartilhado (usado apenas no fallback)
const INJECTED_JAVASCRIPT = generateInjectedJavaScript();

interface StreamWebViewProps {
  url: string;
  onStreamDetected: (data: { url: string; headers: StreamHeaders }) => void;
  /**
   * Se true, força o uso do WebView JS mesmo no Android.
   * Útil para debugging ou sites que não funcionam bem com o WebView nativo.
   * @default false
   */
  forceJsWebView?: boolean;
}

/**
 * StreamWebView - Componente inteligente que escolhe a melhor implementação
 *
 * No Android: Usa o StreamInterceptorWebView nativo (Kotlin) que:
 * - Intercepta TODAS as requisições de rede via shouldInterceptRequest
 * - Funciona com cross-origin iframes
 * - Tem bypass de Cloudflare embutido
 * - Persiste cookies automaticamente
 *
 * No iOS (ou com forceJsWebView=true): Usa o WebView com injeção JavaScript
 */
export const StreamWebView = ({
  url,
  onStreamDetected,
  forceJsWebView = false,
}: StreamWebViewProps) => {
  // No Android, usar o WebView nativo (a menos que forceJsWebView seja true)
  const useNativeWebView = Platform.OS === 'android' && !forceJsWebView;

  if (useNativeWebView) {
    return (
      <NativeStreamWebView
        url={url}
        onStreamDetected={onStreamDetected}
      />
    );
  }

  // Fallback para implementação com JavaScript injection
  return (
    <JSStreamWebView
      url={url}
      onStreamDetected={onStreamDetected}
    />
  );
};

/**
 * Implementação com injeção JavaScript (fallback)
 * Usado no iOS ou quando forceJsWebView=true
 */
const JSStreamWebView = ({
  url,
  onStreamDetected,
}: Omit<StreamWebViewProps, 'forceJsWebView'>) => {
  const webViewRef = useRef<WebView>(null);
  const detectedUrlsRef = useRef<Set<string>>(new Set());

  // Clear detected URLs when main URL changes
  useEffect(() => {
    detectedUrlsRef.current.clear();
  }, [url]);

  // Handle messages from injected JavaScript (XHR, fetch, video elements)
  const handleMessage = useCallback(
    (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.url && isValidStreamUrl(data.url)) {
          // Avoid duplicate detections
          if (detectedUrlsRef.current.has(data.url)) return;
          detectedUrlsRef.current.add(data.url);

          const headers: StreamHeaders = data.headers || {};
          if (!headers['User-Agent']) headers['User-Agent'] = USER_AGENT;
          if (!headers['Referer']) headers['Referer'] = url;
          if (!headers['Origin']) {
            try {
              const urlObj = new URL(url);
              headers['Origin'] = urlObj.origin;
            } catch (e) {}
          }

          console.log(`[StreamWebView JS] Detected stream via ${data.type}:`, data.url);
          onStreamDetected({ url: data.url, headers: headers });
        }
      } catch (e) {}
    },
    [url, onStreamDetected]
  );

  // Intercept all navigation requests (including iframes) to detect video URLs and block ads
  const handleShouldStartLoadWithRequest = useCallback(
    (request: WebViewNavigation): boolean => {
      const requestUrl = request.url;

      // Block ad URLs
      if (isAdUrl(requestUrl)) {
        console.log('[StreamWebView JS] Blocked ad URL:', requestUrl);
        return false;
      }

      // Block external app intents (prevents opening browser)
      if (
        !requestUrl.startsWith('http://') &&
        !requestUrl.startsWith('https://') &&
        !requestUrl.startsWith('about:') &&
        !requestUrl.startsWith('data:')
      ) {
        console.log('[StreamWebView JS] Blocked external URL:', requestUrl);
        return false;
      }

      // Check if this is a video/stream URL
      if (VIDEO_REGEX.test(requestUrl)) {
        // Avoid duplicate detections
        if (!detectedUrlsRef.current.has(requestUrl)) {
          detectedUrlsRef.current.add(requestUrl);

          const headers: StreamHeaders = {
            'User-Agent': USER_AGENT,
            Referer: url,
          };

          try {
            const urlObj = new URL(url);
            headers['Origin'] = urlObj.origin;
          } catch (e) {}

          console.log('[StreamWebView JS] Detected stream via navigation:', requestUrl);
          onStreamDetected({ url: requestUrl, headers: headers });
        }

        // Allow the request to continue (some players need to load the manifest)
        return true;
      }

      return true;
    },
    [url, onStreamDetected]
  );

  // Handle new window requests (popups) - block them
  const handleOpenWindow = useCallback(() => {
    console.log('[StreamWebView JS] Blocked popup window');
  }, []);

  return (
    <View style={styles.webViewContainer}>
      <WebView
        ref={webViewRef}
        source={{ uri: url }}
        userAgent={USER_AGENT}
        injectedJavaScript={INJECTED_JAVASCRIPT}
        injectedJavaScriptBeforeContentLoaded={INJECTED_JAVASCRIPT}
        injectedJavaScriptForMainFrameOnly={false}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onOpenWindow={handleOpenWindow}
        setSupportMultipleWindows={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}
        allowsBackForwardNavigationGestures={false}
        cacheEnabled={true}
        incognito={false}
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        originWhitelist={['http://*', 'https://*', 'about:*', 'data:*']}
        mixedContentMode="always"
        allowsProtectedMedia={true}
        style={{ flex: 1, backgroundColor: '#000' }}
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
