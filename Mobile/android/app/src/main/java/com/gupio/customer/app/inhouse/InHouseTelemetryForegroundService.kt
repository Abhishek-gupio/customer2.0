package com.gupio.customer.app.inhouse

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import com.gupio.customer.app.R
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.math.max

enum class InHouseTelemetryServiceMode {
  IDLE,
  MONITORING,
  TRACKING,
}

data class InHouseTelemetryServiceStatus(
  val mode: InHouseTelemetryServiceMode,
  val startedAtMs: Long?,
  val pointsCaptured: Int,
  val hasPendingCompletedTrip: Boolean,
  val pendingCompletedTripVehicleId: String?,
  val pendingCompletedTripVehicleType: String?,
)

class InHouseTelemetryForegroundService : Service(), LocationListener {
  companion object {
    const val ACTION_SYNC_CONFIG = "com.gupio.customer.app.inhouse.action.SYNC_CONFIG"
    const val ACTION_START = "com.gupio.customer.app.inhouse.action.START"
    const val ACTION_STOP = "com.gupio.customer.app.inhouse.action.STOP"
    const val ACTION_STOP_ALL = "com.gupio.customer.app.inhouse.action.STOP_ALL"

    private const val CHANNEL_ID = "inhouse_telematics_tracking"
    private const val CHANNEL_NAME = "In-house Telematics"
    private const val NOTIFICATION_ID = 45112
    private const val TAG = "InHouseTelemetryService"

    private const val AUTO_START_SPEED_THRESHOLD_KMH = 10.0
    private const val AUTO_START_DERIVED_SPEED_THRESHOLD_KMH = 9.0
    private const val AUTO_TRACKING_MOVING_SPEED_THRESHOLD_KMH = 7.0
    private const val AUTO_TRACKING_DERIVED_SPEED_THRESHOLD_KMH = 6.5
    private const val AUTO_START_MIN_DISTANCE_METERS = 45.0
    private const val AUTO_START_MIN_CUMULATIVE_DISTANCE_METERS = 75.0
    private const val AUTO_TRACKING_MIN_DISTANCE_METERS = 16.0
    private const val AUTO_MONITOR_MAX_ACCURACY_METERS = 55.0
    private const val AUTO_TRACKING_MAX_ACCURACY_METERS = 85.0
    private const val AUTO_IDLE_STOP_MS = 5 * 60 * 1000L
    private const val AUTO_MIN_ACTIVE_BEFORE_STOP_MS = 5 * 60 * 1000L
    private const val AUTO_START_PROBE_HITS_REQUIRED = 2
    private const val AUTO_START_PROBE_WINDOW_MS = 100 * 1000L
    private const val AUTO_IDLE_CONFIRMATION_HITS_REQUIRED = 2

    @Volatile
    private var serviceInstance: InHouseTelemetryForegroundService? = null

    private fun startServiceWithAction(context: Context, action: String) {
      val intent = Intent(context, InHouseTelemetryForegroundService::class.java).apply {
        this.action = action
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun syncConfiguration(context: Context) {
      if (InHouseTelemetryPrefs.shouldEnableAutoMonitoring(context)) {
        startServiceWithAction(context, ACTION_SYNC_CONFIG)
      } else {
        stopAll(context)
      }
    }

    fun startManualTrip(context: Context) {
      startServiceWithAction(context, ACTION_START)
    }

    fun stopCurrentTripAndConsume(context: Context): InHouseTelemetryCompletedTrip? {
      val service = serviceInstance
      if (service == null) {
        InHouseTelemetryPointStore.completeTrip()
        return InHouseTelemetryPointStore.consumeCompletedTrip()
      }

      var result: InHouseTelemetryCompletedTrip? = null
      val latch = CountDownLatch(1)
      val handler = Handler(Looper.getMainLooper())
      handler.post {
        result = service.stopTripInternal()
        latch.countDown()
      }
      latch.await(2500, TimeUnit.MILLISECONDS)
      return result
    }

    fun stopAll(context: Context) {
      val service = serviceInstance
      if (service != null) {
        val handler = Handler(Looper.getMainLooper())
        handler.post {
          service.stopAllInternal()
        }
        return
      }
      context.stopService(Intent(context, InHouseTelemetryForegroundService::class.java))
      InHouseTelemetryPointStore.clear()
    }

    fun getCurrentStatus(): InHouseTelemetryServiceStatus {
      val service = serviceInstance
      val pendingTrip = InHouseTelemetryPointStore.peekCompletedTrip()
      return InHouseTelemetryServiceStatus(
        mode = service?.serviceMode ?: InHouseTelemetryServiceMode.IDLE,
        startedAtMs = InHouseTelemetryPointStore.getActiveStartedAtMs(),
        pointsCaptured = InHouseTelemetryPointStore.getActivePointCount(),
        hasPendingCompletedTrip = pendingTrip != null,
        pendingCompletedTripVehicleId = pendingTrip?.vehicleId,
        pendingCompletedTripVehicleType = pendingTrip?.vehicleType,
      )
    }
  }

  private var locationManager: LocationManager? = null
  private var serviceMode: InHouseTelemetryServiceMode = InHouseTelemetryServiceMode.IDLE
  private var lastProbeLocation: Location? = null
  private var autoMovementProbeHits: Int = 0
  private var lastMovementProbeAtMs: Long? = null
  private var monitorMovementDistanceMeters: Double = 0.0
  private var lastTrackingLocation: Location? = null
  private var lastMovingAtMs: Long? = null
  private var idleConfirmationHits: Int = 0

  override fun onCreate() {
    super.onCreate()
    serviceInstance = this
    serviceMode =
      if (InHouseTelemetryPrefs.shouldEnableAutoMonitoring(this)) {
        InHouseTelemetryServiceMode.MONITORING
      } else {
        InHouseTelemetryServiceMode.IDLE
      }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP_ALL -> {
        stopAllInternal()
        return START_NOT_STICKY
      }
      ACTION_START -> {
        startTripInternal(manualStart = true)
      }
      ACTION_STOP -> {
        completeTripForAutoUpload()
      }
      else -> {
        applyConfiguration()
      }
    }
    return START_STICKY
  }

  override fun onDestroy() {
    stopTracking()
    serviceInstance = null
    super.onDestroy()
  }

  private fun applyConfiguration() {
    if (InHouseTelemetryPrefs.shouldEnableAutoMonitoring(this)) {
      if (serviceMode != InHouseTelemetryServiceMode.TRACKING) {
        serviceMode = InHouseTelemetryServiceMode.MONITORING
      }
      createNotificationChannel()
      startForeground(NOTIFICATION_ID, buildNotification())
      requestLocationUpdatesForMode()
      seedLastKnownLocation()
    } else if (serviceMode != InHouseTelemetryServiceMode.TRACKING) {
      stopAllInternal()
    }
  }

  @SuppressLint("MissingPermission")
  private fun requestLocationUpdatesForMode() {
    val manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
    locationManager = manager

    try {
      manager.removeUpdates(this)
    } catch (_: Exception) {
    }

    val gpsIntervalMs = if (serviceMode == InHouseTelemetryServiceMode.TRACKING) 4_000L else 12_000L
    val gpsDistanceM = if (serviceMode == InHouseTelemetryServiceMode.TRACKING) 4f else 18f
    val networkIntervalMs = if (serviceMode == InHouseTelemetryServiceMode.TRACKING) 6_000L else 18_000L
    val networkDistanceM = if (serviceMode == InHouseTelemetryServiceMode.TRACKING) 6f else 28f

    try {
      if (manager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
        manager.requestLocationUpdates(
          LocationManager.GPS_PROVIDER,
          gpsIntervalMs,
          gpsDistanceM,
          this,
        )
      }
    } catch (e: Exception) {
      Log.e(TAG, "GPS provider update registration failed", e)
    }

    try {
      if (manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
        manager.requestLocationUpdates(
          LocationManager.NETWORK_PROVIDER,
          networkIntervalMs,
          networkDistanceM,
          this,
        )
      }
    } catch (e: Exception) {
      Log.e(TAG, "Network provider update registration failed", e)
    }
  }

  private fun seedLastKnownLocation() {
    val manager = locationManager ?: return
    try {
      val gpsLast = manager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
      if (gpsLast != null) {
        if (serviceMode == InHouseTelemetryServiceMode.TRACKING) {
          InHouseTelemetryPointStore.add(gpsLast)
        } else {
          lastProbeLocation = gpsLast
        }
      }
      val netLast = manager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
      if (netLast != null) {
        if (serviceMode == InHouseTelemetryServiceMode.TRACKING) {
          InHouseTelemetryPointStore.add(netLast)
        } else if (lastProbeLocation == null) {
          lastProbeLocation = netLast
        }
      }
    } catch (e: Exception) {
      Log.w(TAG, "Reading last known location failed", e)
    }
  }

  private fun resetMonitorSignals() {
    lastProbeLocation = null
    autoMovementProbeHits = 0
    lastMovementProbeAtMs = null
    monitorMovementDistanceMeters = 0.0
  }

  private fun resetTrackingSignals() {
    lastTrackingLocation = null
    lastMovingAtMs = null
    idleConfirmationHits = 0
  }

  private fun maybeTransitionToMonitoringAfterTrip() {
    if (InHouseTelemetryPrefs.shouldEnableAutoMonitoring(this)) {
      serviceMode = InHouseTelemetryServiceMode.MONITORING
      resetTrackingSignals()
      resetMonitorSignals()
      startForeground(NOTIFICATION_ID, buildNotification())
      requestLocationUpdatesForMode()
      seedLastKnownLocation()
    } else {
      stopAllInternal()
    }
  }

  private fun startTripInternal(
    manualStart: Boolean,
    seedLocation: Location? = null,
  ) {
    val config = InHouseTelemetryPrefs.getConfig(this)
    val startedAtMs = seedLocation?.time?.takeIf { it > 0 } ?: System.currentTimeMillis()

    InHouseTelemetryPointStore.beginTrip(
      vehicleId = config.vehicleId,
      vehicleType = config.vehicleType,
      startedAtMs = startedAtMs,
    )

    serviceMode = InHouseTelemetryServiceMode.TRACKING
    resetMonitorSignals()
    resetTrackingSignals()
    lastMovingAtMs = startedAtMs
    lastTrackingLocation = seedLocation

    createNotificationChannel()
    startForeground(NOTIFICATION_ID, buildNotification())
    requestLocationUpdatesForMode()

    if (seedLocation != null) {
      InHouseTelemetryPointStore.add(seedLocation)
    } else {
      seedLastKnownLocation()
    }

    if (manualStart) {
      lastMovingAtMs = startedAtMs
    }
  }

  private fun stopTripInternal(): InHouseTelemetryCompletedTrip? {
    if (serviceMode != InHouseTelemetryServiceMode.TRACKING) {
      return InHouseTelemetryPointStore.consumeCompletedTrip()
    }

    stopTracking()
    InHouseTelemetryPointStore.completeTrip(System.currentTimeMillis())
    val result = InHouseTelemetryPointStore.consumeCompletedTrip()
    resetTrackingSignals()
    maybeTransitionToMonitoringAfterTrip()
    return result
  }

  private fun completeTripForAutoUpload() {
    if (serviceMode != InHouseTelemetryServiceMode.TRACKING) return

    stopTracking()
    InHouseTelemetryPointStore.completeTrip(System.currentTimeMillis())
    resetTrackingSignals()
    maybeTransitionToMonitoringAfterTrip()
  }

  private fun stopAllInternal() {
    stopTracking()
    serviceMode = InHouseTelemetryServiceMode.IDLE
    resetMonitorSignals()
    resetTrackingSignals()
    try {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } catch (_: Exception) {
    }
    stopSelf()
  }

  private fun stopTracking() {
    try {
      locationManager?.removeUpdates(this)
    } catch (_: Exception) {
    }
    locationManager = null
  }

  private fun buildNotification(): Notification {
    val title =
      if (serviceMode == InHouseTelemetryServiceMode.TRACKING) {
        "Trip recording active"
      } else {
        "Drive detection ready"
      }
    val text =
      if (serviceMode == InHouseTelemetryServiceMode.TRACKING) {
        "In-house telematics is tracking your drive"
      } else {
        "In-house telematics is monitoring for trip start"
      }

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(text)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val existing = manager.getNotificationChannel(CHANNEL_ID)
    if (existing != null) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      CHANNEL_NAME,
      NotificationManager.IMPORTANCE_LOW,
    )
    channel.description = "Shows in-house telemetry monitoring and trip recording"
    manager.createNotificationChannel(channel)
  }

