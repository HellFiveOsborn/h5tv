/**
 * Stream Interceptor Utilities
 *
 * Módulo centralizado para detecção de streams de vídeo e bloqueio de anúncios.
 * Este módulo é compartilhado entre:
 * - StreamWebView.tsx (componente React Native)
 * - withStreamInterceptor.js (plugin Expo/Android nativo)
 *
 * @module streamInterceptor
 */

// =============================================================================
// CONSTANTES COMPARTILHADAS
// =============================================================================

/**
 * User-Agent padrão para simular navegador Chrome desktop
 */
export const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";

/**
 * Regex para detectar URLs de vídeo/stream
 * Suporta: mp4, m3u8 (HLS), mpd (DASH), e outros formatos comuns
 */
export const VIDEO_REGEX = /\.(mp4|mp4v|mpv|m1v|m4v|mpg|mpg2|mpeg|xvid|webm|3gp|avi|mov|mkv|ogg|ogv|ogm|m3u8|mpd|ism(?:[vc]|\/manifest)?)(?:[\?#]|$)/i;

/**
 * Versão string da regex para uso em JavaScript injetado
 */
export const VIDEO_REGEX_STRING = String.raw`\.(mp4|mp4v|mpv|m1v|m4v|mpg|mpg2|mpeg|xvid|webm|3gp|avi|mov|mkv|ogg|ogv|ogm|m3u8|mpd|ism(?:[vc]|\/manifest)?)(?:[\?#]|$)`;

/**
 * Padrões específicos para streams de plataformas (YouTube, Twitch, etc.)
 * Usados para detectar streams que não seguem o padrão de extensão tradicional
 */
export const PLATFORM_STREAM_PATTERNS: readonly RegExp[] = [
  // YouTube HLS manifests
  /manifest\.googlevideo\.com.*\.m3u8/i,
  /googlevideo\.com.*\.m3u8/i,
  /youtube\.com.*\.m3u8/i,
  // YouTube video playback
  /googlevideo\.com\/videoplayback\?.*mime=video/i,
  /r[0-9]+---sn-.*\.googlevideo\.com/i,
  // YouTube live streams
  /youtube\.com\/live_stream/i,
  /youtube\.com.*live.*\.m3u8/i,
  // ytimg HLS
  /i\.ytimg\.com.*\.m3u8/i,
  // Twitch patterns
  /usher\.ttvnw\.net.*\.m3u8/i,
  /video-weaver\..*\.hls\.ttvnw\.net/i,
  // Facebook Live
  /video\.xx\.fbcdn\.net.*\.m3u8/i,
  /facebook\.com.*\.m3u8/i,
  // DailyMotion
  /proxy.*\.dailymotion\.com.*\.m3u8/i,
  // Vimeo
  /vimeo.*\.akamaized\.net.*\.m3u8/i,
  /skyfire\.vimeocdn\.com.*\.m3u8/i,
] as const;

/**
 * Lista unificada de domínios de anúncios para bloquear
 * Combinação das listas de ambos os arquivos originais
 */
export const AD_DOMAINS: readonly string[] = [
  // Google Ads
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adservice.google.com',
  'pagead2.googlesyndication.com',
  'ads.youtube.com',
  'googletagmanager.com',
  'googletagservices.com',
  'google-analytics.com',
  'analytics.google.com',
  'securepubads.g.doubleclick.net',
  'ad.doubleclick.net',
  'imasdk.googleapis.com',

  // Ad Networks
  'adnxs.com',
  'adsrvr.org',
  'advertising.com',
  'taboola.com',
  'outbrain.com',
  'criteo.com',
  'pubmatic.com',
  'rubiconproject.com',
  'openx.net',
  'casalemedia.com',
  'bidswitch.net',
  'contextweb.com',
  'liadm.com',
  'everesttech.net',
  'rfihub.com',
  'smartadserver.com',
  'yieldmo.com',
  'tremorhub.com',
  'spotxchange.com',

  // Analytics & Tracking
  'scorecardresearch.com',
  'quantserve.com',
  'bluekai.com',
  'exelator.com',
  'mathtag.com',
  'turn.com',

  // Ad Verification
  'serving-sys.com',
  'moatads.com',
  'doubleverify.com',
  'adsafeprotected.com',
  'eyeviewads.com',
  'innovid.com',

  // Social/Other
  'ads-twitter.com',
  'static.ads-twitter.com',
  'ads-api.twitter.com',
  'amazon-adsystem.com',
  'facebook.net/signals',
  'connect.facebook.net',
] as const;

/**
 * Padrões regex para detectar URLs de anúncios por padrões na URL
 */
export const AD_URL_PATTERNS: readonly RegExp[] = [
  /[?&](ad|ads|advert|banner|sponsor|track|click|pixel)[=_-]/i,
  /\/(ad|ads|advert|banner|sponsor|track|click|pixel)[\/\.?]/i,
] as const;

// =============================================================================
// FUNÇÕES UTILITÁRIAS
// =============================================================================

/**
 * Verifica se uma URL pertence a um domínio de anúncios
 * @param url - URL para verificar
 * @returns true se for URL de anúncio
 */
export function isAdUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  const urlLower = url.toLowerCase();

  // Verifica domínios conhecidos
  for (const domain of AD_DOMAINS) {
    if (urlLower.includes(domain)) return true;
  }

  // Verifica padrões na URL
  for (const pattern of AD_URL_PATTERNS) {
    if (pattern.test(urlLower)) return true;
  }

  return false;
}

/**
 * Verifica se uma URL é de vídeo/stream
 * @param url - URL para verificar
 * @returns true se for URL de vídeo
 */
export function isVideoUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  // Verifica extensões de vídeo padrão
  if (VIDEO_REGEX.test(url)) return true;

  // Verifica padrões específicos de plataformas (YouTube, Twitch, etc.)
  return PLATFORM_STREAM_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Verifica se uma URL é especificamente um stream do YouTube Live
 * @param url - URL para verificar
 * @returns true se for URL de YouTube Live
 */
export function isYouTubeLiveUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return (
    url.includes('googlevideo.com') ||
    url.includes('youtube.com/live') ||
    (url.includes('youtube') && url.includes('.m3u8'))
  );
}

