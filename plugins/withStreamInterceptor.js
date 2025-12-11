const { withMainApplication, withAndroidManifest } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to add Stream Interceptor WebView module
 * This module intercepts all network requests from WebView (including cross-origin iframes)
 * to detect video streams (.m3u8, .mpd, etc.)
 *
 * Este plugin usa constantes compartilhadas com src/utils/streamInterceptor.ts
 */

// =============================================================================
// CONSTANTES COMPARTILHADAS (Sincronizadas com src/utils/streamInterceptor.ts)
// =============================================================================

/**
 * User-Agent padrão (deve ser igual ao de streamInterceptor.ts)
 */
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";

/**
 * Regex de detecção de vídeo (deve ser igual ao de streamInterceptor.ts)
 */
const VIDEO_REGEX_STRING = String.raw`\.(mp4|mp4v|mpv|m1v|m4v|mpg|mpg2|mpeg|xvid|webm|3gp|avi|mov|mkv|ogg|ogv|ogm|m3u8|mpd|ism(?:[vc]|/manifest)?)(?:[?#]|$)`;

/**
 * Lista unificada de domínios de anúncios (sincronizada com streamInterceptor.ts)
 */
const AD_DOMAINS = [
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
];

/**
 * CSS simplificado para bloqueio de anúncios (sincronizado com streamInterceptor.ts)
 */
const AD_BLOCK_CSS_MINIMAL = `
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
`.trim();

// =============================================================================
// HELPERS PARA GERAR CÓDIGO KOTLIN
// =============================================================================

/**
 * Gera a lista de domínios formatada para Kotlin Set
 */
function generateKotlinAdDomains() {
    return AD_DOMAINS.map(d => `            "${d}"`).join(',\n');
}

/**
 * Gera o script JavaScript para injeção no onPageFinished
 * Inclui: AdBlock, bloqueio de popups, técnicas de autoplay
 */
