package com.gupio.customer.app.damoov

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.telematicssdk.tracking.TrackingApi

class DamoovTelematicsModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "DamoovTelematics"

  /**
   * Set the device token from backend (Damoov Registration). Call before setEnabled(true).
   */
  @ReactMethod
  fun setDeviceId(deviceToken: String, promise: Promise) {
    try {
      TrackingApi.getInstance().setDeviceID(deviceToken)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("DAMOOV_SET_DEVICE_ID", e.message, e)
    }
  }

  /**
   * Enable or disable the SDK. Requires permissions and setDeviceId to be called first.
   */
  @ReactMethod
  fun setEnabled(enabled: Boolean, promise: Promise) {
    try {
      TrackingApi.getInstance().setEnableSdk(enabled)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("DAMOOV_SET_ENABLED", e.message, e)
    }
  }

  /**
   * Log out from SDK (clear device ID and disable). Call when user logs out of the app.
   */
  @ReactMethod
  fun logout(promise: Promise) {
    try {
      TrackingApi.getInstance().logout()
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("DAMOOV_LOGOUT", e.message, e)
    }
  }

  /**
   * Returns true if all required permissions and sensors are granted (so SDK can be enabled).
   */
  @ReactMethod
  fun arePermissionsGranted(promise: Promise) {
    try {
      promise.resolve(TrackingApi.getInstance().isAllRequiredPermissionsAndSensorsGranted())
    } catch (e: Exception) {
      promise.reject("DAMOOV_PERMISSIONS_CHECK", e.message, e)
    }
  }
}