/**
 * Verifica se uma URL é de vídeo válida (não é anúncio)
 * @param url - URL para verificar
 * @returns true se for URL de vídeo válida
 */
export function isValidStreamUrl(url: string): boolean {
  return isVideoUrl(url) && !isAdUrl(url);
}

/**
 * Result of stream URL extraction with header suggestions
 */
export interface ExtractedStreamResult {
  /** The extracted stream URL */
  url: string;
  /** Whether the URL was extracted from a wrapper/player page */
  wasExtracted: boolean;
  /** The original wrapper URL (if extracted) */
  wrapperUrl?: string;
  /** Suggested headers for the extracted stream */
  suggestedHeaders: {
    Referer: string;
    Origin: string;
  };
}

/**
 * Helper to construct Origin from URL
 */
function getOriginFromUrl(urlString: string): string {
  try {
    const urlObj = new URL(urlString);
    return `${urlObj.protocol}//${urlObj.host}`;
  } catch {
    return '';
  }
}

/**
 * Helper to construct Referer from URL (with trailing slash)
 */
function getRefererFromUrl(urlString: string): string {
  try {
    const urlObj = new URL(urlString);
    return `${urlObj.protocol}//${urlObj.host}/`;
  } catch {
    return '';
  }
}

/**
 * Extrai a URL real do stream de uma URL que pode conter o stream como parâmetro
 * Ex: "player.html?m3u8=https://example.com/stream.m3u8" -> "https://example.com/stream.m3u8"
 * @param url - URL original (pode ser uma página de player ou URL direta)
 * @returns URL do stream extraída ou a URL original se não houver parâmetro
 */
export function extractStreamUrl(url: string): string {
  return extractStreamUrlWithHeaders(url).url;
}

/**
 * Extrai a URL real do stream com sugestões de headers adequados
 * Ex: "player.html?m3u8=https://example.com/stream.m3u8" -> { url: "https://...", suggestedHeaders: {...} }
 *
 * @param url - URL original (pode ser uma página de player ou URL direta)
 * @returns Objeto com URL extraída e headers sugeridos
 */