  private fun detectMovementAndMaybeStart(location: Location) {
    if (!isReliableMonitorLocation(location)) {
      return
    }

    val speedKmh = if (location.hasSpeed()) location.speed * 3.6 else 0.0
    var movementDetected = speedKmh >= AUTO_START_SPEED_THRESHOLD_KMH
    var detectedMovementMeters = 0.0

    lastProbeLocation?.let { previous ->
      val elapsedMs = max(1L, locationTime(location) - locationTime(previous))
      val movedMeters = previous.distanceTo(location).toDouble()
      val approxSpeedKmh = (movedMeters / (elapsedMs / 1000.0)) * 3.6
      val jitterRadius = computeJitterRadius(previous, location)
      val qualifiedDistance = max(AUTO_START_MIN_DISTANCE_METERS, jitterRadius * 1.25)
      if (
        movedMeters >= qualifiedDistance &&
        approxSpeedKmh >= AUTO_START_DERIVED_SPEED_THRESHOLD_KMH
      ) {
        movementDetected = true
        detectedMovementMeters = movedMeters
      }
    }

    lastProbeLocation = location

    if (!movementDetected) {
      autoMovementProbeHits = 0
      lastMovementProbeAtMs = null
      monitorMovementDistanceMeters = 0.0
      return
    }

    val nowMs = locationTime(location)
    val withinProbeWindow =
      lastMovementProbeAtMs != null && nowMs - (lastMovementProbeAtMs ?: 0L) <= AUTO_START_PROBE_WINDOW_MS
    autoMovementProbeHits = if (withinProbeWindow) autoMovementProbeHits + 1 else 1
    monitorMovementDistanceMeters =
      if (withinProbeWindow) {
        monitorMovementDistanceMeters + max(detectedMovementMeters, if (speedKmh >= AUTO_START_SPEED_THRESHOLD_KMH) 20.0 else 0.0)
      } else {
        max(detectedMovementMeters, if (speedKmh >= AUTO_START_SPEED_THRESHOLD_KMH) 20.0 else 0.0)
      }
    lastMovementProbeAtMs = nowMs

    val strongMovement = speedKmh >= 18.0
    if (
      autoMovementProbeHits >= AUTO_START_PROBE_HITS_REQUIRED &&
      (strongMovement || monitorMovementDistanceMeters >= AUTO_START_MIN_CUMULATIVE_DISTANCE_METERS)
    ) {
      startTripInternal(manualStart = false, seedLocation = location)
    }
  }

