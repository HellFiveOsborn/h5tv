/**
 * NativeStreamWebView - Componente que usa o WebView nativo Android
 *
 * Este componente usa o StreamInterceptorWebView nativo (Kotlin) que:
 * - Intercepta TODAS as requisições de rede (incluindo cross-origin iframes)
 * - Tem bypass de Cloudflare embutido
 * - Bloqueia anúncios a nível de rede
 * - Persiste cookies entre sessões
 *
 * Plataforma suportada: Android 6+ (Android TV incluso)
 */

import React, { useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  requireNativeComponent,
  UIManager,
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

interface NavigationStateEvent {
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
  title?: string;
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
  onNavigationStateChange?: (event: NativeSyntheticEvent<NavigationStateEvent>) => void;
  onError?: (event: NativeSyntheticEvent<ErrorEvent>) => void;
  style?: any;
}

// Registrar o componente nativo Android
const viewManagerName = 'StreamInterceptorWebView';
let NativeWebView: any = null;

try {
  // Verificar se o ViewManager está registrado antes de tentar requerer
  if (UIManager.getViewManagerConfig(viewManagerName)) {
    NativeWebView = requireNativeComponent<NativeStreamWebViewProps>(viewManagerName);
  }
} catch (e) {
  console.warn('[NativeStreamWebView] Componente nativo não encontrado. Certifique-se de que o app foi compilado com o plugin withStreamInterceptor.');
}

export const isNativeComponentAvailable = !!NativeWebView;

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
  onLoadEnd?: (url: string) => void;
  onNavigationStateChange?: (state: { url: string; canGoBack: boolean; canGoForward: boolean; title?: string }) => void;
  onError?: (error: string) => void;
}

export const NativeStreamWebView = React.forwardRef<NativeStreamWebViewRef, Props>(
  ({ url, onStreamDetected, onLoadStart, onLoadEnd, onNavigationStateChange, onError }, ref) => {
    const webViewRef = useRef<any>(null);
    const detectedUrlsRef = useRef<Set<string>>(new Set());

    // Clear detected URLs when main URL changes
    useEffect(() => {
      detectedUrlsRef.current.clear();
    }, [url]);

    // Expor métodos via ref
    React.useImperativeHandle(ref, () => ({
      loadUrl: (newUrl: string) => {
        if (webViewRef.current) {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(webViewRef.current),
            Commands.loadUrl,
            [newUrl]
          );
        }
      },
      reload: () => {
        if (webViewRef.current) {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(webViewRef.current),
            Commands.reload,
            []
          );
        }
      },
      goBack: () => {
        if (webViewRef.current) {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(webViewRef.current),
            Commands.goBack,
            []
          );
        }
      },
      goForward: () => {
        if (webViewRef.current) {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(webViewRef.current),
            Commands.goForward,
            []
          );
        }
      },
      injectJavaScript: (script: string) => {
        if (webViewRef.current) {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(webViewRef.current),
            Commands.injectJavaScript,
            [script]
          );
        }
      },
      clearDetectedUrls: () => {
        if (webViewRef.current) {
          UIManager.dispatchViewManagerCommand(
            findNodeHandle(webViewRef.current),
            Commands.clearDetectedUrls,
            []
          );
        }
        detectedUrlsRef.current.clear();
      },
      stopLoading: () => {
        if (webViewRef.current) {
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
        const loadedUrl = event.nativeEvent.url;
        console.log('[NativeStreamWebView] Load ended:', loadedUrl);
        onLoadEnd?.(loadedUrl);
      },
      [onLoadEnd]
    );

    // Handler para mudança de estado de navegação
    const handleNavigationStateChange = useCallback(
      (event: NativeSyntheticEvent<NavigationStateEvent>) => {
        const { url: navUrl, canGoBack, canGoForward, title } = event.nativeEvent;
        console.log('[NativeStreamWebView] Navigation state changed:', { navUrl, canGoBack, canGoForward });
        onNavigationStateChange?.({ url: navUrl, canGoBack, canGoForward, title });
      },
      [onNavigationStateChange]
    );

    // Handler para erros
    const handleError = useCallback(
      (event: NativeSyntheticEvent<ErrorEvent>) => {
        console.log('[NativeStreamWebView] Error:', event.nativeEvent.description);
        onError?.(event.nativeEvent.description);
      },
      [onError]
    );

    // Se o componente nativo não estiver disponível, mostrar loading
    // (isso não deve acontecer em builds de release)
    if (!NativeWebView) {
      console.error('[NativeStreamWebView] Componente nativo não disponível. Verifique se o app foi compilado corretamente.');
      return (
        <View style={styles.webViewContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
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
          onNavigationStateChange={handleNavigationStateChange}
          onError={handleError}
          style={styles.webView}
        />
      </View>
    );
  }
);

NativeStreamWebView.displayName = 'NativeStreamWebView';

const styles = StyleSheet.create({
  webViewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  webView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});

export default NativeStreamWebView;