export function extractStreamUrlWithHeaders(url: string): ExtractedStreamResult {
  const defaultResult: ExtractedStreamResult = {
    url: url || '',
    wasExtracted: false,
    suggestedHeaders: {
      Referer: getRefererFromUrl(url),
      Origin: getOriginFromUrl(url),
    },
  };

  if (!url) return defaultResult;

  try {
    const urlObj = new URL(url);

    // Lista de parâmetros comuns que contêm URLs de stream
    const streamParams = ['m3u8', 'url', 'source', 'src', 'stream', 'video', 'file', 'media', 'mpd', 'hls'];

    for (const param of streamParams) {
      const value = urlObj.searchParams.get(param);
      if (value && (value.startsWith('http://') || value.startsWith('https://'))) {
        // Verifica se é realmente uma URL de vídeo
        if (VIDEO_REGEX.test(value)) {
          console.log(`[extractStreamUrl] Extracted ${param}:`, value);
          // For extracted URLs, use the extracted URL's domain for headers
          // This is critical because many stream servers reject requests with
          // Referer from different domains (like the wrapper page domain)
          return {
            url: value,
            wasExtracted: true,
            wrapperUrl: url,
            suggestedHeaders: {
              Referer: getRefererFromUrl(value),
              Origin: getOriginFromUrl(value),
            },
          };
        }
      }
    }

    // Tenta decodificar parâmetros que podem estar codificados
    for (const [key, value] of urlObj.searchParams.entries()) {
      try {
        const decoded = decodeURIComponent(value);
        if ((decoded.startsWith('http://') || decoded.startsWith('https://')) && VIDEO_REGEX.test(decoded)) {
          console.log(`[extractStreamUrl] Extracted decoded ${key}:`, decoded);
          return {
            url: decoded,
            wasExtracted: true,
            wrapperUrl: url,
            suggestedHeaders: {
              Referer: getRefererFromUrl(decoded),
              Origin: getOriginFromUrl(decoded),
            },
          };
        }
      } catch (e) {
        // Ignora erros de decodificação
      }
    }
  } catch (e) {
    // URL inválida, retorna original
  }

  return defaultResult;
}

/**
 * Detecta o tipo de stream pela URL para uso com ExoPlayer
 * Implements comprehensive detection with fallback to HLS (most common for live streams)
 *
 * @param url - URL do stream
 * @param headers - Optional headers that may contain content-type hints
 * @returns Extensão do tipo de mídia ('m3u8', 'mpd', 'mp4', etc.) - never undefined
 */
