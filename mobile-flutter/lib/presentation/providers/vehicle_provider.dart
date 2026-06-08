import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';

/// Vehicle list state — mirrors Redux vehicleSlice.
class VehicleState {
  final List<Map<String, dynamic>> vehicles;
  final bool isLoading;
  final String? selectedVehicleId;
  final String? error;

  const VehicleState({
    this.vehicles = const [],
    this.isLoading = false,
    this.selectedVehicleId,
    this.error,
  });

  VehicleState copyWith({
    List<Map<String, dynamic>>? vehicles,
    bool? isLoading,
    String? selectedVehicleId,
    String? error,
  }) =>
      VehicleState(
        vehicles: vehicles ?? this.vehicles,
        isLoading: isLoading ?? this.isLoading,
        selectedVehicleId: selectedVehicleId ?? this.selectedVehicleId,
        error: error ?? this.error,
      );

  Map<String, dynamic>? get selectedVehicle =>
      selectedVehicleId == null ? (vehicles.isEmpty ? null : vehicles.first) : vehicles.cast<Map<String, dynamic>>().where((v) => v['id'] == selectedVehicleId).firstOrNull;
}

class VehicleNotifier extends Notifier<VehicleState> {
  late final Dio _dio;

  @override
  VehicleState build() {
    _dio = createDioClient();
    return const VehicleState();
  }

  Future<void> fetchVehicles() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await _dio.get('/api/v1/vehicles');
      final List list = res.data['data'] as List;
      state = state.copyWith(
        isLoading: false,
        vehicles: list.cast<Map<String, dynamic>>(),
      );
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, error: e.message);
    }
  }

  void selectVehicle(String vehicleId) {
    state = state.copyWith(selectedVehicleId: vehicleId);
  }

  Future<Map<String, dynamic>?> addVehicle(Map<String, dynamic> body) async {
    state = state.copyWith(isLoading: true);
    try {
      final res = await _dio.post('/api/v1/vehicles', data: body);
      await fetchVehicles();
      return res.data['data'] as Map<String, dynamic>?;
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, error: e.message);
      return null;
    }
  }

  Future<void> deleteVehicle(String vehicleId) async {
    try {
      await _dio.delete('/api/v1/vehicles/$vehicleId');
      await fetchVehicles();
    } on DioException catch (e) {
      state = state.copyWith(error: e.message);
    }
  }
}

final vehicleProvider = NotifierProvider<VehicleNotifier, VehicleState>(VehicleNotifier.new);