  private fun updateTrackingState(location: Location) {
    val nowMs = locationTime(location)
    val speedKmh = if (location.hasSpeed()) location.speed * 3.6 else 0.0
    var moving = speedKmh >= AUTO_TRACKING_MOVING_SPEED_THRESHOLD_KMH

    lastTrackingLocation?.let { previous ->
      val elapsedMs = max(1L, nowMs - locationTime(previous))
      val movedMeters = previous.distanceTo(location).toDouble()
      val approxSpeedKmh = (movedMeters / (elapsedMs / 1000.0)) * 3.6
      val jitterRadius = computeJitterRadius(previous, location)
      if (
        movedMeters > max(AUTO_TRACKING_MIN_DISTANCE_METERS, jitterRadius * 1.1) &&
        approxSpeedKmh >= AUTO_TRACKING_DERIVED_SPEED_THRESHOLD_KMH
      ) {
        moving = true
      }
    }

    if (moving || !isReliableTrackingLocation(location)) {
      lastMovingAtMs = nowMs
      idleConfirmationHits = 0
    } else {
      idleConfirmationHits += 1
    }
    lastTrackingLocation = location

    val startedAtMs = InHouseTelemetryPointStore.getActiveStartedAtMs() ?: return
    if (nowMs - startedAtMs < AUTO_MIN_ACTIVE_BEFORE_STOP_MS) return

    val lastMoving = lastMovingAtMs ?: return
    if (
      nowMs - lastMoving >= AUTO_IDLE_STOP_MS &&
      idleConfirmationHits >= AUTO_IDLE_CONFIRMATION_HITS_REQUIRED
    ) {
      completeTripForAutoUpload()
    }
  }

