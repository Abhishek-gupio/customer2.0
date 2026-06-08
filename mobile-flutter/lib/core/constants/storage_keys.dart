/// Secure storage key names — mirrors Mobile/src/config/index.ts MMKV keys.
abstract final class StorageKeys {
  static const String accessToken = 'access_token';
  static const String refreshToken = 'refresh_token';
  static const String customerId = 'customer_id';
  static const String phoneNumber = 'phone_number';
  static const String fcmToken = 'fcm_token';
  static const String onboardingComplete = 'onboarding_complete';
  static const String selectedVehicleId = 'selected_vehicle_id';
  static const String locationPermissionAsked = 'location_permission_asked';
}
