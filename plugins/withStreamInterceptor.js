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
 */
function generateNativeAdBlockScript() {
  return `
(function() {
  var style = document.createElement('style');
  style.innerHTML = \\\`${AD_BLOCK_CSS_MINIMAL.replace(/`/g, '\\`')}\\\`;
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
import android.util.AttributeSet
import android.util.Log
import android.webkit.*
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.RCTEventEmitter

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

    init {
        setupWebView()
    }

    fun setStreamDetectedCallback(callback: (String, Map<String, String>) -> Unit) {
        streamDetectedCallback = callback
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = true
            allowContentAccess = true
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = false
            userAgentString = DEFAULT_USER_AGENT

            // Enable mixed content for streams
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

            // Cache settings
            cacheMode = WebSettings.LOAD_DEFAULT
        }

        // Cache the user agent for thread-safe access
        cachedUserAgent = settings.userAgentString

        webViewClient = StreamInterceptorWebViewClient()
        webChromeClient = StreamInterceptorChromeClient()
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
        return VIDEO_REGEX.containsMatchIn(url)
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
                Log.d(TAG, "Blocked ad: $url")
                return WebResourceResponse("text/plain", "UTF-8", null)
            }

            // Detect video streams
            if (isVideoUrl(url)) {
                val headers = mutableMapOf<String, String>()
                request.requestHeaders?.forEach { (key, value) ->
                    headers[key] = value
                }
                // Use cached user agent (thread-safe)
                headers["User-Agent"] = cachedUserAgent

                // Get referer from request headers (already available)
                if (!headers.containsKey("Referer")) {
                    // Note: view.url is not safe to access here, use empty string as fallback
                    headers["Referer"] = request.requestHeaders?.get("Referer") ?: ""
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
            Log.d(TAG, "Page started: $url")
        }

        override fun onPageFinished(view: WebView, url: String?) {
            super.onPageFinished(view, url)
            Log.d(TAG, "Page finished: $url")

            // Inject ad-blocking script (sincronizado com streamInterceptor.ts)
            val adBlockScript = """
                ${generateNativeAdBlockScript()}
            """.trimIndent()

            view.evaluateJavascript(adBlockScript, null)
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
