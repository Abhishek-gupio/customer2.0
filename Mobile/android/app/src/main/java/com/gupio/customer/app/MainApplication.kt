package com.gupio.customer.app

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.telematicssdk.tracking.Settings
import com.telematicssdk.tracking.TrackingApi

import com.BV.LinearGradient.LinearGradientPackage
import com.wenkesj.voice.VoicePackage
import com.swmansion.rnscreens.RNScreensPackage
import com.brentvatne.react.ReactVideoPackage
import com.horcrux.svg.SvgPackage
import cl.json.RNSharePackage
import com.gupio.customer.app.damoov.DamoovTelematicsPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
            add(LinearGradientPackage())
            add(VoicePackage())
            add(RNScreensPackage())
            add(ReactVideoPackage())
            add(SvgPackage())
            add(RNSharePackage())
            add(DamoovTelematicsPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Damoov Telematics SDK: init before any tracking (stopTrackingTimeHigh, accuracyHigh, autoStart, hfOn, isElmOn, isAdOn)
    try {
      val settings = Settings(Settings.stopTrackingTimeHigh, Settings.accuracyHigh, true, true, false, false)
      TrackingApi.getInstance().initialize(this, settings)
    } catch (e: Exception) {
      android.util.Log.e("MainApplication", "Damoov SDK init failed", e)
    }
    loadReactNative(this)
  }
}
