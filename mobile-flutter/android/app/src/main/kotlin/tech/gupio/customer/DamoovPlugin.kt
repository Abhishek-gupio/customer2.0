package tech.gupio.customer

import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Registers the Damoov MethodChannel and delegates calls to the native Damoov SDK.
 * Call DamoovPlugin.register(flutterEngine) from MainActivity.configureFlutterEngine().
 *
 * The Damoov SDK dependency must be added to android/app/build.gradle:
 *   implementation 'com.damoov:sdk:3.x.x'
 */
object DamoovPlugin {
    private const val CHANNEL = "tech.gupio.customer/damoov"

    fun register(flutterEngine: FlutterEngine) {
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "setDeviceId" -> {
                        val deviceId = call.argument<String>("deviceId") ?: ""
                        // TODO: DamoovCore.setDeviceToken(deviceId)
                        result.success(true)
                    }
                    "setEnabled" -> {
                        val enabled = call.argument<Boolean>("enabled") ?: false
                        // TODO: DamoovCore.setEnabled(enabled)
                        result.success(true)
                    }
                    "logout" -> {
                        // TODO: DamoovCore.logout()
                        result.success(null)
                    }
                    "getLatestTrip" -> {
                        // TODO: return DamoovCore.getLatestTrip() as Map
                        result.success(null)
                    }
                    "startTrip" -> {
                        // TODO: DamoovCore.startTrip()
                        result.success(true)
                    }
                    "stopTrip" -> {
                        // TODO: DamoovCore.stopTrip()
                        result.success(true)
                    }
                    else -> result.notImplemented()
                }
            }
    }
}