function generateNativeAdBlockScript() {
    return `
(function() {
  'use strict';
  
  // ===== AD BLOCK CSS =====
  var style = document.createElement('style');
  style.innerHTML = \\\`${AD_BLOCK_CSS_MINIMAL.replace(/`/g, '\\`')}\\\`;
  document.head.appendChild(style);

  // ===== POPUP BLOCKING =====
  window.open = function() { return null; };
  window.alert = function() {};
  window.confirm = function() { return false; };
  window.prompt = function() { return null; };

  // ===== CLICK HIJACK PREVENTION =====
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

  // ===== AUTOPLAY TECHNIQUES =====
  
  // 1. Forçar autoplay em todos os vídeos
  function forceAutoplay() {
    document.querySelectorAll('video').forEach(function(v) {
      try {
        v.muted = true;
        v.autoplay = true;
        v.playsInline = true;
        v.setAttribute('autoplay', '');
        v.setAttribute('playsinline', '');
        v.setAttribute('webkit-playsinline', '');
        v.removeAttribute('controls');
        v.play().catch(function(){});
      } catch(e) {}
    });
  }
  
  // 2. Simular interação do usuário
  function simulateInteraction() {
    try {
      ['click', 'touchstart', 'touchend', 'mousedown', 'mouseup'].forEach(function(type) {
        document.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
      });
    } catch(e) {}
  }
  
  // 3. Clicar em botões de play conhecidos
  function clickPlayButtons() {
    var selectors = [
      '.ytp-large-play-button',
      '.ytp-play-button',
      '[class*="play-button"]',
      '[class*="playButton"]',
      '[class*="play_button"]',
      '[aria-label*="play" i]',
      '[aria-label*="Play" i]',
      '[title*="play" i]',
      '[title*="Play" i]',
      'button[class*="play"]',
      'div[class*="play"]',
      '.vjs-big-play-button',
      '.jw-icon-playback',
      '.plyr__control--overlaid',
      '[data-testid="play-button"]'
    ];
    selectors.forEach(function(sel) {
      try {
        document.querySelectorAll(sel).forEach(function(el) {
          if (el.offsetParent !== null) {
            el.click();
          }
        });
      } catch(e) {}
    });
  }
  
  // 4. Forçar fullscreen em iframes de vídeo
  function expandVideoIframes() {
    document.querySelectorAll('iframe').forEach(function(iframe) {
      try {
        var src = iframe.src || '';
        if (src.match(/youtube|vimeo|dailymotion|twitch|facebook.*video/i)) {
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.style.position = 'fixed';
          iframe.style.top = '0';
          iframe.style.left = '0';
          iframe.style.zIndex = '9999';
          iframe.setAttribute('allowfullscreen', '');
          iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
        }
      } catch(e) {}
    });
  }
  
  // 5. Observer para novos elementos de vídeo
  var videoObserver = new MutationObserver(function(mutations) {
    var hasNewVideo = false;
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(n) {
        if (n.nodeType === 1) {
          if (n.tagName === 'VIDEO' || n.tagName === 'IFRAME') {
            hasNewVideo = true;
          }
          if (n.querySelector && (n.querySelector('video') || n.querySelector('iframe'))) {
            hasNewVideo = true;
          }
        }
      });
    });
    if (hasNewVideo) {
      setTimeout(forceAutoplay, 100);
      setTimeout(clickPlayButtons, 300);
    }
  });
  
  // 6. Forçar YouTube a iniciar automaticamente
  function forceYouTubePlay() {
    try {
      // YouTube Player API
      if (window.YT && window.YT.Player) {
        document.querySelectorAll('iframe[src*="youtube"]').forEach(function(iframe) {
          try {
            var player = new YT.Player(iframe);
            player.playVideo && player.playVideo();
          } catch(e) {}
        });
      }
      // YouTube embeds
      document.querySelectorAll('.html5-video-player').forEach(function(p) {
        try {
          var v = p.querySelector('video');
          if (v) { v.muted = true; v.play().catch(function(){}); }
        } catch(e) {}
      });
    } catch(e) {}
  }
  
  // ===== EXECUTAR TÉCNICAS =====
  simulateInteraction();
  forceAutoplay();
  
  // Múltiplas tentativas com delays
  setTimeout(forceAutoplay, 300);
  setTimeout(forceAutoplay, 800);
  setTimeout(forceAutoplay, 1500);
  setTimeout(clickPlayButtons, 500);
  setTimeout(clickPlayButtons, 1200);
  setTimeout(clickPlayButtons, 2500);
  setTimeout(expandVideoIframes, 400);
  setTimeout(forceYouTubePlay, 1000);
  setTimeout(forceYouTubePlay, 2000);
  
  // Observer
  if (document.body) {
    videoObserver.observe(document.body, { childList: true, subtree: true });
  }
  
  console.log('[H5TV] AdBlock + Autoplay initialized');
})();
`.trim();
}

// =============================================================================
// CÓDIGO KOTLIN GERADO
// =============================================================================

const KOTLIN_PACKAGE = 'package com.hellfiveosborn.H5TV';

