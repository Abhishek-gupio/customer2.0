import 'package:dio/dio.dart';
import 'package:gupio_customer/core/config/app_config.dart';
import 'package:gupio_customer/infrastructure/http/auth_interceptor.dart';

/// Singleton Dio instance — mirrors Mobile/src/services/api.ts.
Dio createDioClient() {
  final dio = Dio(
    BaseOptions(
      baseUrl: apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ),
  );

  dio.interceptors.add(AuthInterceptor(dio));
  dio.interceptors.add(LogInterceptor(
    requestBody: false,
    responseBody: false,
    logPrint: (_) {},
  ));

  return dio;
}
