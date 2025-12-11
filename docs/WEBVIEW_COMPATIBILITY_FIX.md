# WebView Compatibility Fix - Android 7+ / armeabi-v7a

## 📋 Problem Description

**Issue:** Some channels display a black screen on certain devices, particularly those running Android 7+ with armeabi-v7a (32-bit ARM) architecture. The WebView fails to load the player site, preventing stream URL detection.

**Affected Devices:**
- Android TV boxes with budget 32-bit processors
- Older smartphones (Android 7.0 - 8.1)
- Devices with outdated System WebView versions

---

## 🔍 Root Cause Analysis

### 1. WebView Version Incompatibility

The custom `StreamInterceptorWebView` (native Kotlin component) uses modern WebView features that may not be available or work correctly on older WebView versions:

```kotlin
// Current implementation in plugins/withStreamInterceptor.js
@SuppressLint("SetJavaScriptEnabled")
class StreamInterceptorWebView : WebView {
    // Uses shouldInterceptRequest which can behave differently on older WebViews
    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse?
}
```

**Impact:** On Android 7 devices with System WebView version < 70, the `shouldInterceptRequest` callback may not fire correctly for all requests, especially cross-origin iframe requests.

### 2. Hardware Acceleration Issues

The current implementation doesn't explicitly configure hardware acceleration based on device capabilities:

```kotlin
// Missing in current setupWebView()
setLayerType(View.LAYER_TYPE_HARDWARE, null) // Can cause black screen on some devices
```

**Impact:** Budget 32-bit devices often have limited GPU capabilities. Forcing hardware acceleration can cause rendering failures (black screen).

### 3. Memory Constraints on 32-bit Devices

armeabi-v7a devices typically have:
- 1-2GB RAM total
- 32-bit address space limitation
- Smaller heap sizes for apps

Heavy pages with ads, trackers, and video players can exhaust available memory before stream detection completes.

### 4. Missing WebSettings for Compatibility

Current WebSettings configuration lacks some settings needed for older devices:

```kotlin
// Current settings in setupWebView()
settings.apply {
    javaScriptEnabled = true
    domStorageEnabled = true
    mediaPlaybackRequiresUserGesture = false
    // Missing compatibility settings for older devices
}
```

### 5. No Graceful Fallback

When the native WebView component fails, the current implementation has no automatic fallback mechanism to the JavaScript-based WebView (`JSStreamWebView`).

---

## 🛠️ Proposed Solutions

### Solution 1: Device Detection and Automatic Fallback (High Priority)

**File:** `src/components/player/StreamWebView.tsx`

Add intelligent device detection to automatically use the JavaScript-based WebView for problematic devices:

```typescript
import { Platform, NativeModules } from 'react-native';

// Device capability check
const getDeviceCapabilities = () => {
  if (Platform.OS !== 'android') {
    return { useNativeWebView: false };
  }

  const androidVersion = Platform.Version;
  
  // Android 7.0 = API 24, Android 8.0 = API 26
  const isLegacyAndroid = androidVersion < 26;
  
  // Check if device is 32-bit (armeabi-v7a)
  // This requires a native module or can be approximated
  const abi = NativeModules.PlatformConstants?.reactNativeVersion?.abi || '';
  const is32Bit = abi.includes('armeabi') || abi.includes('x86') && !abi.includes('64');
  
  // Determine if we should use native WebView
  const useNativeWebView = !isLegacyAndroid && !is32Bit;
  
  return {
    androidVersion,
    isLegacyAndroid,
    is32Bit,
    useNativeWebView
  };
};

export const StreamWebView = ({
  url,
  onStreamDetected,
  forceJsWebView = false,
}: StreamWebViewProps) => {
  const capabilities = getDeviceCapabilities();
  
  // Determine which WebView to use
  const useNativeWebView = 
    Platform.OS === 'android' && 
    !forceJsWebView && 
    isNativeComponentAvailable &&
    capabilities.useNativeWebView;

  console.log('[StreamWebView] Device capabilities:', capabilities);
  console.log('[StreamWebView] Using native WebView:', useNativeWebView);

  if (useNativeWebView) {
    return (
      <NativeStreamWebView
        url={url}
        onStreamDetected={onStreamDetected}
      />
    );
  }

  // Fallback to JS-based WebView
  return (
    <JSStreamWebView
      url={url}
      onStreamDetected={onStreamDetected}
    />
  );
};
```