// StreamInterceptorWebView.kt - Custom WebView that intercepts all requests
const STREAM_INTERCEPTOR_WEBVIEW_KOTLIN = `${KOTLIN_PACKAGE}

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.util.AttributeSet
import android.util.Log
import android.view.View
import android.webkit.*
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.RCTEventEmitter
import java.util.Locale

/**
 * StreamInterceptorWebView - Custom WebView with stream URL detection
 *
 * COMPATIBILITY FIX:
 * - Android 7.x (API 24-25): Uses software rendering to avoid black screen issues
 * - Android 8.x (API 26-27): Uses hardware rendering but with enhanced error handling
 * - Android 9+ (API 28+): Full hardware acceleration with all features
 *
 * The black screen issue on older devices (especially armeabi-v7a) is typically caused by:
 * 1. Hardware acceleration incompatibility with the GPU
 * 2. WebView version being outdated
 * 3. Memory constraints on 32-bit devices
 */
@SuppressLint("SetJavaScriptEnabled")
class StreamInterceptorWebView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : WebView(context, attrs, defStyleAttr) {

    companion object {
        private const val TAG = "StreamInterceptor"
        private const val DEFAULT_USER_AGENT = "${USER_AGENT}"

        // Video/Stream URL patterns (sincronizado com streamInterceptor.ts)
        private val VIDEO_REGEX = Regex(
            """${VIDEO_REGEX_STRING}""",
            RegexOption.IGNORE_CASE
        )
        
        // YouTube Live/Stream specific patterns
        private val YOUTUBE_STREAM_PATTERNS = listOf(
            // YouTube HLS manifests
            Regex("""manifest\\.googlevideo\\.com.*\\.m3u8""", RegexOption.IGNORE_CASE),
            Regex("""googlevideo\\.com.*\\.m3u8""", RegexOption.IGNORE_CASE),
            Regex("""youtube\\.com.*\\.m3u8""", RegexOption.IGNORE_CASE),
            // YouTube video playback
            Regex("""googlevideo\\.com/videoplayback\\?.*mime=video""", RegexOption.IGNORE_CASE),
            Regex("""r[0-9]+---sn-.*\\.googlevideo\\.com""", RegexOption.IGNORE_CASE),
            // YouTube live streams
            Regex("""youtube\\.com/live_stream""", RegexOption.IGNORE_CASE),
            Regex("""youtube\\.com.*live.*\\.m3u8""", RegexOption.IGNORE_CASE),
            // ytimg HLS
            Regex("""i\\.ytimg\\.com.*\\.m3u8""", RegexOption.IGNORE_CASE),
            // Twitch patterns
            Regex("""usher\\.ttvnw\\.net.*\\.m3u8""", RegexOption.IGNORE_CASE),
            Regex("""video-weaver\\..*\\.hls\\.ttvnw\\.net""", RegexOption.IGNORE_CASE),
            // Facebook Live
            Regex("""video\\.xx\\.fbcdn\\.net.*\\.m3u8""", RegexOption.IGNORE_CASE),
            Regex("""facebook\\.com.*\\.m3u8""", RegexOption.IGNORE_CASE),
            // DailyMotion
            Regex("""proxy.*\\.dailymotion\\.com.*\\.m3u8""", RegexOption.IGNORE_CASE),
            // Vimeo
            Regex("""vimeo.*\\.akamaized\\.net.*\\.m3u8""", RegexOption.IGNORE_CASE),
            Regex("""skyfire\\.vimeocdn\\.com.*\\.m3u8""", RegexOption.IGNORE_CASE)
        )

        // Ad/Tracking domains to block (sincronizado com streamInterceptor.ts)
        private val AD_DOMAINS = setOf(
${generateKotlinAdDomains()}
        )
    }

    private var streamDetectedCallback: ((String, Map<String, String>) -> Unit)? = null
    private val detectedUrls = mutableSetOf<String>()

    // Cached user agent for thread-safe access from shouldInterceptRequest
    @Volatile
    private var cachedUserAgent: String = DEFAULT_USER_AGENT

    // Store current page URL for Referer/Origin generation
    @Volatile
    private var currentPageUrl: String = ""

    init {
        setupCookieManager()
        setupWebView()
        
        // === KEYBOARD/INPUT FOCUS FIX ===
        // Enable focus for input fields to show keyboard
        isFocusable = true
        isFocusableInTouchMode = true
        requestFocusFromTouch()
        
        // Handle focus changes to ensure keyboard appears
        setOnFocusChangeListener { view, hasFocus ->
            if (hasFocus) {
                Log.d(TAG, "WebView gained focus - enabling keyboard input")
                view.requestFocus()
            }
        }
        
        // Request focus to be ready for input
        requestFocus()
    }
    
    /**
     * Configure CookieManager for persistent cookies across sessions
     * This is crucial for Cloudflare bypass as cf_clearance cookie needs to persist
     */
    private fun setupCookieManager() {
        try {
            val cookieManager = CookieManager.getInstance()
            cookieManager.setAcceptCookie(true)
            
            // Accept third-party cookies (required for some CDN/Cloudflare scenarios)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                cookieManager.setAcceptThirdPartyCookies(this, true)
            }
            
            // Flush cookies to persistent storage
            cookieManager.flush()
            
            Log.d(TAG, "CookieManager configured for persistent cookies")
        } catch (e: Exception) {
            Log.e(TAG, "Error configuring CookieManager: \${e.message}")
        }
    }

    fun setStreamDetectedCallback(callback: (String, Map<String, String>) -> Unit) {
        streamDetectedCallback = callback
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        settings.apply {
            // === JAVASCRIPT & DOM (Required for Cloudflare) ===
            javaScriptEnabled = true
            domStorageEnabled = true  // localStorage, sessionStorage
            databaseEnabled = true    // Web SQL Database
            
            // === MEDIA PLAYBACK ===
            mediaPlaybackRequiresUserGesture = false
            
            // === FILE ACCESS ===
            allowFileAccess = true
            allowContentAccess = true
            
            // === VIEWPORT ===
            loadWithOverviewMode = true
            useWideViewPort = true
            
            // === WINDOWS/POPUPS ===
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = false
            
            // === USER AGENT (Realistic Chrome Desktop - Cloudflare bypass) ===
            userAgentString = DEFAULT_USER_AGENT

            // === MIXED CONTENT (Required for streams) ===
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

            // === CACHE SETTINGS ===
            cacheMode = WebSettings.LOAD_DEFAULT
            
            // === GEOLOCATION ===
            setGeolocationEnabled(false)
            
            // === ZOOM CONTROLS ===
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            
            // === NETWORK IMAGES ===
            blockNetworkImage = false
            loadsImagesAutomatically = true
            
            // === TEXT ENCODING ===
            defaultTextEncodingName = "UTF-8"
            
            // === SAFE BROWSING (Disable for streaming sites) ===
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                safeBrowsingEnabled = false
            }
        }

        // Cache the user agent for thread-safe access
        cachedUserAgent = settings.userAgentString
        
        // Configure rendering layer based on device capabilities
        configureLayerType()

        webViewClient = StreamInterceptorWebViewClient()
        webChromeClient = StreamInterceptorChromeClient()
        
        // Enable hardware acceleration at view level
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
        }
        
        Log.d(TAG, "WebView configured for API \${Build.VERSION.SDK_INT} with Cloudflare bypass settings")
    }
    
    /**
     * Configure layer type for optimal rendering based on device capabilities
     *
     * COMPATIBILITY FIX:
     * - Android 7.x (API 24-25): Software rendering (most compatible)
     * - Android 8+ (API 26+): Hardware rendering (better performance)
     *
     * Software rendering is slower but avoids black screen issues on:
     * - Budget devices with limited GPU capabilities
     * - 32-bit devices (armeabi-v7a) with older GPUs
     * - Devices with outdated System WebView versions
     */
    private fun configureLayerType() {
        val sdkVersion = Build.VERSION.SDK_INT
        
        when {
            // Android 7.0-7.1 (API 24-25): Use software rendering
            // These versions have known WebView rendering issues with hardware acceleration
            sdkVersion in 24..25 -> {
                Log.d(TAG, "Using SOFTWARE rendering for Android 7.x (API \$sdkVersion)")
                setLayerType(View.LAYER_TYPE_SOFTWARE, null)
            }
            
            // Android 8.0-8.1 (API 26-27): Use hardware with caution
            // Some devices still have issues, but most work fine
            sdkVersion in 26..27 -> {
                Log.d(TAG, "Using HARDWARE rendering for Android 8.x (API \$sdkVersion)")
                setLayerType(View.LAYER_TYPE_HARDWARE, null)
            }
            
            // Android 9+ (API 28+): Full hardware acceleration
            else -> {
                Log.d(TAG, "Using HARDWARE rendering for Android 9+ (API \$sdkVersion)")
                setLayerType(View.LAYER_TYPE_HARDWARE, null)
            }
        }
    }

    // Update cached user agent when changed externally
    fun updateUserAgent(userAgent: String) {
        settings.userAgentString = userAgent
        cachedUserAgent = userAgent
    }

    private fun isAdDomain(url: String): Boolean {
        return try {
            val host = Uri.parse(url).host?.lowercase() ?: return false
            AD_DOMAINS.any { domain -> host.endsWith(domain) || host == domain }
        } catch (e: Exception) {
            false
        }
    }

    private fun isVideoUrl(url: String): Boolean {
        // Check standard video extensions
        if (VIDEO_REGEX.containsMatchIn(url)) return true
        
        // Check platform-specific stream patterns (YouTube, Twitch, etc.)
        return YOUTUBE_STREAM_PATTERNS.any { it.containsMatchIn(url) }
    }
    
    /**
     * Check if URL is a YouTube live stream specifically
     */
    private fun isYouTubeLiveUrl(url: String): Boolean {
        return url.contains("googlevideo.com") ||
               url.contains("youtube.com/live") ||
               (url.contains("youtube") && url.contains(".m3u8"))
    }

    private fun notifyStreamDetected(url: String, headers: Map<String, String>) {
        if (detectedUrls.contains(url)) return
        detectedUrls.add(url)

        Log.d(TAG, "Stream detected: $url")
        streamDetectedCallback?.invoke(url, headers)

        // Also emit React Native event
        (context as? ReactContext)?.let { reactContext ->
            val event = Arguments.createMap().apply {
                putString("url", url)
                putMap("headers", Arguments.createMap().apply {
                    headers.forEach { (key, value) -> putString(key, value) }
                })
            }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                ?.receiveEvent(id, "onStreamDetected", event)
        }
    }

    fun clearDetectedUrls() {
        detectedUrls.clear()
    }

    private inner class StreamInterceptorWebViewClient : WebViewClient() {

        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            val url = request.url.toString()

            // Block ads
            if (isAdDomain(url)) {
                Log.d(TAG, "Blocked ad: \$url")
                return WebResourceResponse("text/plain", "UTF-8", null)
            }

            // Detect video streams
            if (isVideoUrl(url)) {
                val headers = mutableMapOf<String, String>()
                request.requestHeaders?.forEach { (key, value) ->
                    headers[key] = value
                }
                
                // === REALISTIC HEADERS FOR CLOUDFLARE BYPASS ===
                
                // User-Agent (realistic Chrome)
                headers["User-Agent"] = cachedUserAgent
                
                // Accept headers (like a real browser)
                if (!headers.containsKey("Accept")) {
                    headers["Accept"] = "*/*"
                }
                if (!headers.containsKey("Accept-Language")) {
                    headers["Accept-Language"] = "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
                }
                if (!headers.containsKey("Accept-Encoding")) {
                    headers["Accept-Encoding"] = "gzip, deflate, br"
                }
                
                // Referer
                if (!headers.containsKey("Referer")) {
                    val reqReferer = request.requestHeaders?.get("Referer")
                    if (!reqReferer.isNullOrEmpty()) {
                        headers["Referer"] = reqReferer
                    } else {
                        headers["Referer"] = currentPageUrl
                    }
                }
                
                // Origin header for CORS
                if (!headers.containsKey("Origin")) {
                    if (currentPageUrl.isNotEmpty()) {
                        try {
                            val uri = Uri.parse(currentPageUrl)
                            headers["Origin"] = "\${uri.scheme}://\${uri.host}"
                        } catch (e: Exception) {
                            val uri = Uri.parse(url)
                            headers["Origin"] = "\${uri.scheme}://\${uri.host}"
                        }
                    } else {
                        val uri = Uri.parse(url)
                        headers["Origin"] = "\${uri.scheme}://\${uri.host}"
                    }
                }
                
                // Sec-Fetch headers (modern browsers)
                headers["Sec-Fetch-Dest"] = "empty"
                headers["Sec-Fetch-Mode"] = "cors"
                headers["Sec-Fetch-Site"] = "cross-site"
                
                // Get cookies for this domain (including cf_clearance)
                try {
                    val cookies = CookieManager.getInstance().getCookie(url)
                    if (!cookies.isNullOrEmpty()) {
                        headers["Cookie"] = cookies
                        Log.d(TAG, "Including cookies for stream request")
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Could not get cookies: \${e.message}")
                }
                
                // Log YouTube Live detection specifically
                if (isYouTubeLiveUrl(url)) {
                    Log.d(TAG, "YouTube Live stream detected: \$url")
                }

                notifyStreamDetected(url, headers)
            }

            return super.shouldInterceptRequest(view, request)
        }

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val url = request.url.toString()

            // Block external app intents
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                Log.d(TAG, "Blocked external URL: $url")
                return true
            }

            // Block ad URLs
            if (isAdDomain(url)) {
                Log.d(TAG, "Blocked ad navigation: $url")
                return true
            }

            // Check for video URL in navigation
            if (isVideoUrl(url)) {
                val headers = mapOf(
                    "User-Agent" to cachedUserAgent,
                    "Referer" to (view.url ?: "")
                )
                notifyStreamDetected(url, headers)
            }

            return false
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            super.onPageStarted(view, url, favicon)
            url?.let { currentPageUrl = it }
            Log.d(TAG, "Page started: $url")
            
            // Emit loadStart event to React Native
            emitLoadEvent("onLoadStart", url ?: "")
        }

        override fun onPageFinished(view: WebView, url: String?) {
            super.onPageFinished(view, url)
            Log.d(TAG, "Page finished: \$url")
            
            // Sync cookies to persistent storage (important for Cloudflare cf_clearance)
            try {
                CookieManager.getInstance().flush()
                val cookies = CookieManager.getInstance().getCookie(url)
                if (cookies?.contains("cf_clearance") == true) {
                    Log.d(TAG, "Cloudflare clearance cookie detected and persisted")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Could not flush cookies: \${e.message}")
            }

            // Inject ad-blocking + autoplay script
            val adBlockScript = """
                ${generateNativeAdBlockScript()}
            """.trimIndent()

            view.evaluateJavascript(adBlockScript, null)
            
            // Emit loadEnd event to React Native
            emitLoadEvent("onLoadEnd", url ?: "")
            
            // Emit navigation state change event with canGoBack/canGoForward
            emitNavigationStateChange(view, url ?: "")
        }
        
        /**
         * Handle WebView errors - COMPATIBILITY FIX
         * Emits error event to React Native so fallback can be triggered
         */
        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            super.onReceivedError(view, request, error)
            
            // Only report main frame errors
            if (request.isForMainFrame) {
                val errorCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    error.errorCode
                } else {
                    -1
                }
                val description = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    error.description.toString()
                } else {
                    "Unknown error"
                }
                
                Log.e(TAG, "WebView error: \$errorCode - \$description for \${request.url}")
                emitErrorEvent(request.url.toString(), "error_\$errorCode: \$description")
            }
        }
        
        /**
         * Handle HTTP errors (4xx, 5xx responses)
         */
        override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, errorResponse: WebResourceResponse) {
            super.onReceivedHttpError(view, request, errorResponse)
            
            // Only report main frame errors
            if (request.isForMainFrame) {
                val statusCode = errorResponse.statusCode
                Log.e(TAG, "HTTP error: \$statusCode for \${request.url}")
                emitErrorEvent(request.url.toString(), "http_\$statusCode")
            }
        }
        
        /**
         * Handle render process crash - CRITICAL for stability
         * This prevents the app from crashing when WebView's render process dies
         */
        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail?): Boolean {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val crashed = detail?.didCrash() ?: false
                Log.e(TAG, "Render process gone! Crashed: \$crashed")
                emitErrorEvent("", "render_process_gone_crashed_\$crashed")
                
                // Return true to handle the crash ourselves (don't let app crash)
                // React Native side should trigger fallback to JS WebView
                return true
            }
            return super.onRenderProcessGone(view, detail)
        }
        
        private fun emitLoadEvent(eventName: String, url: String) {
            (context as? ReactContext)?.let { reactContext ->
                val event = Arguments.createMap().apply {
                    putString("url", url)
                }
                reactContext.getJSModule(RCTEventEmitter::class.java)
                    ?.receiveEvent(id, eventName, event)
            }
        }
        
        private fun emitErrorEvent(url: String, description: String) {
            (context as? ReactContext)?.let { reactContext ->
                val event = Arguments.createMap().apply {
                    putString("url", url)
                    putString("description", description)
                }
                reactContext.getJSModule(RCTEventEmitter::class.java)
                    ?.receiveEvent(id, "onError", event)
            }
        }
        
        private fun emitNavigationStateChange(view: WebView, url: String) {
            (context as? ReactContext)?.let { reactContext ->
                val event = Arguments.createMap().apply {
                    putString("url", url)
                    putBoolean("canGoBack", view.canGoBack())
                    putBoolean("canGoForward", view.canGoForward())
                    putString("title", view.title ?: "")
                }
                reactContext.getJSModule(RCTEventEmitter::class.java)
                    ?.receiveEvent(id, "onNavigationStateChange", event)
            }
        }
    }

    private inner class StreamInterceptorChromeClient : WebChromeClient() {

        override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: android.os.Message?): Boolean {
            // Block all popup windows
            Log.d(TAG, "Blocked popup window")
            return false
        }

        override fun onJsAlert(view: WebView, url: String?, message: String?, result: JsResult?): Boolean {
            result?.cancel()
            return true
        }

        override fun onJsConfirm(view: WebView, url: String?, message: String?, result: JsResult?): Boolean {
            result?.cancel()
            return true
        }

        override fun onJsPrompt(view: WebView, url: String?, message: String?, defaultValue: String?, result: JsPromptResult?): Boolean {
            result?.cancel()
            return true
        }
    }
}
`;

