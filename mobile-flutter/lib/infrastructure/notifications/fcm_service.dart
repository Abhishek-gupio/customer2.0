import 'package:firebase_messaging/firebase_messaging.dart';

/// FCM service — mirrors Mobile/src/services/notifications.ts.
class FcmService {
  static final _messaging = FirebaseMessaging.instance;

  static Future<String?> initialize() async {
    await _messaging.requestPermission(alert: true, badge: true, sound: true);
    final token = await _messaging.getToken();

    FirebaseMessaging.onMessage.listen(_onForegroundMessage);
    FirebaseMessaging.onBackgroundMessage(_onBackgroundMessage);

    return token;
  }

  static Future<String?> getToken() => _messaging.getToken();

  static void _onForegroundMessage(RemoteMessage message) {
    // Delegate to in-app notification system via SocketManager or local notification
  }
}

@pragma('vm:entry-point')
Future<void> _onBackgroundMessage(RemoteMessage message) async {
  // Background handler — must be top-level
}
