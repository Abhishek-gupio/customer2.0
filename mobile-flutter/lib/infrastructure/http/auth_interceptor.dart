import 'package:dio/dio.dart';
import 'package:gupio_customer/core/config/app_config.dart';
import 'package:gupio_customer/core/constants/storage_keys.dart';
import 'package:gupio_customer/infrastructure/storage/secure_storage.dart';

/// Attaches Bearer token and auto-refreshes on 401 — mirrors Mobile/src/services/api.ts doRefresh().
class AuthInterceptor extends Interceptor {
  final Dio _dio;
  bool _isRefreshing = false;
  final List<_PendingRequest> _pending = [];

  AuthInterceptor(this._dio);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (!_requiresAuth(options.path)) {
      return handler.next(options);
    }
    final token = await SecureStorage.read(StorageKeys.accessToken);
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final response = err.response;
    if (response?.statusCode != 401) {
      return handler.next(err);
    }
    if (_isRefreshing) {
      _pending.add(_PendingRequest(err.requestOptions, handler));
      return;
    }
    _isRefreshing = true;
    try {
      final refreshToken = await SecureStorage.read(StorageKeys.refreshToken);
      if (refreshToken == null) throw Exception('No refresh token');

      final refreshDio = Dio(BaseOptions(baseUrl: apiBaseUrl));
      final res = await refreshDio.post(
        '/api/v1/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final data = res.data['data'];
      await SecureStorage.write(StorageKeys.accessToken, data['accessToken'] as String);
      await SecureStorage.write(StorageKeys.refreshToken, data['refreshToken'] as String);

      final opts = err.requestOptions;
      opts.headers['Authorization'] = 'Bearer ${data['accessToken']}';
      final retried = await _dio.fetch(opts);
      handler.resolve(retried);

      for (final p in _pending) {
        p.options.headers['Authorization'] = 'Bearer ${data['accessToken']}';
        _dio.fetch(p.options).then(p.handler.resolve).catchError(p.handler.reject);
      }
    } catch (_) {
      await SecureStorage.deleteAll();
      for (final p in _pending) {
        p.handler.next(DioException(requestOptions: p.options, error: 'Session expired'));
      }
      handler.next(err);
    } finally {
      _pending.clear();
      _isRefreshing = false;
    }
  }

  static bool _requiresAuth(String path) {
    const publicPaths = ['/api/v1/auth/send-otp', '/api/v1/auth/verify-otp', '/api/v1/auth/refresh', '/api/v1/auth/google', '/health'];
    return !publicPaths.any(path.startsWith);
  }
}

class _PendingRequest {
  final RequestOptions options;
  final ErrorInterceptorHandler handler;
  _PendingRequest(this.options, this.handler);
}
