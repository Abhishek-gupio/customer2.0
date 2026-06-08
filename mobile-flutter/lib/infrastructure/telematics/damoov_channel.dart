import 'package:flutter/services.dart';

/// Damoov SDK bridge — mirrors Mobile/src/native/DamoovTelematics.ts
/// MethodChannel name must match android/app/…/MainActivity.kt registration.
class DamoovTelematics {
  static const _channel = MethodChannel('tech.gupio.customer/damoov');

  /// Set user device ID in Damoov SDK.
  static Future<bool> setDeviceId(String deviceId) async {
    try {
      final result = await _channel.invokeMethod<bool>('setDeviceId', {'deviceId': deviceId});
      return result ?? false;
    } on PlatformException {
      return false;
    }
  }

  /// Enable or disable trip recording.
  static Future<bool> setEnabled(bool enabled) async {
    try {
      final result = await _channel.invokeMethod<bool>('setEnabled', {'enabled': enabled});
      return result ?? false;
    } on PlatformException {
      return false;
    }
  }

  /// Log out the current user from Damoov SDK.
  static Future<void> logout() async {
    try {
      await _channel.invokeMethod<void>('logout');
    } on PlatformException {
      // Ignore — user may not be logged in
    }
  }

  /// Get the latest trip data from Damoov.
  static Future<Map<String, dynamic>?> getLatestTrip() async {
    try {
      final result = await _channel.invokeMethod<Map>('getLatestTrip');
      return result?.cast<String, dynamic>();
    } on PlatformException {
      return null;
    }
  }

  /// Start a manual trip.
  static Future<bool> startTrip() async {
    try {
      final result = await _channel.invokeMethod<bool>('startTrip');
      return result ?? false;
    } on PlatformException {
      return false;
    }
  }

  /// Stop the current manual trip.
  static Future<bool> stopTrip() async {
    try {
      final result = await _channel.invokeMethod<bool>('stopTrip');
      return result ?? false;
    } on PlatformException {
      return false;
    }
  }
}