### Solution 2: Enhanced Native WebView Configuration (High Priority)

**File:** `plugins/withStreamInterceptor.js`

Update the Kotlin `StreamInterceptorWebView` with better compatibility settings:

```kotlin
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
        
        // === NEW: Compatibility settings for older devices ===
        
        // Enable database storage (needed by some players)
        databaseEnabled = true
        
        // Set rendering priority
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.KITKAT) {
            @Suppress("DEPRECATION")
            setRenderPriority(WebSettings.RenderPriority.HIGH)
        }
        
        // Disable geolocation (not needed, saves resources)
        setGeolocationEnabled(false)
        
        // Allow zoom for debugging (disabled in production)
        setSupportZoom(false)
        builtInZoomControls = false
        displayZoomControls = false
    }

    // === NEW: Configure layer type based on device ===
    configureLayerType()

    // Cache the user agent for thread-safe access
    cachedUserAgent = settings.userAgentString

    webViewClient = StreamInterceptorWebViewClient()
    webChromeClient = StreamInterceptorChromeClient()
}

/**
 * Configure layer type for optimal rendering
 * Software rendering is more compatible but slower
 * Hardware rendering is faster but can fail on some devices
 */
private fun configureLayerType() {
    // Use software rendering for:
    // - Android 7.0-7.1 (API 24-25) - known WebView issues
    // - Devices with known GPU problems
    val useSoftwareRendering = Build.VERSION.SDK_INT in 24..25
    
    if (useSoftwareRendering) {
        Log.d(TAG, "Using software rendering for compatibility")
        setLayerType(View.LAYER_TYPE_SOFTWARE, null)
    } else {
        Log.d(TAG, "Using hardware rendering")
        setLayerType(View.LAYER_TYPE_HARDWARE, null)
    }
}
```

### Solution 3: Timeout and Automatic Retry (Medium Priority)

**File:** `app/stream.tsx`

Add timeout detection and automatic fallback when WebView fails to detect streams:

```typescript
const WEBVIEW_TIMEOUT_MS = 15000; // 15 seconds
const MAX_RETRY_ATTEMPTS = 2;

export default function StreamScreen() {
  // ... existing state ...
  
  const [webViewAttempts, setWebViewAttempts] = useState(0);
  const [forceJsWebView, setForceJsWebView] = useState(false);
  const webViewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Timeout handler for WebView loading
  useEffect(() => {
    if (!webViewVisible || streamData) {
      // Clear timeout if WebView is hidden or stream detected
      if (webViewTimeoutRef.current) {
        clearTimeout(webViewTimeoutRef.current);
        webViewTimeoutRef.current = null;
      }
      return;
    }

    // Set timeout for stream detection
    webViewTimeoutRef.current = setTimeout(() => {
      console.log(`[StreamScreen] WebView timeout (attempt ${webViewAttempts + 1})`);
      
      if (webViewAttempts < MAX_RETRY_ATTEMPTS) {
        // Try next URL source
        if (currentChannel.url && currentUrlIndex < currentChannel.url.length - 1) {
          console.log('[StreamScreen] Trying next URL source');
          setCurrentUrlIndex(prev => prev + 1);
        } else {
          // Force JS WebView fallback
          console.log('[StreamScreen] Forcing JS WebView fallback');
          setForceJsWebView(true);
          setCurrentUrlIndex(0);
        }
        setWebViewAttempts(prev => prev + 1);
      } else {
        console.log('[StreamScreen] Max attempts reached, giving up');
        // Show error to user
      }
    }, WEBVIEW_TIMEOUT_MS);

    return () => {
      if (webViewTimeoutRef.current) {
        clearTimeout(webViewTimeoutRef.current);
      }
    };
  }, [webViewVisible, streamData, webViewAttempts, currentUrlIndex]);

  // Reset attempts when channel changes
  useEffect(() => {
    setWebViewAttempts(0);
    setForceJsWebView(false);
  }, [currentChannel.name]);

  // Pass forceJsWebView to StreamWebView
  return (
    // ...
    {webViewVisible && currentUrl ? (
      <StreamWebView
        key={`webview-${currentChannel.name}-${currentUrlIndex}-${forceJsWebView}`}
        url={currentUrl}
        onStreamDetected={handleStreamDetected}
        forceJsWebView={forceJsWebView}
      />
    ) : null}
    // ...
  );
}
```

