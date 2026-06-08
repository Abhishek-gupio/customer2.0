import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';
import 'package:intl/intl.dart';

final _fuelPricesProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final res = await createDioClient().get('/api/v1/fuel/prices');
  return res.data['data'] as Map<String, dynamic>;
});

final _statsProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  try {
    final res = await createDioClient().get('/api/v1/telematics/stats');
    return res.data['data'] as Map<String, dynamic>?;
  } catch (_) { return null; }
});

class TripInsightsScreen extends ConsumerWidget {
  const TripInsightsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Trip Insights')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(_fuelPricesProvider);
          ref.invalidate(_statsProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            ref.watch(_fuelPricesProvider).when(
              loading: () => const _LoadingCard(),
              error: (_, __) => const SizedBox.shrink(),
              data: (prices) => _FuelPricesCard(prices: prices),
            ),
            const SizedBox(height: 16),
            ref.watch(_statsProvider).when(
              loading: () => const _LoadingCard(),
              error: (_, __) => const SizedBox.shrink(),
              data: (stats) => stats != null ? _DrivingStatsCard(stats: stats) : const SizedBox.shrink(),
            ),
            const SizedBox(height: 16),
            _FuelEfficiencyTips(),
          ],
        ),
      ),
    );
  }
}

class _FuelPricesCard extends StatelessWidget {
  final Map<String, dynamic> prices;
  const _FuelPricesCard({required this.prices});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
    final petrol = (prices['petrol'] as num?)?.toDouble();
    final diesel = (prices['diesel'] as num?)?.toDouble();
    final cng = (prices['cng'] as num?)?.toDouble();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.local_gas_station, color: AppColors.warning, size: 24),
          const SizedBox(width: 8),
          Text('Today\'s Fuel Prices', style: Theme.of(context).textTheme.titleMedium),
          const Spacer(),
          Text(prices['city']?.toString() ?? 'Pune',
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        ]),
        const SizedBox(height: 16),
        Row(children: [
          if (petrol != null) _FuelChip('Petrol', fmt.format(petrol), const Color(0xFFF59E0B)),
          if (petrol != null) const SizedBox(width: 10),
          if (diesel != null) _FuelChip('Diesel', fmt.format(diesel), const Color(0xFF6B7280)),
          if (diesel != null) const SizedBox(width: 10),
          if (cng != null) _FuelChip('CNG', fmt.format(cng), AppColors.success),
        ]),
      ]),
    );
  }
}

class _FuelChip extends StatelessWidget {
  final String label;
  final String price;
  final Color color;
  const _FuelChip(this.label, this.price, this.color);

  @override
  Widget build(BuildContext context) => Expanded(child: Container(
    padding: const EdgeInsets.symmetric(vertical: 12),
    decoration: BoxDecoration(color: color.withOpacity(0.08), borderRadius: BorderRadius.circular(10)),
    child: Column(children: [
      Text(label, style: TextStyle(fontSize: 12, color: color, fontFamily: 'Outfit', fontWeight: FontWeight.w600)),
      const SizedBox(height: 4),
      Text(price, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: color, fontFamily: 'Outfit')),
      const Text('/L', style: TextStyle(fontSize: 10, color: AppColors.textSecondary)),
    ]),
  ));
}

class _DrivingStatsCard extends StatelessWidget {
  final Map<String, dynamic> stats;
  const _DrivingStatsCard({required this.stats});

  @override
  Widget build(BuildContext context) {
    final total = (stats['totalDistanceKm'] as num?)?.toStringAsFixed(0) ?? '0';
    final trips = stats['totalTrips']?.toString() ?? '0';
    final avgScore = (stats['avgSafetyScore'] as num?)?.toStringAsFixed(0) ?? '-';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFF4F46E5), Color(0xFF6366F1)]),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Driving Statistics', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700, fontFamily: 'Outfit')),
        const SizedBox(height: 16),
        Row(children: [
          _StatItem('Total Distance', '$total km', Icons.route),
          _StatItem('Total Trips', trips, Icons.directions_car),
          _StatItem('Avg Score', avgScore, Icons.star),
        ]),
      ]),
    );
  }
}

class _StatItem extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  const _StatItem(this.label, this.value, this.icon);

  @override
  Widget build(BuildContext context) => Expanded(child: Column(children: [
    Icon(icon, color: Colors.white70, size: 20),
    const SizedBox(height: 6),
    Text(value, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800, fontFamily: 'Outfit')),
    Text(label, style: const TextStyle(color: Colors.white60, fontSize: 11, fontFamily: 'Outfit'), textAlign: TextAlign.center),
  ]));
}

class _FuelEfficiencyTips extends StatelessWidget {
  static const _tips = [
    ('Maintain steady speed', 'Avoid aggressive acceleration and braking to save up to 20% fuel.', Icons.speed),
    ('Tyre pressure check', 'Properly inflated tyres improve fuel efficiency by 3%.', Icons.tire_repair),
    ('AC usage', 'Park in shade and pre-cool your car to reduce AC load.', Icons.ac_unit),
    ('Engine warm-up', 'Modern cars don\'t need long warm-ups. Drive gently for the first km.', Icons.thermostat),
  ];

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text('Fuel Saving Tips', style: Theme.of(context).textTheme.titleMedium),
    const SizedBox(height: 12),
    ..._tips.map((t) => Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 36, height: 36,
          decoration: BoxDecoration(color: AppColors.accent.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
          child: Icon(t.$3, color: AppColors.accent, size: 18),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(t.$1, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, fontFamily: 'Outfit')),
          const SizedBox(height: 3),
          Text(t.$2, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4)),
        ])),
      ]),
    )),
  ]);
}

class _LoadingCard extends StatelessWidget {
  const _LoadingCard();

  @override
  Widget build(BuildContext context) => Container(
    height: 100,
    decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
    child: const Center(child: CircularProgressIndicator()),
  );
}
