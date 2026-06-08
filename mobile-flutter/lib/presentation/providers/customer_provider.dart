import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';

class CustomerState {
  final Map<String, dynamic>? profile;
  final bool isLoading;
  final String? error;

  const CustomerState({this.profile, this.isLoading = false, this.error});

  CustomerState copyWith({Map<String, dynamic>? profile, bool? isLoading, String? error}) =>
      CustomerState(
        profile: profile ?? this.profile,
        isLoading: isLoading ?? this.isLoading,
        error: error ?? this.error,
      );
}

class CustomerNotifier extends Notifier<CustomerState> {
  late final Dio _dio;

  @override
  CustomerState build() {
    _dio = createDioClient();
    return const CustomerState();
  }

  Future<void> fetchProfile() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await _dio.get('/api/v1/customer/profile');
      state = state.copyWith(isLoading: false, profile: res.data['data'] as Map<String, dynamic>?);
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, error: e.message);
    }
  }

  Future<void> updateProfile(Map<String, dynamic> data) async {
    state = state.copyWith(isLoading: true);
    try {
      final res = await _dio.put('/api/v1/customer/profile', data: data);
      state = state.copyWith(isLoading: false, profile: res.data['data'] as Map<String, dynamic>?);
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, error: e.message);
    }
  }
}

final customerProvider = NotifierProvider<CustomerNotifier, CustomerState>(CustomerNotifier.new);