export function detectStreamType(url: string, headers?: Record<string, string>): string {
  if (!url) {
    console.log('[StreamType] No URL provided, defaulting to m3u8');
    return 'm3u8';
  }

  const urlLower = url.toLowerCase();
  let detectedType: string | undefined;

  // ===========================================
  // 1. Check explicit file extensions (highest priority)
  // ===========================================

  // HLS - .m3u8 extension
  if (urlLower.includes('.m3u8')) {
    detectedType = 'm3u8';
  }
  // DASH - .mpd extension
  else if (urlLower.includes('.mpd')) {
    detectedType = 'mpd';
  }
  // Smooth Streaming - .ism extension
  else if (urlLower.includes('.ism')) {
    detectedType = 'ism';
  }
  // Direct video files
  else if (urlLower.includes('.mp4')) {
    detectedType = 'mp4';
  }
  else if (urlLower.includes('.webm')) {
    detectedType = 'webm';
  }
  else if (urlLower.includes('.mkv')) {
    detectedType = 'mkv';
  }
  else if (urlLower.includes('.avi')) {
    detectedType = 'avi';
  }
  else if (urlLower.includes('.mov')) {
    detectedType = 'mov';
  }
  else if (urlLower.includes('.flv')) {
    detectedType = 'flv';
  }
  else if (urlLower.includes('.ts')) {
    detectedType = 'ts';
  }
  else if (urlLower.includes('.m4v')) {
    detectedType = 'm4v';
  }
  else if (urlLower.includes('.3gp')) {
    detectedType = '3gp';
  }
  else if (urlLower.includes('.ogg') || urlLower.includes('.ogv')) {
    detectedType = 'ogg';
  }

  // ===========================================
  // 2. Check URL path patterns (if no extension found)
  // ===========================================
  if (!detectedType) {
    // HLS path patterns
    if (
      urlLower.includes('/hls/') ||
      urlLower.includes('/hls.') ||
      urlLower.includes('/playlist') ||
      urlLower.includes('/master') ||
      urlLower.includes('/chunklist') ||
      urlLower.includes('/index.m3u') ||
      urlLower.includes('/live.m3u') ||
      urlLower.includes('_hls') ||
      urlLower.includes('hls_') ||
      /\/[^\/]*master[^\/]*$/i.test(urlLower) ||
      /\/[^\/]*playlist[^\/]*$/i.test(urlLower)
    ) {
      detectedType = 'm3u8';
    }
    // DASH path patterns
    else if (
      urlLower.includes('/dash/') ||
      urlLower.includes('/dash.') ||
      urlLower.includes('_dash') ||
      urlLower.includes('dash_') ||
      urlLower.includes('/manifest(')  // Azure Media Services style
    ) {
      detectedType = 'mpd';
    }
    // Smooth Streaming patterns
    else if (
      urlLower.includes('/manifest') && !urlLower.includes('.m3u')
    ) {
      detectedType = 'ism';
    }
  }

  // ===========================================
  // 3. Check query parameters
  // ===========================================
  if (!detectedType) {
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;

      // Check format parameter
      const format = params.get('format') || params.get('type') || params.get('output');
      if (format) {
        const formatLower = format.toLowerCase();
        if (formatLower === 'hls' || formatLower === 'm3u8') {
          detectedType = 'm3u8';
        } else if (formatLower === 'dash' || formatLower === 'mpd') {
          detectedType = 'mpd';
        } else if (formatLower === 'mp4') {
          detectedType = 'mp4';
        }
      }

      // Check for HLS/DASH indicators in query string
      const queryString = urlObj.search.toLowerCase();
      if (!detectedType) {
        if (queryString.includes('hls') || queryString.includes('m3u8')) {
          detectedType = 'm3u8';
        } else if (queryString.includes('dash') || queryString.includes('mpd')) {
          detectedType = 'mpd';
        }
      }
    } catch (e) {
      // Invalid URL, continue to next checks
    }
  }

  // ===========================================
  // 4. Check Content-Type from headers (if provided)
  // ===========================================
  if (!detectedType && headers) {
    const contentType = headers['Content-Type'] || headers['content-type'] || '';
    const contentTypeLower = contentType.toLowerCase();

    if (
      contentTypeLower.includes('application/vnd.apple.mpegurl') ||
      contentTypeLower.includes('application/x-mpegurl') ||
      contentTypeLower.includes('audio/mpegurl') ||
      contentTypeLower.includes('audio/x-mpegurl')
    ) {
      detectedType = 'm3u8';
    } else if (
      contentTypeLower.includes('application/dash+xml') ||
      contentTypeLower.includes('video/vnd.mpeg.dash.mpd')
    ) {
      detectedType = 'mpd';
    } else if (contentTypeLower.includes('video/mp4')) {
      detectedType = 'mp4';
    } else if (contentTypeLower.includes('video/webm')) {
      detectedType = 'webm';
    }
  }

  // ===========================================
  // 5. Platform-specific patterns
  // ===========================================
  if (!detectedType) {
    // YouTube/Google Video - typically HLS
    if (urlLower.includes('googlevideo.com') || urlLower.includes('youtube.com')) {
      detectedType = 'm3u8';
    }
    // Twitch - typically HLS
    else if (urlLower.includes('ttvnw.net') || urlLower.includes('twitch.tv')) {
      detectedType = 'm3u8';
    }
    // Akamai - could be either, but HLS more common
    else if (urlLower.includes('akamaized.net') || urlLower.includes('akamaihd.net')) {
      detectedType = 'm3u8';
    }
    // Cloudfront - typically HLS for live
    else if (urlLower.includes('cloudfront.net')) {
      detectedType = 'm3u8';
    }
  }

  // ===========================================
  // 6. Fallback to HLS (most common for live streams)
  // ===========================================
  if (!detectedType) {
    console.log('[StreamType] Unknown format, defaulting to m3u8:', url);
    detectedType = 'm3u8';
  } else {
    console.log('[StreamType] Detected type:', detectedType, 'for URL:', url.substring(0, 100) + (url.length > 100 ? '...' : ''));
  }

  return detectedType;
}