// StreamInterceptorModule.kt - React Native Module
const STREAM_INTERCEPTOR_MODULE_KOTLIN = `${KOTLIN_PACKAGE}

import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = StreamInterceptorModule.NAME)
class StreamInterceptorModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "StreamInterceptorModule"
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun clearDetectedUrls(viewTag: Int) {
        // This would be used to clear detected URLs for a specific WebView instance
        // Implementation would need access to the view manager
    }
}
`;

// StreamInterceptorViewManager.kt - React Native View Manager
const STREAM_INTERCEPTOR_VIEW_MANAGER_KOTLIN = `${KOTLIN_PACKAGE}

import android.view.View
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class StreamInterceptorViewManager(
    private val reactContext: ReactApplicationContext
) : SimpleViewManager<StreamInterceptorWebView>() {

    companion object {
        const val REACT_CLASS = "StreamInterceptorWebView"

        // Commands
        const val COMMAND_LOAD_URL = 1
        const val COMMAND_RELOAD = 2
        const val COMMAND_GO_BACK = 3
        const val COMMAND_GO_FORWARD = 4
        const val COMMAND_INJECT_JS = 5
        const val COMMAND_CLEAR_DETECTED = 6
    }

    override fun getName(): String = REACT_CLASS

    override fun createViewInstance(reactContext: ThemedReactContext): StreamInterceptorWebView {
        return StreamInterceptorWebView(reactContext)
    }

    @ReactProp(name = "source")
    fun setSource(view: StreamInterceptorWebView, source: com.facebook.react.bridge.ReadableMap?) {
        source?.let {
            if (it.hasKey("uri")) {
                val uri = it.getString("uri")
                uri?.let { url -> view.loadUrl(url) }
            } else if (it.hasKey("html")) {
                val html = it.getString("html")
                val baseUrl = if (it.hasKey("baseUrl")) it.getString("baseUrl") else null
                html?.let { h -> view.loadDataWithBaseURL(baseUrl, h, "text/html", "UTF-8", null) }
            }
        }
    }

    @ReactProp(name = "injectedJavaScript")
    fun setInjectedJavaScript(view: StreamInterceptorWebView, js: String?) {
        // Store for injection after page load
        view.tag = js
    }

    @ReactProp(name = "userAgent")
    fun setUserAgent(view: StreamInterceptorWebView, userAgent: String?) {
        userAgent?.let { view.updateUserAgent(it) }
    }

    override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> {
        return MapBuilder.builder<String, Any>()
            .put("onStreamDetected", MapBuilder.of("registrationName", "onStreamDetected"))
            .put("onLoadStart", MapBuilder.of("registrationName", "onLoadStart"))
            .put("onLoadEnd", MapBuilder.of("registrationName", "onLoadEnd"))
            .put("onNavigationStateChange", MapBuilder.of("registrationName", "onNavigationStateChange"))
            .put("onError", MapBuilder.of("registrationName", "onError"))
            .build()
            .toMutableMap()
    }

    override fun getCommandsMap(): MutableMap<String, Int> {
        return MapBuilder.builder<String, Int>()
            .put("loadUrl", COMMAND_LOAD_URL)
            .put("reload", COMMAND_RELOAD)
            .put("goBack", COMMAND_GO_BACK)
            .put("goForward", COMMAND_GO_FORWARD)
            .put("injectJavaScript", COMMAND_INJECT_JS)
            .put("clearDetectedUrls", COMMAND_CLEAR_DETECTED)
            .build()
            .toMutableMap()
    }

    override fun receiveCommand(view: StreamInterceptorWebView, commandId: Int, args: ReadableArray?) {
        when (commandId) {
            COMMAND_LOAD_URL -> args?.getString(0)?.let { view.loadUrl(it) }
            COMMAND_RELOAD -> view.reload()
            COMMAND_GO_BACK -> view.goBack()
            COMMAND_GO_FORWARD -> view.goForward()
            COMMAND_INJECT_JS -> args?.getString(0)?.let { view.evaluateJavascript(it, null) }
            COMMAND_CLEAR_DETECTED -> view.clearDetectedUrls()
        }
    }
}
`;

