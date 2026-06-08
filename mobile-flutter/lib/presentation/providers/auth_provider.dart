import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/core/config/app_config.dart';
import 'package:gupio_customer/core/constants/storage_keys.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/infrastructure/storage/secure_storage.dart';

/// Auth state — mirrors Redux authSlice + AuthContext from React Native.
class AuthState {
  final bool isAuthenticated;
  final bool isLoading;
  final String? customerId;
  final String? phoneNumber;
  final String? error;

  const AuthState({
    this.isAuthenticated = false,
    this.isLoading = false,
    this.customerId,
    this.phoneNumber,
    this.error,
  });

  AuthState copyWith({
    bool? isAuthenticated,
    bool? isLoading,
    String? customerId,
    String? phoneNumber,
    String? error,
  }) =>
      AuthState(
        isAuthenticated: isAuthenticated ?? this.isAuthenticated,
        isLoading: isLoading ?? this.isLoading,
        customerId: customerId ?? this.customerId,
        phoneNumber: phoneNumber ?? this.phoneNumber,
        error: error ?? this.error,
      );
}

class AuthNotifier extends Notifier<AuthState> {
  late final Dio _dio;

  @override
  AuthState build() {
    _dio = createDioClient();
    _restoreSession();
    return const AuthState(isLoading: true); // hold splash until restore completes
  }

  Future<void> _restoreSession() async {
    final token = await SecureStorage.read(StorageKeys.accessToken);
    final customerId = await SecureStorage.read(StorageKeys.customerId);
    if (token != null && customerId != null) {
      state = state.copyWith(isLoading: false, isAuthenticated: true, customerId: customerId);
    } else {
      // Setting state (even unchanged auth) rebuilds the router so redirect fires
      state = state.copyWith(isLoading: false, isAuthenticated: false);
    }
  }

  Future<void> sendOtp(String phone) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _dio.post('/api/v1/auth/send-otp', data: {'phone': phone});
      state = state.copyWith(isLoading: false, phoneNumber: phone);
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, error: _extractError(e));
    }
  }

  Future<bool> verifyOtp(String phone, String otp) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await _dio.post('/api/v1/auth/verify-otp', data: {'phone': phone, 'otp': otp});
      final data = res.data['data'];
      await SecureStorage.write(StorageKeys.accessToken, data['accessToken'] as String);
      await SecureStorage.write(StorageKeys.refreshToken, data['refreshToken'] as String);
      await SecureStorage.write(StorageKeys.customerId, data['customer']['id'] as String);
      await SecureStorage.write(StorageKeys.phoneNumber, phone);
      state = state.copyWith(isLoading: false, isAuthenticated: true, customerId: data['customer']['id'] as String);
      return true;
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, error: _extractError(e));
      return false;
    }
  }

  Future<bool> googleLogin(String idToken) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await _dio.post('/api/v1/auth/google', data: {'idToken': idToken});
      final data = res.data['data'];
      await SecureStorage.write(StorageKeys.accessToken, data['accessToken'] as String);
      await SecureStorage.write(StorageKeys.refreshToken, data['refreshToken'] as String);
      await SecureStorage.write(StorageKeys.customerId, data['customer']['id'] as String);
      state = state.copyWith(isLoading: false, isAuthenticated: true, customerId: data['customer']['id'] as String);
      return true;
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, error: _extractError(e));
      return false;
    }
  }

  Future<void> logout() async {
    try {
      await _dio.post('/api/v1/auth/logout');
    } catch (_) {}
    await SecureStorage.deleteAll();
    state = const AuthState();
  }

  String _extractError(DioException e) =>
      (e.response?.data as Map<String, dynamic>?)?['error']?['message'] as String? ?? e.message ?? 'Unknown error';
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);
