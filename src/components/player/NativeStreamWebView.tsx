/**
 * NativeStreamWebView - Componente que usa o WebView nativo Android
 *
 * Este componente usa o StreamInterceptorWebView nativo (Kotlin) que:
 * - Intercepta TODAS as requisições de rede (incluindo cross-origin iframes)
 * - Tem bypass de Cloudflare embutido
 * - Bloqueia anúncios a nível de rede
 * - Persiste cookies entre sessões
 */

import React, { useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  requireNativeComponent,
  UIManager,
  Platform,
  findNodeHandle,
  NativeSyntheticEvent,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import type { StreamHeaders } from '../../utils/streamInterceptor';

// Tipos para os eventos nativos
interface StreamDetectedEvent {
  url: string;
  type: string;
  headers: StreamHeaders;
}

interface LoadEvent {
  url: string;
}

interface ErrorEvent {
  url: string;
  description: string;
}

interface NativeStreamWebViewProps {
  source: { uri: string; headers?: Record<string, string> };
  userAgent?: string;
  injectedJavaScript?: string;
  javaScriptEnabled?: boolean;
  domStorageEnabled?: boolean;
  mediaPlaybackRequiresUserAction?: boolean;
  allowsInlineMediaPlayback?: boolean;
  scalesPageToFit?: boolean;
  mixedContentMode?: 'never' | 'always' | 'compatibility';
  cacheEnabled?: boolean;
  onStreamDetected?: (event: NativeSyntheticEvent<StreamDetectedEvent>) => void;
  onLoadStart?: (event: NativeSyntheticEvent<LoadEvent>) => void;
  onLoadEnd?: (event: NativeSyntheticEvent<LoadEvent>) => void;
  onError?: (event: NativeSyntheticEvent<ErrorEvent>) => void;
  style?: any;
}

// Registrar o componente nativo
const NativeWebView = Platform.OS === 'android'
  ? requireNativeComponent<NativeStreamWebViewProps>('StreamInterceptorWebView')
  : null;

// Comandos disponíveis no ViewManager
const Commands = {
  loadUrl: 1,
  reload: 2,
  goBack: 3,
  goForward: 4,
  injectJavaScript: 5,
  clearDetectedUrls: 6,
  stopLoading: 7,
};

export interface NativeStreamWebViewRef {
  loadUrl: (url: string) => void;
  reload: () => void;
  goBack: () => void;
  goForward: () => void;
  injectJavaScript: (script: string) => void;
  clearDetectedUrls: () => void;
  stopLoading: () => void;
}

interface Props {
  url: string;
  onStreamDetected: (data: { url: string; headers: StreamHeaders }) => void;
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: string) => void;
}

export const NativeStreamWebView = React.forwardRef<NativeStreamWebViewRef, Props>(
  ({ url, onStreamDetected, onLoadStart, onLoadEnd, onError }, ref) => {
    const webViewRef = useRef<any>(null);
    const detectedUrlsRef = useRef<Set<string>>(new Set());

    // Clear detected URLs when main URL changes
    useEffect(() => {
      detectedUrlsRef.current.clear();
    }, [url]);

    // Expor métodos via ref
    React.useImperativeHandle(ref, () => ({
      loadUrl: (newUrl: string) => {
        if (webViewRef.current && Platform.OS === 'android') {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(webViewRef.current),
            Commands.loadUrl,
            [newUrl]
          );
        }
      },
      reload: () => {
        if (webViewRef.current && Platform.OS === 'android') {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(webViewRef.current),
            Commands.reload,
            []
          );
        }
      },
      goBack: () => {
        if (webViewRef.current && Platform.OS === 'android') {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(webViewRef.current),
            Commands.goBack,
            []
          );
        }
      },
      goForward: () => {
        if (webViewRef.current && Platform.OS === 'android') {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(webViewRef.current),
            Commands.goForward,
            []
          );
        }
      },
      injectJavaScript: (script: string) => {
        if (webViewRef.current && Platform.OS === 'android') {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(webViewRef.current),
            Commands.injectJavaScript,
            [script]
          );
        }
      },
      clearDetectedUrls: () => {
        if (webViewRef.current && Platform.OS === 'android') {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(webViewRef.current),
            Commands.clearDetectedUrls,
            []
          );
        }
        detectedUrlsRef.current.clear();
      },
      stopLoading: () => {
        if (webViewRef.current && Platform.OS === 'android') {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(webViewRef.current),
            Commands.stopLoading,
            []
          );
        }
      },
    }));

    // Handler para stream detectado
    const handleStreamDetected = useCallback(
      (event: NativeSyntheticEvent<StreamDetectedEvent>) => {
        const { url: streamUrl, headers } = event.nativeEvent;

        // Evitar duplicatas
        if (detectedUrlsRef.current.has(streamUrl)) return;
        detectedUrlsRef.current.add(streamUrl);

        console.log('[NativeStreamWebView] Stream detected:', streamUrl);
        onStreamDetected({ url: streamUrl, headers: headers || {} });
      },
      [onStreamDetected]
    );

    // Handler para início de carregamento
    const handleLoadStart = useCallback(
      (event: NativeSyntheticEvent<LoadEvent>) => {
        console.log('[NativeStreamWebView] Load started:', event.nativeEvent.url);
        onLoadStart?.();
      },
      [onLoadStart]
    );

    // Handler para fim de carregamento
    const handleLoadEnd = useCallback(
      (event: NativeSyntheticEvent<LoadEvent>) => {
        console.log('[NativeStreamWebView] Load ended:', event.nativeEvent.url);
        onLoadEnd?.();
      },
      [onLoadEnd]
    );

    // Handler para erros
    const handleError = useCallback(
      (event: NativeSyntheticEvent<ErrorEvent>) => {
        console.log('[NativeStreamWebView] Error:', event.nativeEvent.description);
        onError?.(event.nativeEvent.description);
      },
      [onError]
    );

    // Fallback para iOS (não suportado)
    if (Platform.OS !== 'android' || !NativeWebView) {
      return (
        <View style={[styles.webViewContainer, styles.fallback]}>
          <Text style={styles.fallbackText}>
            NativeStreamWebView só está disponível no Android
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.webViewContainer}>
        <NativeWebView
          ref={webViewRef}
          source={{ uri: url }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          scalesPageToFit={true}
          mixedContentMode="always"
          cacheEnabled={true}
          onStreamDetected={handleStreamDetected}
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          style={styles.webView}
        />
        <View style={styles.overlayIndicator}>
          <Text style={styles.overlayText}>Carregando...</Text>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      </View>
    );
  }
);

NativeStreamWebView.displayName = 'NativeStreamWebView';

const styles = StyleSheet.create({
  webViewContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  webView: {
    flex: 1,
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
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
});

export default NativeStreamWebView;