### Solution 4: Add Native Module for Device Info (Medium Priority)

**File:** `plugins/withStreamInterceptor.js` (add to existing plugin)

Add a module to expose device architecture info to React Native:

```kotlin
// DeviceInfoModule.kt
package com.hellfiveosborn.H5TV

import android.os.Build
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = DeviceInfoModule.NAME)
class DeviceInfoModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "DeviceInfoModule"
    }

    override fun getName(): String = NAME

    /**
     * Get device ABI (architecture)
     */
    @ReactMethod
    fun getDeviceAbi(promise: Promise) {
        val abi = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            Build.SUPPORTED_ABIS.firstOrNull() ?: "unknown"
        } else {
            @Suppress("DEPRECATION")
            Build.CPU_ABI
        }
        promise.resolve(abi)
    }

    /**
     * Check if device is 32-bit
     */
    @ReactMethod
    fun is32BitDevice(promise: Promise) {
        val abi = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            Build.SUPPORTED_ABIS.firstOrNull() ?: ""
        } else {
            @Suppress("DEPRECATION")
            Build.CPU_ABI
        }
        val is32Bit = abi.contains("armeabi") || (abi.contains("x86") && !abi.contains("64"))
        promise.resolve(is32Bit)
    }

    /**
     * Get comprehensive device info for debugging
     */
    @ReactMethod
    fun getDeviceInfo(promise: Promise) {
        val info = Arguments.createMap().apply {
            putInt("sdkVersion", Build.VERSION.SDK_INT)
            putString("release", Build.VERSION.RELEASE)
            putString("manufacturer", Build.MANUFACTURER)
            putString("model", Build.MODEL)
            putString("device", Build.DEVICE)
            putString("hardware", Build.HARDWARE)
            
            // ABI info
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                putArray("supportedAbis", Arguments.fromArray(Build.SUPPORTED_ABIS))
            } else {
                @Suppress("DEPRECATION")
                putArray("supportedAbis", Arguments.fromArray(arrayOf(Build.CPU_ABI, Build.CPU_ABI2)))
            }
            
            // Memory info
            val runtime = Runtime.getRuntime()
            putDouble("maxMemoryMB", runtime.maxMemory() / (1024.0 * 1024.0))
            putDouble("totalMemoryMB", runtime.totalMemory() / (1024.0 * 1024.0))
            putDouble("freeMemoryMB", runtime.freeMemory() / (1024.0 * 1024.0))
        }
        promise.resolve(info)
    }

    /**
     * Check WebView version (requires API 26+)
     */
    @ReactMethod
    fun getWebViewVersion(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val webViewPackage = android.webkit.WebView.getCurrentWebViewPackage()
                val version = webViewPackage?.versionName ?: "unknown"
                promise.resolve(version)
            } else {
                promise.resolve("unknown (API < 26)")
            }
        } catch (e: Exception) {
            promise.resolve("error: ${e.message}")
        }
    }
}
```

### Solution 5: Enhanced Error Handling in Native WebView (Medium Priority)

**File:** `plugins/withStreamInterceptor.js`

Add better error handling and reporting in the WebViewClient:

```kotlin
private inner class StreamInterceptorWebViewClient : WebViewClient() {

    override fun onReceivedError(
        view: WebView,
        request: WebResourceRequest,
        error: WebResourceError
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val errorCode = error.errorCode
            val description = error.description.toString()
            
            Log.e(TAG, "WebView error: $errorCode - $description for ${request.url}")
            
            // Emit error event to React Native
            emitErrorEvent(request.url.toString(), "error_$errorCode: $description")
        }
        super.onReceivedError(view, request, error)
    }

    override fun onReceivedHttpError(
        view: WebView,
        request: WebResourceRequest,
        errorResponse: WebResourceResponse
    ) {
        val statusCode = errorResponse.statusCode
        Log.e(TAG, "HTTP error: $statusCode for ${request.url}")
        
        // Don't emit for ads (expected to fail)
        if (!isAdDomain(request.url.toString())) {
            emitErrorEvent(request.url.toString(), "http_$statusCode")
        }
        super.onReceivedHttpError(view, request, errorResponse)
    }

    override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail?): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val crashed = detail?.didCrash() ?: false
            Log.e(TAG, "Render process gone! Crashed: $crashed")
            
            emitErrorEvent("", "render_process_gone")
            
            // Return true to handle the crash (don't let the app crash)
            return true
        }
        return super.onRenderProcessGone(view, detail)
    }

    private fun emitErrorEvent(url: String, error: String) {
        (context as? ReactContext)?.let { reactContext ->
            val event = Arguments.createMap().apply {
                putString("url", url)
                putString("description", error)
            }
            reactContext.getJSModule(RCTEventEmitter::class.java)
                ?.receiveEvent(id, "onError", event)
        }
    }
}
```

