import 'package:gupio_customer/core/config/app_config.dart';
import 'package:gupio_customer/core/constants/storage_keys.dart';
import 'package:gupio_customer/infrastructure/storage/secure_storage.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

/// Socket.io manager — mirrors Backend socket event names exactly.
/// Events: 'join', 'new_notification'
class SocketManager {
  static io.Socket? _socket;

  static io.Socket get socket {
    _socket ??= io.io(socketBaseUrl, io.OptionBuilder()
        .setTransports(['websocket'])
        .disableAutoConnect()
        .build());
    return _socket!;
  }

  static Future<void> connect() async {
    final token = await SecureStorage.read(StorageKeys.accessToken);
    if (token == null) return;

    final s = socket;
    if (!s.connected) {
      s.auth = {'token': token};
      s.connect();
    }
  }

  static void disconnect() {
    _socket?.disconnect();
    _socket = null;
  }

  static void joinRoom(String room) {
    socket.emit('join', room);
  }

  static void on(String event, void Function(dynamic) handler) {
    socket.on(event, handler);
  }

  static void off(String event) {
    socket.off(event);
  }
}
