package com.mobile1.inhouse

import android.content.Context
import android.location.LocationManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class InHouseTelemetryModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "InHouseTelemetry"

  @ReactMethod
  fun isAvailable(promise: Promise) {
    promise.resolve(true)
  }

  @ReactMethod
  fun isLocationEnabled(promise: Promise) {
    try {
      val manager = reactContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
      val gpsEnabled =
        try {
          manager?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true
        } catch (_: Exception) {
          false
        }
      val networkEnabled =
        try {
          manager?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true
        } catch (_: Exception) {
          false
        }
      promise.resolve(gpsEnabled || networkEnabled)
    } catch (e: Exception) {
      promise.reject("INHOUSE_LOCATION_ENABLED", e.message, e)
    }
  }

  @ReactMethod
  fun clearRecordedPoints(promise: Promise) {
    try {
      InHouseTelemetryPointStore.clear()
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("INHOUSE_CLEAR_POINTS", e.message, e)
    }
  }

  @ReactMethod
  fun getRecordedPoints(promise: Promise) {
    try {
      promise.resolve(pointsToWritableArray(InHouseTelemetryPointStore.snapshot()))
    } catch (e: Exception) {
      promise.reject("INHOUSE_GET_POINTS", e.message, e)
    }
  }

  @ReactMethod
  fun syncConfiguration(config: ReadableMap, promise: Promise) {
    try {
      val provider =
        if (config.hasKey("provider") && !config.isNull("provider")) {
          config.getString("provider") ?: "damoov"
        } else {
          "damoov"
        }
      val autoModeEnabled =
        config.hasKey("autoModeEnabled") && !config.isNull("autoModeEnabled") &&
          config.getBoolean("autoModeEnabled")
      val linked =
        config.hasKey("linked") && !config.isNull("linked") && config.getBoolean("linked")
      val vehicleId =
        if (config.hasKey("vehicleId") && !config.isNull("vehicleId")) {
          config.getString("vehicleId")
        } else {
          null
        }
      val vehicleType =
        if (config.hasKey("vehicleType") && !config.isNull("vehicleType")) {
          config.getString("vehicleType")
        } else {
          null
        }

      InHouseTelemetryPrefs.saveConfig(
        context = reactContext,
        provider = provider,
        autoModeEnabled = autoModeEnabled,
        linked = linked,
        vehicleId = vehicleId,
        vehicleType = vehicleType,
      )
      InHouseTelemetryForegroundService.syncConfiguration(reactContext)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("INHOUSE_SYNC_CONFIG", e.message, e)
    }
  }

  @ReactMethod
  fun getServiceStatus(promise: Promise) {
    try {
      val status = InHouseTelemetryForegroundService.getCurrentStatus()
      promise.resolve(
        Arguments.createMap().apply {
          putString("mode", status.mode.name.lowercase())
          if (status.startedAtMs != null) {
            putDouble("startedAtMs", status.startedAtMs.toDouble())
          } else {
            putNull("startedAtMs")
          }
          putInt("pointsCaptured", status.pointsCaptured)
          putBoolean("hasPendingCompletedTrip", status.hasPendingCompletedTrip)
          if (status.pendingCompletedTripVehicleId != null) {
            putString("vehicleId", status.pendingCompletedTripVehicleId)
          } else {
            putNull("vehicleId")
          }
          if (status.pendingCompletedTripVehicleType != null) {
            putString("vehicleType", status.pendingCompletedTripVehicleType)
          } else {
            putNull("vehicleType")
          }
        },
      )
    } catch (e: Exception) {
      promise.reject("INHOUSE_GET_STATUS", e.message, e)
    }
  }

  @ReactMethod
  fun consumeCompletedTrip(promise: Promise) {
    try {
      promise.resolve(completedTripToWritableMap(InHouseTelemetryPointStore.consumeCompletedTrip()))
    } catch (e: Exception) {
      promise.reject("INHOUSE_CONSUME_COMPLETED", e.message, e)
    }
  }

  @ReactMethod
  fun startForegroundTracking(promise: Promise) {
    try {
      InHouseTelemetryForegroundService.startManualTrip(reactContext)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("INHOUSE_START_SERVICE", e.message, e)
    }
  }

  @ReactMethod
  fun stopForegroundTracking(promise: Promise) {
    try {
      promise.resolve(
        completedTripToWritableMap(
          InHouseTelemetryForegroundService.stopCurrentTripAndConsume(reactContext),
        ),
      )
    } catch (e: Exception) {
      promise.reject("INHOUSE_STOP_SERVICE", e.message, e)
    }
  }

  private fun completedTripToWritableMap(trip: InHouseTelemetryCompletedTrip?) =
    if (trip == null) {
      null
    } else {
      Arguments.createMap().apply {
        if (trip.vehicleId != null) {
          putString("vehicleId", trip.vehicleId)
        } else {
          putNull("vehicleId")
        }
        if (trip.vehicleType != null) {
          putString("vehicleType", trip.vehicleType)
        } else {
          putNull("vehicleType")
        }
        if (trip.startedAtMs != null) {
          putDouble("startedAtMs", trip.startedAtMs.toDouble())
        } else {
          putNull("startedAtMs")
        }
        putDouble("endedAtMs", trip.endedAtMs.toDouble())
        putArray("points", pointsToWritableArray(trip.points))
      }
    }

  private fun pointsToWritableArray(points: List<InHouseTelemetryPoint>) =
    Arguments.createArray().apply {
      points.forEach { point ->
        pushMap(
          Arguments.createMap().apply {
            putDouble("latitude", point.latitude)
            putDouble("longitude", point.longitude)
            putDouble("timestampMs", point.timestampMs.toDouble())
            if (point.speedKmh != null) {
              putDouble("speedKmh", point.speedKmh)
            } else {
              putNull("speedKmh")
            }
            if (point.accuracy != null) {
              putDouble("accuracy", point.accuracy)
            } else {
              putNull("accuracy")
            }
          },
        )
      }
    }
}
