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
  return VIDEO_REGEX.test(url);
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
 * Extrai a URL real do stream de uma URL que pode conter o stream como parâmetro
 * Ex: "player.html?m3u8=https://example.com/stream.m3u8" -> "https://example.com/stream.m3u8"
 * @param url - URL original (pode ser uma página de player ou URL direta)
 * @returns URL do stream extraída ou a URL original se não houver parâmetro
 */
export function extractStreamUrl(url: string): string {
  if (!url) return url;

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
          return value;
        }
      }
    }

    // Tenta decodificar parâmetros que podem estar codificados
    for (const [key, value] of urlObj.searchParams.entries()) {
      try {
        const decoded = decodeURIComponent(value);
        if ((decoded.startsWith('http://') || decoded.startsWith('https://')) && VIDEO_REGEX.test(decoded)) {
          console.log(`[extractStreamUrl] Extracted decoded ${key}:`, decoded);
          return decoded;
        }
      } catch (e) {
        // Ignora erros de decodificação
      }
    }
  } catch (e) {
    // URL inválida, retorna original
  }

  return url;
}

/**
 * Detecta o tipo de stream pela URL para uso com ExoPlayer
 * @param url - URL do stream
 * @returns Extensão do tipo de mídia ('m3u8', 'mpd', 'mp4', etc.) ou undefined
 */