  private fun isReliableMonitorLocation(location: Location): Boolean {
    val accuracy = if (location.hasAccuracy()) location.accuracy.toDouble() else 18.0
    val speedKmh = if (location.hasSpeed()) location.speed * 3.6 else 0.0
    return accuracy <= AUTO_MONITOR_MAX_ACCURACY_METERS || speedKmh >= AUTO_START_SPEED_THRESHOLD_KMH
  }

  private fun isReliableTrackingLocation(location: Location): Boolean {
    val accuracy = if (location.hasAccuracy()) location.accuracy.toDouble() else 18.0
    val speedKmh = if (location.hasSpeed()) location.speed * 3.6 else 0.0
    return accuracy <= AUTO_TRACKING_MAX_ACCURACY_METERS || speedKmh >= AUTO_TRACKING_MOVING_SPEED_THRESHOLD_KMH
  }

  private fun computeJitterRadius(previous: Location, current: Location): Double {
    val prevAccuracy = if (previous.hasAccuracy()) previous.accuracy.toDouble() else 18.0
    val nextAccuracy = if (current.hasAccuracy()) current.accuracy.toDouble() else 18.0
    return max(14.0, ((prevAccuracy + nextAccuracy) / 2.0) * 1.35)
  }

  private fun locationTime(location: Location): Long =
    if (location.time > 0) location.time else System.currentTimeMillis()

  override fun onLocationChanged(location: Location) {
    when (serviceMode) {
      InHouseTelemetryServiceMode.MONITORING -> detectMovementAndMaybeStart(location)
      InHouseTelemetryServiceMode.TRACKING -> {
        InHouseTelemetryPointStore.add(location)
        updateTrackingState(location)
      }
      InHouseTelemetryServiceMode.IDLE -> {
        // ignore
      }
    }
  }
}
