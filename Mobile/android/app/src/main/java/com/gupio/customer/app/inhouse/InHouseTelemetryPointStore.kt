package com.gupio.customer.app.inhouse

import android.location.Location

data class InHouseTelemetryPoint(
  val latitude: Double,
  val longitude: Double,
  val timestampMs: Long,
  val speedKmh: Double?,
  val accuracy: Double?,
)

data class InHouseTelemetryCompletedTrip(
  val vehicleId: String?,
  val vehicleType: String?,
  val startedAtMs: Long?,
  val endedAtMs: Long,
  val points: List<InHouseTelemetryPoint>,
)

object InHouseTelemetryPointStore {
  private val activePoints = mutableListOf<InHouseTelemetryPoint>()
  private var activeVehicleId: String? = null
  private var activeVehicleType: String? = null
  private var activeStartedAtMs: Long? = null
  private val completedTrips = mutableListOf<InHouseTelemetryCompletedTrip>()

  @Synchronized
  fun beginTrip(
    vehicleId: String?,
    vehicleType: String?,
    startedAtMs: Long = System.currentTimeMillis(),
  ) {
    activePoints.clear()
    activeVehicleId = vehicleId
    activeVehicleType = vehicleType
    activeStartedAtMs = startedAtMs
  }

  @Synchronized
  fun add(location: Location) {
    val speedKmh = if (location.hasSpeed()) location.speed * 3.6 else null
    val accuracy = if (location.hasAccuracy()) location.accuracy.toDouble() else null

    activePoints.add(
      InHouseTelemetryPoint(
        latitude = location.latitude,
        longitude = location.longitude,
        timestampMs = if (location.time > 0) location.time else System.currentTimeMillis(),
        speedKmh = speedKmh,
        accuracy = accuracy,
      ),
    )
  }

  @Synchronized
  fun snapshot(): List<InHouseTelemetryPoint> = activePoints.toList()

  @Synchronized
  fun drain(): List<InHouseTelemetryPoint> {
    val copy = activePoints.toList()
    activePoints.clear()
    activeVehicleId = null
    activeVehicleType = null
    activeStartedAtMs = null
    return copy
  }

  @Synchronized
  fun completeTrip(
    endedAtMs: Long = System.currentTimeMillis(),
  ): InHouseTelemetryCompletedTrip? {
    if (activePoints.isEmpty()) {
      activeVehicleId = null
      activeVehicleType = null
      activeStartedAtMs = null
      return null
    }

    val trip = InHouseTelemetryCompletedTrip(
      vehicleId = activeVehicleId,
      vehicleType = activeVehicleType,
      startedAtMs = activeStartedAtMs,
      endedAtMs = endedAtMs,
      points = activePoints.toList(),
    )
    completedTrips.add(trip)
    activePoints.clear()
    activeVehicleId = null
    activeVehicleType = null
    activeStartedAtMs = null
    return trip
  }

  @Synchronized
  fun consumeCompletedTrip(): InHouseTelemetryCompletedTrip? {
    if (completedTrips.isEmpty()) return null
    return completedTrips.removeAt(0)
  }

  @Synchronized
  fun peekCompletedTrip(): InHouseTelemetryCompletedTrip? = completedTrips.firstOrNull()

  @Synchronized
  fun hasPendingCompletedTrip(): Boolean = completedTrips.isNotEmpty()

  @Synchronized
  fun getActiveStartedAtMs(): Long? = activeStartedAtMs

  @Synchronized
  fun getActivePointCount(): Int = activePoints.size

  @Synchronized
  fun getCompletedPointCount(): Int = completedTrips.firstOrNull()?.points?.size ?: 0

  @Synchronized
  fun isTripActive(): Boolean = activeStartedAtMs != null

  @Synchronized
  fun getActiveVehicleId(): String? = activeVehicleId

  @Synchronized
  fun getActiveVehicleType(): String? = activeVehicleType

  @Synchronized
  fun clearCompletedTrip() {
    completedTrips.clear()
  }

  @Synchronized
  fun clear() {
    activePoints.clear()
    activeVehicleId = null
    activeVehicleType = null
    activeStartedAtMs = null
    completedTrips.clear()
  }
}
