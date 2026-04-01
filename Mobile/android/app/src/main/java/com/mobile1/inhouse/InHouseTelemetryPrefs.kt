package com.mobile1.inhouse

import android.content.Context

data class InHouseTelemetryConfig(
  val provider: String,
  val autoModeEnabled: Boolean,
  val linked: Boolean,
  val vehicleId: String?,
  val vehicleType: String?,
)

object InHouseTelemetryPrefs {
  private const val PREFS_NAME = "inhouse_telematics_prefs"
  private const val KEY_PROVIDER = "provider"
  private const val KEY_AUTO_MODE_ENABLED = "auto_mode_enabled"
  private const val KEY_LINKED = "linked"
  private const val KEY_VEHICLE_ID = "vehicle_id"
  private const val KEY_VEHICLE_TYPE = "vehicle_type"

  fun getConfig(context: Context): InHouseTelemetryConfig {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return InHouseTelemetryConfig(
      provider = prefs.getString(KEY_PROVIDER, "damoov") ?: "damoov",
      autoModeEnabled = prefs.getBoolean(KEY_AUTO_MODE_ENABLED, true),
      linked = prefs.getBoolean(KEY_LINKED, false),
      vehicleId = prefs.getString(KEY_VEHICLE_ID, null),
      vehicleType = prefs.getString(KEY_VEHICLE_TYPE, null),
    )
  }

  fun saveConfig(
    context: Context,
    provider: String,
    autoModeEnabled: Boolean,
    linked: Boolean,
    vehicleId: String?,
    vehicleType: String?,
  ) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_PROVIDER, provider)
      .putBoolean(KEY_AUTO_MODE_ENABLED, autoModeEnabled)
      .putBoolean(KEY_LINKED, linked)
      .putString(KEY_VEHICLE_ID, vehicleId)
      .putString(KEY_VEHICLE_TYPE, vehicleType)
      .apply()
  }

  fun shouldEnableAutoMonitoring(context: Context): Boolean {
    val config = getConfig(context)
    return config.provider == "inhouse" &&
      config.autoModeEnabled &&
      config.linked &&
      !config.vehicleId.isNullOrBlank()
  }
}
