package com.gupio.customer.app

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

import com.BV.LinearGradient.LinearGradientPackage
import com.wenkesj.voice.VoicePackage
import com.swmansion.rnscreens.RNScreensPackage
import com.brentvatne.react.ReactVideoPackage
import com.horcrux.svg.SvgPackage
import cl.json.RNSharePackage

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
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
