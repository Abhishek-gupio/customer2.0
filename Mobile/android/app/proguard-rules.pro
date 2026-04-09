# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Damoov Telematics SDK
-keep public class com.telematicssdk.tracking.** {*;}

# React Native
-keep class com.facebook.react.bridge.CatalystInstanceImpl { *; }
-keep class com.facebook.react.bridge.WritableNativeArray { *; }
-keep class com.facebook.react.bridge.WritableNativeMap { *; }

# Firebase
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# OneSignal
-keep class com.onesignal.** { *; }
-dontwarn com.onesignal.**

# Sentry
-keep class io.sentry.** { *; }
-dontwarn io.sentry.**

# OkHttp/Okio
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# Animated GIF (Fresco)
-keep class com.facebook.imagepipeline.animated.factory.AnimatedFactoryImpl {
  public <init>(com.facebook.imagepipeline.bitmaps.PlatformBitmapFactory, com.facebook.imagepipeline.core.ExecutorSupplier, com.facebook.imagepipeline.cache.CountingMemoryCache, boolean);
}

# Vector Icons
-keep class com.oblador.vectoricons.** { *; }

# WebView
-keep class com.reactnativecommunity.webview.** { *; }

# FastImage (Glide)
-keep class com.dylanvann.fastimage.** { *; }
-dontwarn com.dylanvann.fastimage.**

# MMKV
-keep class com.tencent.mmkv.** { *; }

# Maps
-keep class com.google.android.gms.maps.** { *; }
-keep interface com.google.android.gms.maps.** { *; }
# Please add these rules to your existing keep rules in order to suppress warnings.
# This is generated automatically by the Android Gradle plugin.
-dontwarn com.gemalto.jp2.JP2Decoder
-dontwarn com.google.auto.value.AutoValue$CopyAnnotations
-dontwarn io.netty.channel.epoll.Epoll
-dontwarn io.netty.channel.epoll.EpollEventLoopGroup
-dontwarn io.netty.channel.epoll.EpollSocketChannel
-dontwarn io.netty.handler.codec.http.FullHttpResponse
-dontwarn io.netty.handler.codec.http.HttpClientCodec
-dontwarn io.netty.handler.codec.http.HttpHeaders
-dontwarn io.netty.handler.codec.http.HttpObjectAggregator
-dontwarn io.netty.handler.codec.http.HttpRequest
-dontwarn io.netty.handler.codec.http.websocketx.BinaryWebSocketFrame
-dontwarn io.netty.handler.codec.http.websocketx.CloseWebSocketFrame
-dontwarn io.netty.handler.codec.http.websocketx.ContinuationWebSocketFrame
-dontwarn io.netty.handler.codec.http.websocketx.PingWebSocketFrame
-dontwarn io.netty.handler.codec.http.websocketx.PongWebSocketFrame
-dontwarn io.netty.handler.codec.http.websocketx.TextWebSocketFrame
-dontwarn io.netty.handler.codec.http.websocketx.WebSocketClientHandshaker
-dontwarn io.netty.handler.codec.http.websocketx.WebSocketClientHandshakerFactory
-dontwarn io.netty.handler.codec.http.websocketx.WebSocketFrame
-dontwarn io.netty.handler.codec.http.websocketx.WebSocketHandshakeException
-dontwarn io.netty.handler.codec.http.websocketx.WebSocketVersion
-dontwarn io.netty.handler.proxy.HttpProxyHandler
-dontwarn io.netty.handler.proxy.ProxyHandler
-dontwarn io.netty.handler.proxy.Socks4ProxyHandler
-dontwarn io.netty.handler.proxy.Socks5ProxyHandler
-dontwarn io.netty.internal.tcnative.AsyncSSLPrivateKeyMethod
-dontwarn io.netty.internal.tcnative.AsyncTask
-dontwarn io.netty.internal.tcnative.Buffer
-dontwarn io.netty.internal.tcnative.CertificateCallback
-dontwarn io.netty.internal.tcnative.CertificateCompressionAlgo
-dontwarn io.netty.internal.tcnative.CertificateVerifier
-dontwarn io.netty.internal.tcnative.Library
-dontwarn io.netty.internal.tcnative.SSL
-dontwarn io.netty.internal.tcnative.SSLContext
-dontwarn io.netty.internal.tcnative.SSLPrivateKeyMethod
-dontwarn io.netty.internal.tcnative.SSLSessionCache
-dontwarn io.netty.internal.tcnative.SessionTicketKey
-dontwarn io.netty.internal.tcnative.SniHostNameMatcher
-dontwarn org.eclipse.jetty.alpn.ALPN$ClientProvider
-dontwarn org.eclipse.jetty.alpn.ALPN$Provider
-dontwarn org.eclipse.jetty.alpn.ALPN$ServerProvider
-dontwarn org.eclipse.jetty.alpn.ALPN
-dontwarn org.eclipse.jetty.npn.NextProtoNego$ClientProvider
-dontwarn org.eclipse.jetty.npn.NextProtoNego$Provider
-dontwarn org.eclipse.jetty.npn.NextProtoNego$ServerProvider
-dontwarn org.eclipse.jetty.npn.NextProtoNego
-dontwarn org.slf4j.ILoggerFactory
-dontwarn org.slf4j.Logger
-dontwarn org.slf4j.LoggerFactory
-dontwarn org.slf4j.Marker
-dontwarn org.slf4j.helpers.FormattingTuple
-dontwarn org.slf4j.helpers.MessageFormatter
-dontwarn org.slf4j.helpers.NOPLoggerFactory
-dontwarn org.slf4j.spi.LocationAwareLogger
-dontwarn reactor.blockhound.integration.BlockHoundIntegration
-ignorewarnings