// =============================================================================
// CSS DE BLOQUEIO DE ANÚNCIOS
// =============================================================================

/**
 * CSS para esconder elementos de anúncios
 * Versão completa com todos os seletores
 */
export const AD_BLOCK_CSS = `
/* Generic ad selectors */
[class*="ad-"], [class*="ad_"], [class*="ads-"], [class*="ads_"],
[class*="advert"], [class*="advertisement"], [class*="sponsor"],
[class*="banner-ad"], [class*="video-ad"], [class*="player-ad"],
[id*="ad-"], [id*="ad_"], [id*="ads-"], [id*="ads_"],
[id*="advert"], [id*="advertisement"], [id*="sponsor"],
[data-ad], [data-ads], [data-ad-slot], [data-ad-client],
.adsbygoogle, ins.adsbygoogle, #google_ads_iframe,
.ad-container, .ad-wrapper, .ad-banner, .ad-frame, .ad-overlay,
.video-ads, .ytp-ad-module, .ytp-ad-overlay-slot,
.ytp-ad-text-overlay, .ytp-ad-player-overlay, .ytp-ad-image-overlay,
div[aria-label*="Ad"], div[aria-label*="advertisement"],

/* Iframe ads */
iframe[src*="ads"], iframe[src*="ad."], iframe[src*="ad-"],
iframe[src*="doubleclick"], iframe[src*="googlesyndication"],
iframe[src*="googleadservices"], iframe[src*="amazon-adsystem"],
iframe[src*="facebook.net"], iframe[src*="adnxs"],
iframe[id*="google_ads"], iframe[name*="google_ads"],
iframe[src*="taboola"], iframe[src*="outbrain"],

/* Gambling/betting */
a[href*="bet365"], a[href*="betway"], a[href*="1xbet"], a[href*="betfair"],
a[href*="casino"], a[href*="poker"], a[href*="gambling"], a[href*="slots"],
a[href*="betting"], a[href*="sportsbook"], a[href*="stake.com"],
a[href*="pinnacle"], a[href*="unibet"], a[href*="bwin"], a[href*="888"],
div[class*="bet"], div[class*="casino"], div[class*="gambling"],
img[src*="bet365"], img[src*="casino"], img[src*="betting"],

/* Popups and overlays */
.popup-overlay, .popup-container, .modal-ad, .overlay-ad,
div[class*="popup"], div[id*="popup"],
div[class*="overlay"][class*="ad"], div[id*="overlay"][id*="ad"],
div[style*="z-index: 9999"], div[style*="z-index: 99999"],
div[style*="z-index:9999"], div[style*="z-index:99999"],

/* Social tracking */
.fb-like, .twitter-share, .social-share-ad,
iframe[src*="facebook.com/plugins"],

/* Common ad networks */
.taboola, .outbrain, #taboola, #outbrain,
div[id^="taboola-"], div[id^="outbrain-"],
div[class*="taboola"], div[class*="outbrain"],

/* Floating/sticky ads */
div[style*="position: fixed"][class*="ad"],
div[style*="position: fixed"][id*="ad"],
div[style*="position:fixed"][class*="ad"],
div[style*="position:fixed"][id*="ad"],

/* Player ads */
#player-ads, .video-ads, .ytp-ad-module
{
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
  height: 0 !important;
  width: 0 !important;
  max-height: 0 !important;
  max-width: 0 !important;
  overflow: hidden !important;
  position: absolute !important;
  left: -9999px !important;
  top: -9999px !important;
}

/* Prevent click hijacking */
body { pointer-events: auto !important; }
video { pointer-events: auto !important; }
`;

