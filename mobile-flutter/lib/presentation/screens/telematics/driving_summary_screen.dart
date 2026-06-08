import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';
import 'package:intl/intl.dart';

class DrivingSummaryScreen extends ConsumerWidget {
  const DrivingSummaryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: const Text('Driving Summary')),
    body: FutureBuilder(
      future: createDioClient().get('/api/v1/telematics/trips'),
      builder: (ctx, snap) {
        if (snap.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());
        if (snap.hasError) return const Center(child: Text('Could not load trips'));
        final trips = (snap.data!.data['data'] as List).cast<Map<String, dynamic>>();
        if (trips.isEmpty) return _Empty();
        return ListView(padding: const EdgeInsets.all(16), children: [
          _StatsRow(trips: trips),
          const SizedBox(height: 20),
          Text('Recent Trips', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          ...trips.map((t) => _TripCard(trip: t, onTap: () => context.push('/telematics/trip/${t['id']}'))),
          const SizedBox(height: 80),
        ]);
      },
    ),
  );
}

class _StatsRow extends StatelessWidget {
  final List<Map<String, dynamic>> trips;
  const _StatsRow({required this.trips});

  @override
  Widget build(BuildContext context) {
    final totalKm = trips.fold(0.0, (s, t) => s + ((t['distanceKm'] as num?)?.toDouble() ?? 0));
    final avgScore = trips.isEmpty ? 0 : (trips.fold(0.0, (s, t) => s + ((t['safetyScore'] as num?)?.toDouble() ?? 0)) / trips.length).round();
    return Row(children: [
      _Stat('${trips.length}', 'Trips', Icons.route, AppColors.primary),
      const SizedBox(width: 12),
      _Stat('${totalKm.toStringAsFixed(0)} km', 'Distance', Icons.speed, AppColors.accent),
      const SizedBox(width: 12),
      _Stat('$avgScore', 'Avg Score', Icons.star, AppColors.warning),
    ]);
  }
}

class _Stat extends StatelessWidget {
  final String value, label; final IconData icon; final Color color;
  const _Stat(this.value, this.label, this.icon, this.color);

  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: color.withOpacity(0.08), borderRadius: BorderRadius.circular(14), border: Border.all(color: color.withOpacity(0.15))),
      child: Column(children: [
        Icon(icon, color: color, size: 22),
        const SizedBox(height: 6),
        Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: color, fontFamily: 'Outfit')),
        Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary, fontFamily: 'Outfit')),
      ]),
    ),
  );
}

class _TripCard extends StatelessWidget {
  final Map<String, dynamic> trip; final VoidCallback onTap;
  const _TripCard({required this.trip, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final date = trip['startTime'] != null ? DateFormat('d MMM, h:mm a').format(DateTime.parse(trip['startTime'])) : '';
    final dist = (trip['distanceKm'] as num?)?.toStringAsFixed(1) ?? '0';
    final score = (trip['safetyScore'] as num?)?.toStringAsFixed(0) ?? '-';
    final scoreColor = (trip['safetyScore'] as num? ?? 0) >= 70 ? AppColors.success : AppColors.warning;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
        child: Row(children: [
          Container(width: 44, height: 44, decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
            child: const Icon(Icons.route, color: AppColors.primary, size: 22)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(date, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontSize: 14)),
            Text('$dist km', style: Theme.of(context).textTheme.bodyMedium),
          ])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(score, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: scoreColor, fontFamily: 'Outfit')),
            const Text('score', style: TextStyle(fontSize: 11, color: AppColors.textSecondary, fontFamily: 'Outfit')),
          ]),
          const SizedBox(width: 8),
          const Icon(Icons.chevron_right, color: AppColors.textSecondary),
        ]),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
    const Icon(Icons.route, size: 80, color: AppColors.border),
    const SizedBox(height: 16),
    Text('No trips recorded', style: Theme.of(context).textTheme.titleLarge),
    const SizedBox(height: 8),
    Text('Start driving to see your trips here', style: Theme.of(context).textTheme.bodyMedium),
  ]));
}