export function detectStreamType(url: string): string | undefined {
  if (!url) return undefined;
  const urlLower = url.toLowerCase();

  // HLS
  if (urlLower.includes('.m3u8') || urlLower.includes('/hls/')) return 'm3u8';

  // DASH
  if (urlLower.includes('.mpd') || urlLower.includes('/dash/')) return 'mpd';

  // Smooth Streaming
  if (urlLower.includes('.ism') || urlLower.includes('/manifest')) return 'ism';

  // Arquivos diretos
  if (urlLower.includes('.mp4')) return 'mp4';
  if (urlLower.includes('.webm')) return 'webm';
  if (urlLower.includes('.mkv')) return 'mkv';
  if (urlLower.includes('.avi')) return 'avi';
  if (urlLower.includes('.mov')) return 'mov';
  if (urlLower.includes('.flv')) return 'flv';
  if (urlLower.includes('.ts')) return 'ts';
  if (urlLower.includes('.m4v')) return 'm4v';
  if (urlLower.includes('.3gp')) return '3gp';
  if (urlLower.includes('.ogg') || urlLower.includes('.ogv')) return 'ogg';

  return undefined;
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
// SCRIPTS JAVASCRIPT INJETADOS
// =============================================================================

/**
 * Gera o script JavaScript completo para injeção no WebView
 * @returns String com o código JavaScript
 */
export function generateInjectedJavaScript(): string {
  return `
(function() {
  'use strict';

  // ===== ANTI-DETECTION =====
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

  // ===== POPUP BLOCKING =====
  var noop = function() { return null; };

  window.open = noop;
  Object.defineProperty(window, 'open', { value: noop, writable: false, configurable: false });

  window.alert = noop;
  window.confirm = function() { return false; };
  window.prompt = function() { return null; };

  if (window.Notification) {
    window.Notification.requestPermission = function() { return Promise.resolve('denied'); };
  }

  // ===== AD DOMAIN BLOCKING =====
  var adDomains = ${JSON.stringify(AD_DOMAINS)};

  function isAdUrl(url) {
    if (!url || typeof url !== 'string') return false;
    var urlLower = url.toLowerCase();
    for (var i = 0; i < adDomains.length; i++) {
      if (urlLower.indexOf(adDomains[i]) !== -1) return true;
    }
    if (urlLower.match(/[?&](ad|ads|advert|banner|sponsor|track|click|pixel)[=_-]/i)) return true;
    if (urlLower.match(/\\/(ad|ads|advert|banner|sponsor|track|click|pixel)[\\/\\.?]/i)) return true;
    return false;
  }

  // ===== XHR INTERCEPTION =====
  var originalXHROpen = XMLHttpRequest.prototype.open;
  var originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    this._blocked = isAdUrl(url);
    if (this._blocked) {
      console.log('[H5TV] Blocked ad XHR:', url);
      return;
    }
    return originalXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    if (this._blocked) {
      Object.defineProperty(this, 'status', { value: 0 });
      Object.defineProperty(this, 'readyState', { value: 4 });
      Object.defineProperty(this, 'responseText', { value: '' });
      Object.defineProperty(this, 'response', { value: '' });
      var self = this;
      setTimeout(function() {
        if (self.onerror) self.onerror(new Error('Blocked'));
        if (self.onloadend) self.onloadend();
      }, 0);
      return;
    }
    return originalXHRSend.apply(this, arguments);
  };

  // ===== FETCH INTERCEPTION =====
  var originalFetch = window.fetch;
  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url);
    if (isAdUrl(url)) {
      console.log('[H5TV] Blocked ad fetch:', url);
      return Promise.reject(new Error('Blocked ad request'));
    }
    return originalFetch.apply(this, arguments);
  };

  // ===== CSS AD HIDING =====
  var adBlockStyles = document.createElement('style');
  adBlockStyles.id = 'h5tv-adblock';
  adBlockStyles.innerHTML = \`${AD_BLOCK_CSS.replace(/`/g, '\\`')}\`;

  function injectAdBlockStyles() {
    if (!document.getElementById('h5tv-adblock')) {
      (document.head || document.documentElement).appendChild(adBlockStyles.cloneNode(true));
    }
  }
  injectAdBlockStyles();

  // ===== CLICK HIJACK PREVENTION =====
  document.addEventListener('click', function(e) {
    var target = e.target;
    var depth = 0;
    while (target && depth < 15) {
      if (target.tagName === 'A') {
        var href = target.href || '';
        if (target.target === '_blank' || isAdUrl(href)) {
          console.log('[H5TV] Blocked click on:', href);
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }
      }
      target = target.parentElement;
      depth++;
    }
  }, true);

  window.addEventListener('click', function(e) {
    if (e.target.tagName === 'A' && e.target.target === '_blank') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, true);

  // ===== VIDEO URL REGEX =====
  var videoRegex = /${VIDEO_REGEX_STRING}/i;

  // ===== STREAM DETECTION =====
  function sendStreamUrl(url, source) {
    if (!url || typeof url !== 'string') return;
    if (videoRegex.test(url) && !isAdUrl(url)) {
      var topWindow = window;
      try { while(topWindow.parent && topWindow.parent !== topWindow) topWindow = topWindow.parent; } catch(e) {}
      try {
        topWindow.ReactNativeWebView.postMessage(JSON.stringify({
          type: source,
          url: url,
          headers: {
            'Cookie': document.cookie || '',
            'User-Agent': navigator.userAgent,
            'Referer': window.location.href,
            'Origin': window.location.origin
          }
        }));
        console.log('[H5TV] Stream detected (' + source + '):', url);
      } catch(e) {}
    }
  }

  // ===== INTERCEPT REQUESTS =====
  function interceptRequests(targetWindow) {
    try {
      var origOpen = targetWindow.XMLHttpRequest.prototype.open;
      targetWindow.XMLHttpRequest.prototype.open = function(method, url) {
        sendStreamUrl(url, 'xhr');
        return origOpen.apply(this, arguments);
      };

      var origFetch = targetWindow.fetch;
      targetWindow.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url);
        sendStreamUrl(url, 'fetch');
        return origFetch.apply(this, arguments);
      };

      var origCreate = targetWindow.document.createElement.bind(targetWindow.document);
      targetWindow.document.createElement = function(tagName) {
        var el = origCreate(tagName);
        var tag = tagName.toLowerCase();
        if (tag === 'video' || tag === 'source' || tag === 'audio') {
          var origSet = el.setAttribute.bind(el);
          el.setAttribute = function(name, value) {
            if (name === 'src') sendStreamUrl(value, 'element-attr');
            return origSet(name, value);
          };
          Object.defineProperty(el, 'src', {
            set: function(v) { sendStreamUrl(v, 'element-src'); origSet('src', v); },
            get: function() { return el.getAttribute('src'); }
          });
        }
        return el;
      };
    } catch(e) { console.log('[H5TV] interceptRequests error:', e); }
  }

  // ===== IFRAME INJECTION =====
  function injectIntoIframe(iframe) {
    try {
      var iframeWin = iframe.contentWindow;
      var iframeDoc = iframe.contentDocument || (iframeWin && iframeWin.document);
      if (iframeWin && iframeDoc) {
        interceptRequests(iframeWin);
        injectAdBlockStyles.call({ doc: iframeDoc });
        observeIframes(iframeDoc);
        observeVideoElements(iframeDoc);

        iframeWin.open = noop;
        iframeWin.alert = noop;
        iframeWin.confirm = function() { return false; };
      }
    } catch(e) {}
  }

  function observeIframes(doc) {
    try {
      var iframes = doc.querySelectorAll('iframe');
      iframes.forEach(function(iframe) {
        iframe.addEventListener('load', function() { injectIntoIframe(iframe); });
        try { injectIntoIframe(iframe); } catch(e) {}
      });

      var obs = new MutationObserver(function(muts) {
        muts.forEach(function(m) {
          m.addedNodes.forEach(function(n) {
            if (n.nodeType === 1) {
              if (n.tagName === 'IFRAME') {
                n.addEventListener('load', function() { injectIntoIframe(n); });
                if (isAdUrl(n.src)) {
                  n.src = 'about:blank';
                  n.style.display = 'none';
                }
              }
              var nested = n.querySelectorAll ? n.querySelectorAll('iframe') : [];
              nested.forEach(function(f) {
                f.addEventListener('load', function() { injectIntoIframe(f); });
                if (isAdUrl(f.src)) {
                  f.src = 'about:blank';
                  f.style.display = 'none';
                }
              });
            }
          });
        });
      });
      obs.observe(doc.body || doc.documentElement, { childList: true, subtree: true });
    } catch(e) {}
  }

  function observeVideoElements(doc) {
    try {
      doc.querySelectorAll('video, source, audio').forEach(function(v) {
        if (v.src) sendStreamUrl(v.src, 'video-element');
        if (v.currentSrc) sendStreamUrl(v.currentSrc, 'video-currentSrc');
      });

      var obs = new MutationObserver(function(muts) {
        muts.forEach(function(m) {
          m.addedNodes.forEach(function(n) {
            if (n.nodeType === 1) {
              var tag = n.tagName;
              if (tag === 'VIDEO' || tag === 'SOURCE' || tag === 'AUDIO') {
                if (n.src) sendStreamUrl(n.src, 'video-added');
                if (n.currentSrc) sendStreamUrl(n.currentSrc, 'video-currentSrc');
              }
              var vids = n.querySelectorAll ? n.querySelectorAll('video, source, audio') : [];
              vids.forEach(function(v) {
                if (v.src) sendStreamUrl(v.src, 'video-nested');
                if (v.currentSrc) sendStreamUrl(v.currentSrc, 'video-nested-currentSrc');
              });
            }
          });
          if (m.type === 'attributes' && (m.attributeName === 'src' || m.attributeName === 'currentSrc')) {
            var src = m.target.src || m.target.getAttribute('src') || m.target.currentSrc;
            if (src) sendStreamUrl(src, 'video-attr-change');
          }
        });
      });
      obs.observe(doc.body || doc.documentElement, {
        childList: true, subtree: true,
        attributes: true, attributeFilter: ['src', 'currentSrc']
      });
    } catch(e) {}
  }

  // ===== DYNAMIC AD REMOVAL =====
  var adObserver = new MutationObserver(function(muts) {
    muts.forEach(function(m) {
      m.addedNodes.forEach(function(n) {
        if (n.nodeType !== 1) return;
        var tag = n.tagName ? n.tagName.toLowerCase() : '';
        var cls = (n.className || '').toLowerCase();
        var id = (n.id || '').toLowerCase();

        if (tag === 'iframe' && isAdUrl(n.src)) {
          n.remove();
          return;
        }

        if (cls.match(/ad[s]?[-_]|advert|sponsor|banner|popup|overlay/i) ||
            id.match(/ad[s]?[-_]|advert|sponsor|banner|popup|overlay/i)) {
          n.style.display = 'none';
        }

        if (tag === 'script' && isAdUrl(n.src)) {
          n.remove();
        }
      });
    });
  });

  function startAdObserver() {
    if (document.body) {
      adObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  // ===== INITIALIZATION =====
  interceptRequests(window);
  observeIframes(document);
  observeVideoElements(document);
  startAdObserver();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      injectAdBlockStyles();
      observeIframes(document);
      observeVideoElements(document);
      startAdObserver();
    });
  }

  setInterval(function() {
    document.querySelectorAll('video, audio').forEach(function(v) {
      if (v.currentSrc && !v._h5tvChecked) {
        v._h5tvChecked = true;
        sendStreamUrl(v.currentSrc, 'video-periodic');
      }
    });
  }, 2000);

  console.log('[H5TV] AdBlock and Stream Interceptor initialized');
})();
`;
}

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
  AD_DOMAINS,
  AD_URL_PATTERNS,
  AD_BLOCK_CSS,
  AD_BLOCK_CSS_MINIMAL,
  isAdUrl,
  isVideoUrl,
  isValidStreamUrl,
  generateInjectedJavaScript,
  generateNativeAdBlockScript,
  getAdDomainsForKotlin,
  getVideoRegexForKotlin,
};