/**
 * CSS simplificado para uso no Android nativo
 */
export const AD_BLOCK_CSS_MINIMAL = `
iframe[src*="ads"], iframe[src*="ad."], iframe[src*="doubleclick"],
iframe[src*="googlesyndication"], iframe[src*="googleadservices"],
div[id*="ad-"], div[id*="ad_"], div[id*="ads-"], div[id*="ads_"],
div[class*="ad-"], div[class*="ad_"], div[class*="ads-"], div[class*="ads_"],
div[class*="advert"], div[id*="advert"],
div[class*="sponsor"], div[id*="sponsor"],
a[href*="bet365"], a[href*="casino"], a[href*="poker"],
a[href*="gambling"], a[href*="1xbet"], a[href*="betway"],
ins.adsbygoogle, div.adsbygoogle,
[data-ad], [data-ads], [data-ad-slot],
.ad-container, .ad-wrapper, .ad-banner,
#player-ads, .video-ads, .ytp-ad-module,
.ytp-ad-overlay-slot, .ytp-ad-text-overlay
{ display: none !important; visibility: hidden !important; height: 0 !important; }
`;

// =============================================================================
// SCRIPT DE ADBLOCK PARA ANDROID NATIVO
// =============================================================================

/**
 * Gera o script JavaScript simplificado para Android nativo (onPageFinished)
 * @returns String com o código JavaScript simplificado
 */
export function generateNativeAdBlockScript(): string {
  return `
(function() {
  var style = document.createElement('style');
  style.innerHTML = \`${AD_BLOCK_CSS_MINIMAL.replace(/`/g, '\\`')}\`;
  document.head.appendChild(style);

  window.open = function() { return null; };
  window.alert = function() {};
  window.confirm = function() { return false; };
  window.prompt = function() { return null; };

  document.addEventListener('click', function(e) {
    var target = e.target;
    while(target) {
      if(target.tagName === 'A' && target.target === '_blank') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      target = target.parentElement;
    }
  }, true);
})();
`;
}

// =============================================================================
// TIPOS E INTERFACES
// =============================================================================

/**
 * Dados de stream detectado
 */
export interface StreamData {
  url: string;
  type: string;
  headers: StreamHeaders;
}

/**
 * Headers para requisições de stream
 */
export interface StreamHeaders {
  'User-Agent'?: string;
  'Referer'?: string;
  'Origin'?: string;
  'Cookie'?: string;
  [key: string]: string | undefined;
}

/**
 * Callback para detecção de stream
 */
export type StreamDetectedCallback = (data: { url: string; headers: StreamHeaders }) => void;

// =============================================================================
// EXPORTS PARA PLUGIN NATIVO
// =============================================================================

/**
 * Gera a lista de domínios para uso no código Kotlin
 * @returns String formatada para uso em Set Kotlin
 */
export function getAdDomainsForKotlin(): string {
  return AD_DOMAINS.map(d => `"${d}"`).join(',\n            ');
}

/**
 * Gera a regex de vídeo para uso no código Kotlin
 * @returns String formatada para uso em Regex Kotlin
 */
export function getVideoRegexForKotlin(): string {
  return String.raw`\.(mp4|mp4v|mpv|m1v|m4v|mpg|mpg2|mpeg|xvid|webm|3gp|avi|mov|mkv|ogg|ogv|ogm|m3u8|mpd|ism(?:[vc]|/manifest)?)(?:[?#]|$)`;
}

// Export padrão com todas as funções e constantes
export default {
  USER_AGENT,
  VIDEO_REGEX,
  VIDEO_REGEX_STRING,
  PLATFORM_STREAM_PATTERNS,
  AD_DOMAINS,
  AD_URL_PATTERNS,
  AD_BLOCK_CSS,
  AD_BLOCK_CSS_MINIMAL,
  isAdUrl,
  isVideoUrl,
  isYouTubeLiveUrl,
  isValidStreamUrl,
  extractStreamUrl,
  detectStreamType,
  generateNativeAdBlockScript,
  getAdDomainsForKotlin,
  getVideoRegexForKotlin,
};
