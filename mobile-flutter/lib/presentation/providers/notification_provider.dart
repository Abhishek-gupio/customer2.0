import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/infrastructure/socket/socket_manager.dart';

class NotificationState {
  final List<Map<String, dynamic>> notifications;
  final int unreadCount;
  final bool isLoading;

  const NotificationState({
    this.notifications = const [],
    this.unreadCount = 0,
    this.isLoading = false,
  });

  NotificationState copyWith({
    List<Map<String, dynamic>>? notifications,
    int? unreadCount,
    bool? isLoading,
  }) =>
      NotificationState(
        notifications: notifications ?? this.notifications,
        unreadCount: unreadCount ?? this.unreadCount,
        isLoading: isLoading ?? this.isLoading,
      );
}

class NotificationNotifier extends Notifier<NotificationState> {
  late final Dio _dio;

  @override
  NotificationState build() {
    _dio = createDioClient();
    _listenToSocket();
    return const NotificationState();
  }

  void _listenToSocket() {
    SocketManager.on('new_notification', (data) {
      final notif = Map<String, dynamic>.from(data as Map);
      state = state.copyWith(
        notifications: [notif, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      );
    });
  }

  Future<void> fetchNotifications() async {
    state = state.copyWith(isLoading: true);
    try {
      final res = await _dio.get('/api/v1/notifications');
      final list = (res.data['data'] as List).cast<Map<String, dynamic>>();
      final unread = list.where((n) => n['isRead'] == false).length;
      state = state.copyWith(isLoading: false, notifications: list, unreadCount: unread);
    } on DioException {
      state = state.copyWith(isLoading: false);
    }
  }

  Future<void> markRead(String id) async {
    try {
      await _dio.patch('/api/v1/notifications/$id/read');
      final updated = state.notifications.map((n) {
        if (n['id'] == id) return {...n, 'isRead': true};
        return n;
      }).toList();
      final unread = updated.where((n) => n['isRead'] == false).length;
      state = state.copyWith(notifications: updated, unreadCount: unread);
    } on DioException {
      // ignore
    }
  }
}

final notificationProvider = NotifierProvider<NotificationNotifier, NotificationState>(NotificationNotifier.new);