// StreamInterceptorPackage.kt - React Native Package
const STREAM_INTERCEPTOR_PACKAGE_KOTLIN = `${KOTLIN_PACKAGE}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class StreamInterceptorPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(StreamInterceptorModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return listOf(StreamInterceptorViewManager(reactContext))
    }
}
`;

// =============================================================================
// PLUGIN EXPO
// =============================================================================

const withStreamInterceptor = (config) => {
    // Modify MainApplication.kt to add StreamInterceptorPackage
    config = withMainApplication(config, (modConfig) => {
        const contents = modConfig.modResults.contents;

        // Write Kotlin files
        const projectRoot = modConfig.modRequest.projectRoot;
        const kotlinDir = path.join(projectRoot, 'android/app/src/main/java/com/hellfiveosborn/H5TV');

        // Ensure directory exists
        if (!fs.existsSync(kotlinDir)) {
            fs.mkdirSync(kotlinDir, { recursive: true });
        }

        // Write StreamInterceptorPackage.kt
        const packageFile = path.join(kotlinDir, 'StreamInterceptorPackage.kt');
        if (!fs.existsSync(packageFile)) {
            fs.writeFileSync(packageFile, STREAM_INTERCEPTOR_PACKAGE_KOTLIN);
        }

        // Write StreamInterceptorViewManager.kt
        const viewManagerFile = path.join(kotlinDir, 'StreamInterceptorViewManager.kt');
        if (!fs.existsSync(viewManagerFile)) {
            fs.writeFileSync(viewManagerFile, STREAM_INTERCEPTOR_VIEW_MANAGER_KOTLIN);
        }

        // Write StreamInterceptorWebView.kt
        const webViewFile = path.join(kotlinDir, 'StreamInterceptorWebView.kt');
        if (!fs.existsSync(webViewFile)) {
            fs.writeFileSync(webViewFile, STREAM_INTERCEPTOR_WEBVIEW_KOTLIN);
        }

        // Write StreamInterceptorModule.kt
        const moduleFile = path.join(kotlinDir, 'StreamInterceptorModule.kt');
        if (!fs.existsSync(moduleFile)) {
            fs.writeFileSync(moduleFile, STREAM_INTERCEPTOR_MODULE_KOTLIN);
        }

        // Check if already added
        if (contents.includes('StreamInterceptorPackage')) {
            return modConfig;
        }

        // Add the package to getPackages()
        const result = mergeContents({
            tag: 'stream-interceptor-package',
            src: contents,
            newSrc: '              add(StreamInterceptorPackage())',
            anchor: /add\(MyReactNativePackage\(\)\)/,
            offset: 0,
            comment: '//',
        });

        if (result.didMerge) {
            modConfig.modResults.contents = result.contents;
        } else {
            // Fallback: try to add after the comment line
            modConfig.modResults.contents = contents.replace(
                /\/\/ add\(MyReactNativePackage\(\)\)/,
                '// add(MyReactNativePackage())\n              add(StreamInterceptorPackage())'
            );
        }

        return modConfig;
    });

    return config;
};

// Export the Kotlin source code for reference
withStreamInterceptor.KOTLIN_FILES = {
    'StreamInterceptorWebView.kt': STREAM_INTERCEPTOR_WEBVIEW_KOTLIN,
    'StreamInterceptorModule.kt': STREAM_INTERCEPTOR_MODULE_KOTLIN,
    'StreamInterceptorViewManager.kt': STREAM_INTERCEPTOR_VIEW_MANAGER_KOTLIN,
    'StreamInterceptorPackage.kt': STREAM_INTERCEPTOR_PACKAGE_KOTLIN
};

// Export shared constants for reference
withStreamInterceptor.SHARED_CONSTANTS = {
    USER_AGENT,
    VIDEO_REGEX_STRING,
    AD_DOMAINS,
    AD_BLOCK_CSS_MINIMAL,
};

module.exports = withStreamInterceptor;