### Solution 6: Add Diagnostic Logging (Low Priority)

**File:** `src/components/player/StreamWebView.tsx`

Add comprehensive logging for debugging:

```typescript
import { NativeModules } from 'react-native';

const logDeviceInfo = async () => {
  if (Platform.OS !== 'android') return;
  
  try {
    const DeviceInfo = NativeModules.DeviceInfoModule;
    if (DeviceInfo) {
      const info = await DeviceInfo.getDeviceInfo();
      const webViewVersion = await DeviceInfo.getWebViewVersion();
      
      console.log('[StreamWebView] Device Info:', {
        sdk: info.sdkVersion,
        release: info.release,
        model: info.model,
        abis: info.supportedAbis,
        webView: webViewVersion,
        memory: {
          max: `${info.maxMemoryMB.toFixed(0)}MB`,
          used: `${(info.totalMemoryMB - info.freeMemoryMB).toFixed(0)}MB`,
        }
      });
    }
  } catch (e) {
    console.log('[StreamWebView] Could not get device info:', e);
  }
};

// Call on component mount
useEffect(() => {
  logDeviceInfo();
}, []);
```

---

## 📊 Implementation Priority

| Solution | Priority | Effort | Impact |
|----------|----------|--------|--------|
| 1. Device Detection & Fallback | High | Medium | High |
| 2. Enhanced WebView Config | High | Low | Medium |
| 3. Timeout & Auto Retry | Medium | Medium | High |
| 4. Device Info Module | Medium | Medium | Medium |
| 5. Enhanced Error Handling | Medium | Low | Medium |
| 6. Diagnostic Logging | Low | Low | Low |

---

## 🧪 Testing Plan

### Test Matrix

| Device Type | Android Version | Architecture | Expected Behavior |
|-------------|-----------------|--------------|-------------------|
| Modern Phone | 11+ | arm64-v8a | Native WebView |
| Modern TV Box | 9+ | arm64-v8a | Native WebView |
| Budget TV Box | 7-8 | armeabi-v7a | JS WebView (fallback) |
| Old Phone | 7-8 | armeabi-v7a | JS WebView (fallback) |
| Emulator | Any | x86_64 | Native WebView |

### Test Cases

1. **Basic Stream Detection**
   - Load channel with known working stream
   - Verify stream URL detected within 10 seconds
   - Verify native player receives correct URL and headers

2. **Fallback Mechanism**
   - Force native WebView failure (disconnect network during load)
   - Verify automatic retry with next URL source
   - Verify fallback to JS WebView after max retries

3. **Memory Usage**
   - Monitor memory during channel load
   - Verify no memory leaks on repeated channel switches
   - Test on device with 1GB RAM

4. **Error Recovery**
   - Test with invalid channel URL
   - Verify error is displayed to user
   - Verify app doesn't crash

---

## 📝 Files to Modify

1. **`src/components/player/StreamWebView.tsx`**
   - Add device detection logic
   - Add fallback trigger from timeout
   - Add diagnostic logging

2. **`plugins/withStreamInterceptor.js`**
   - Update Kotlin WebView settings
   - Add error handling
   - Add DeviceInfoModule
   - Add layer type configuration

3. **`app/stream.tsx`**
   - Add timeout mechanism
   - Add retry logic
   - Pass forceJsWebView prop

4. **`src/components/player/NativeStreamWebView.tsx`**
   - Add error event handling
   - Update props interface

---

## 🔗 References

- [Android WebView Best Practices](https://developer.android.com/develop/ui/views/layout/webapps/webview)
- [WebView Hardware Acceleration](https://developer.android.com/topic/performance/hardware-accel)
- [react-native-webview Troubleshooting](https://github.com/react-native-webview/react-native-webview/blob/master/docs/Debugging.md)
- [ExoPlayer Supported Devices](https://developer.android.com/media/media3/exoplayer/supported-devices)