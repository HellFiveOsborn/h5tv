import React from 'react';
import { NativeStreamWebView } from './NativeStreamWebView';
import type { StreamHeaders } from '../../utils/streamInterceptor';

interface StreamWebViewProps {
  url: string;
  onStreamDetected: (data: { url: string; headers: StreamHeaders }) => void;
}

/**
 * StreamWebView - Componente para detecção de streams via monitoramento de rede
 *
 * Este componente usa o StreamInterceptorWebView nativo (Kotlin) que:
 * - Intercepta TODAS as requisições de rede via shouldInterceptRequest
 * - Funciona com cross-origin iframes
 * - Tem bypass de Cloudflare embutido
 * - Bloqueia anúncios a nível de rede
 * - Persiste cookies automaticamente
 *
 * Fluxo: WebView → shouldInterceptRequest (Kotlin) → Detecta m3u8/mpd → Callback → React Native Video
 *
 * O sistema de AdBlock é aplicado automaticamente pelo componente nativo:
 * - Bloqueio de domínios de ads em shouldInterceptRequest
 * - Injeção de CSS para esconder elementos de ads em onPageFinished
 * - Bloqueio de popups e window.open
 */
export const StreamWebView = ({ url, onStreamDetected }: StreamWebViewProps) => {
  return (
    <NativeStreamWebView
      url={url}
      onStreamDetected={onStreamDetected}
    />
  );
};

export default StreamWebView;
