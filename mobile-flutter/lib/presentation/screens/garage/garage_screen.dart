import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gupio_customer/presentation/providers/vehicle_provider.dart';
import 'package:gupio_customer/presentation/router/app_router.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';

class GarageScreen extends ConsumerStatefulWidget {
  const GarageScreen({super.key});

  @override
  ConsumerState<GarageScreen> createState() => _GarageScreenState();
}

class _GarageScreenState extends ConsumerState<GarageScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(vehicleProvider.notifier).fetchVehicles();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(vehicleProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('My Garage'),
        actions: [
          IconButton(icon: const Icon(Icons.add), onPressed: () => context.push(AppRoutes.addVehicle)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(vehicleProvider.notifier).fetchVehicles(),
        child: state.isLoading
            ? const Center(child: CircularProgressIndicator())
            : state.vehicles.isEmpty
                ? _EmptyGarage()
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _StatsHeader(vehicles: state.vehicles),
                      const SizedBox(height: 16),
                      ...state.vehicles.map((v) => _VehicleCard(
                        vehicle: v,
                        onTap: () => context.push('/garage/${v['id']}'),
                        onDelete: () => _confirmDelete(context, ref, v),
                      )),
                      const SizedBox(height: 80),
                    ],
                  ),
      ),
    );
  }

  void _confirmDelete(BuildContext ctx, WidgetRef ref, Map<String, dynamic> v) {
    showDialog(
      context: ctx,
      builder: (_) => AlertDialog(
        title: const Text('Remove Vehicle'),
        content: Text('Remove ${v['registrationNumber']} from your garage?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              ref.read(vehicleProvider.notifier).deleteVehicle(v['id'].toString());
            },
            child: const Text('Remove', style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
  }
}

class _StatsHeader extends StatelessWidget {
  final List<Map<String, dynamic>> vehicles;
  const _StatsHeader({required this.vehicles});

  @override
  Widget build(BuildContext context) {
    final avgHealth = vehicles.isEmpty ? 0 : (vehicles.map((v) => ((v['healthScore']?['overallScore'] ?? 0) as num).toDouble()).fold(0.0, (a, b) => a + b) / vehicles.length).round();
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [AppColors.primary, AppColors.primaryDark]),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
        _Stat('TOTAL', '${vehicles.length}'),
        Container(width: 1, height: 40, color: Colors.white30),
        _Stat('AVG HEALTH', '$avgHealth%'),
      ]),
    );
  }
}

class _Stat extends StatelessWidget {
  final String label, value;
  const _Stat(this.label, this.value);

  @override
  Widget build(BuildContext context) => Column(children: [
    Text(value, style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w700, fontFamily: 'Outfit')),
    const SizedBox(height: 2),
    Text(label, style: const TextStyle(color: Colors.white60, fontSize: 11, letterSpacing: 1, fontFamily: 'Outfit')),
  ]);
}

class _VehicleCard extends StatelessWidget {
  final Map<String, dynamic> vehicle;
  final VoidCallback onTap, onDelete;
  const _VehicleCard({required this.vehicle, required this.onTap, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final health = ((vehicle['healthScore']?['overallScore'] ?? 0) as num).toDouble();
    final healthColor = health >= 70 ? AppColors.success : health >= 40 ? AppColors.warning : AppColors.error;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
        child: Row(children: [
          Container(
            width: 52, height: 52,
            decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
            child: const Icon(Icons.directions_car, color: AppColors.primary, size: 28),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(vehicle['registrationNumber']?.toString() ?? '', style: Theme.of(context).textTheme.titleMedium),
            Text('${vehicle['brand'] ?? ''} ${vehicle['model'] ?? ''}', style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 6),
            Row(children: [
              Icon(Icons.favorite, color: healthColor, size: 13),
              const SizedBox(width: 4),
              Text('${health.toStringAsFixed(0)}% Health', style: TextStyle(color: healthColor, fontSize: 12, fontWeight: FontWeight.w600, fontFamily: 'Outfit')),
            ]),
          ])),
          IconButton(icon: const Icon(Icons.delete_outline, color: AppColors.error), onPressed: onDelete),
          const Icon(Icons.chevron_right, color: AppColors.textSecondary),
        ]),
      ),
    );
  }
}

class _EmptyGarage extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.garage_outlined, size: 80, color: AppColors.border),
      const SizedBox(height: 16),
      Text('No vehicles yet', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 8),
      Text('Add your first vehicle to get started', style: Theme.of(context).textTheme.bodyMedium),
      const SizedBox(height: 24),
      ElevatedButton.icon(
        icon: const Icon(Icons.add),
        label: const Text('Add Vehicle'),
        onPressed: () => context.push(AppRoutes.addVehicle),
      ),
    ]),
  );
}
