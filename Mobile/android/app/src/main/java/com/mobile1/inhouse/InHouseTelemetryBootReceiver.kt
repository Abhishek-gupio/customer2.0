package com.mobile1.inhouse

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class InHouseTelemetryBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    when (intent?.action) {
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED -> {
        if (InHouseTelemetryPrefs.shouldEnableAutoMonitoring(context)) {
          InHouseTelemetryForegroundService.syncConfiguration(context)
        }
      }
    }
  }
}
