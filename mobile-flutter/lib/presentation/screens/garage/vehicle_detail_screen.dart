import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/router/app_router.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';
import 'package:intl/intl.dart';

final _vehicleDetailProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
  final res = await createDioClient().get('/api/v1/vehicles/$id');
  return res.data['data'] as Map<String, dynamic>;
});

final _healthProvider =
    FutureProvider.family<Map<String, dynamic>?, String>((ref, id) async {
  try {
    final res = await createDioClient().get('/api/v1/vehicles/$id/health');
    return res.data['data'] as Map<String, dynamic>?;
  } catch (_) {
    return null;
  }
});

class VehicleDetailScreen extends ConsumerWidget {
  final String vehicleId;
  const VehicleDetailScreen({super.key, required this.vehicleId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vehicleAsync = ref.watch(_vehicleDetailProvider(vehicleId));
    final healthAsync = ref.watch(_healthProvider(vehicleId));

    return vehicleAsync.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(
        appBar: AppBar(title: const Text('Vehicle Detail')),
        body: Center(child: Text('Error: $e')),
      ),
      data: (vehicle) => Scaffold(
        backgroundColor: AppColors.background,
        body: CustomScrollView(
          slivers: [
            _VehicleAppBar(vehicle: vehicle),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    healthAsync.when(
                      loading: () => const SizedBox.shrink(),
                      error: (_, __) => const SizedBox.shrink(),
                      data: (h) => h != null ? _HealthCard(health: h) : const SizedBox.shrink(),
                    ),
                    const SizedBox(height: 16),
                    _InfoGrid(vehicle: vehicle),
                    const SizedBox(height: 16),
                    _ActionGrid(vehicleId: vehicleId),
                    const SizedBox(height: 80),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VehicleAppBar extends StatelessWidget {
  final Map<String, dynamic> vehicle;
  const _VehicleAppBar({required this.vehicle});

  @override
  Widget build(BuildContext context) {
    final name = vehicle['nickname'] ?? vehicle['registrationNumber'] ?? 'My Vehicle';
    return SliverAppBar(
      expandedHeight: 200,
      pinned: true,
      backgroundColor: AppColors.primary,
      foregroundColor: Colors.white,
      flexibleSpace: FlexibleSpaceBar(
        title: Text(name, style: const TextStyle(fontFamily: 'Outfit', fontWeight: FontWeight.w700)),
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(colors: [AppColors.primaryDark, AppColors.primary]),
          ),
          child: Center(
            child: Icon(Icons.directions_car, size: 80, color: Colors.white.withOpacity(0.3)),
          ),
        ),
      ),
    );
  }
}

class _HealthCard extends StatelessWidget {
  final Map<String, dynamic> health;
  const _HealthCard({required this.health});

  @override
  Widget build(BuildContext context) {
    final score = ((health['overallScore'] as num?) ?? 0).toInt();
    final color = score >= 80 ? AppColors.success : score >= 50 ? AppColors.warning : AppColors.error;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(children: [
        SizedBox(
          width: 64, height: 64,
          child: Stack(alignment: Alignment.center, children: [
            CircularProgressIndicator(
              value: score / 100,
              backgroundColor: AppColors.border,
              valueColor: AlwaysStoppedAnimation(color),
              strokeWidth: 6,
            ),
            Text('$score', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: color, fontFamily: 'Outfit')),
          ]),
        ),
        const SizedBox(width: 16),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Health Score', style: Theme.of(context).textTheme.titleMedium),
          Text(score >= 80 ? 'Excellent' : score >= 50 ? 'Needs Attention' : 'Poor',
              style: TextStyle(color: color, fontWeight: FontWeight.w600, fontFamily: 'Outfit')),
        ])),
      ]),
    );
  }
}

class _InfoGrid extends StatelessWidget {
  final Map<String, dynamic> vehicle;
  const _InfoGrid({required this.vehicle});

  @override
  Widget build(BuildContext context) {
    final items = [
      {'label': 'Registration', 'value': vehicle['registrationNumber'] ?? '-'},
      {'label': 'Fuel Type', 'value': vehicle['fuelType'] ?? '-'},
      {'label': 'Year', 'value': vehicle['year']?.toString() ?? '-'},
      {'label': 'Odometer', 'value': vehicle['currentOdometer'] != null ? '${vehicle['currentOdometer']} km' : '-'},
      {'label': 'Insurance', 'value': vehicle['insuranceExpiry'] != null
          ? DateFormat('d MMM yyyy').format(DateTime.parse(vehicle['insuranceExpiry']))
          : '-'},
      {'label': 'PUC', 'value': vehicle['pucExpiry'] != null
          ? DateFormat('d MMM yyyy').format(DateTime.parse(vehicle['pucExpiry']))
          : '-'},
    ];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Vehicle Info', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 10),
      GridView.count(
        crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
        crossAxisSpacing: 10, mainAxisSpacing: 10, childAspectRatio: 2.4,
        children: items.map((i) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.surface, borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(i['label']!, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary, fontFamily: 'Outfit')),
            const SizedBox(height: 2),
            Text(i['value']!, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, fontFamily: 'Outfit'),
                maxLines: 1, overflow: TextOverflow.ellipsis),
          ]),
        )).toList(),
      ),
    ]);
  }
}

class _ActionGrid extends StatelessWidget {
  final String vehicleId;
  const _ActionGrid({required this.vehicleId});

  @override
  Widget build(BuildContext context) {
    final actions = [
      {'icon': Icons.history, 'label': 'Service\nHistory', 'route': AppRoutes.serviceHistory},
      {'icon': Icons.verified_user_outlined, 'label': 'Warranty\nStatus', 'route': AppRoutes.warrantyStatus},
      {'icon': Icons.gavel_outlined, 'label': 'Challans', 'route': AppRoutes.challans.replaceFirst(':vehicleId', vehicleId)},
      {'icon': Icons.analytics_outlined, 'label': 'Telematics', 'route': AppRoutes.drivingSummary},
    ];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Quick Actions', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 10),
      GridView.count(
        crossAxisCount: 4, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
        crossAxisSpacing: 10,
        children: actions.map((a) => GestureDetector(
          onTap: () => context.push(a['route'] as String),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Container(
              width: 52, height: 52,
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(a['icon'] as IconData, color: AppColors.primary, size: 26),
            ),
            const SizedBox(height: 6),
            Text(a['label'] as String,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 11, fontFamily: 'Outfit', fontWeight: FontWeight.w500, height: 1.2)),
          ]),
        )).toList(),
      ),
    ]);
  }
}
