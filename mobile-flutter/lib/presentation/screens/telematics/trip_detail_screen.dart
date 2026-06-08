import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';
import 'package:intl/intl.dart';

final _tripDetailProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, tripId) async {
  final res = await createDioClient().get('/api/v1/telematics/trips/$tripId');
  return res.data['data'] as Map<String, dynamic>;
});

class TripDetailScreen extends ConsumerWidget {
  final String tripId;
  const TripDetailScreen({super.key, required this.tripId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_tripDetailProvider(tripId));
    return async.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(
        appBar: AppBar(title: const Text('Trip Detail')),
        body: Center(child: Text('Error: $e')),
      ),
      data: (trip) => Scaffold(
        backgroundColor: AppColors.background,
        body: CustomScrollView(
          slivers: [
            _TripAppBar(trip: trip),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(children: [
                  _ScoreCard(trip: trip),
                  const SizedBox(height: 16),
                  _StatsGrid(trip: trip),
                  const SizedBox(height: 16),
                  _EventsList(trip: trip),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TripAppBar extends StatelessWidget {
  final Map<String, dynamic> trip;
  const _TripAppBar({required this.trip});

  @override
  Widget build(BuildContext context) {
    final start = trip['startTime'] != null ? DateTime.parse(trip['startTime']) : null;
    final title = start != null ? DateFormat('d MMM yyyy, h:mm a').format(start) : 'Trip Detail';
    return SliverAppBar(
      expandedHeight: 140,
      pinned: true,
      backgroundColor: AppColors.primary,
      foregroundColor: Colors.white,
      flexibleSpace: FlexibleSpaceBar(
        title: Text(title, style: const TextStyle(fontFamily: 'Outfit', fontSize: 15)),
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(colors: [AppColors.primaryDark, AppColors.primary]),
          ),
        ),
      ),
    );
  }
}

class _ScoreCard extends StatelessWidget {
  final Map<String, dynamic> trip;
  const _ScoreCard({required this.trip});

  @override
  Widget build(BuildContext context) {
    final score = (trip['safetyScore'] as num?)?.toInt() ?? 0;
    final color = score >= 80 ? AppColors.success : score >= 60 ? AppColors.warning : AppColors.error;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Row(children: [
        SizedBox(
          width: 80, height: 80,
          child: Stack(alignment: Alignment.center, children: [
            CircularProgressIndicator(
              value: score / 100,
              backgroundColor: AppColors.border,
              valueColor: AlwaysStoppedAnimation(color),
              strokeWidth: 8,
            ),
            Column(mainAxisSize: MainAxisSize.min, children: [
              Text('$score', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: color, fontFamily: 'Outfit')),
              const Text('/100', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
            ]),
          ]),
        ),
        const SizedBox(width: 20),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Safety Score', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text(
            score >= 80 ? 'Excellent driving!' : score >= 60 ? 'Good — room to improve' : 'Needs improvement',
            style: TextStyle(color: color, fontWeight: FontWeight.w600),
          ),
        ])),
      ]),
    );
  }
}

class _StatsGrid extends StatelessWidget {
  final Map<String, dynamic> trip;
  const _StatsGrid({required this.trip});

  @override
  Widget build(BuildContext context) {
    final dist = (trip['distanceKm'] as num?)?.toStringAsFixed(1) ?? '0.0';
    final dur = trip['durationMinutes']?.toString() ?? '-';
    final maxSpeed = (trip['maxSpeedKmh'] as num?)?.toStringAsFixed(0) ?? '-';
    final avgSpeed = (trip['avgSpeedKmh'] as num?)?.toStringAsFixed(0) ?? '-';
    final items = [
      {'label': 'Distance', 'value': '$dist km', 'icon': Icons.route},
      {'label': 'Duration', 'value': '$dur min', 'icon': Icons.access_time},
      {'label': 'Max Speed', 'value': '$maxSpeed km/h', 'icon': Icons.speed},
      {'label': 'Avg Speed', 'value': '$avgSpeed km/h', 'icon': Icons.trending_up},
    ];
    return GridView.count(
      crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 10, mainAxisSpacing: 10, childAspectRatio: 1.8,
      children: items.map((it) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(it['icon'] as IconData, size: 16, color: AppColors.primary),
            const SizedBox(width: 6),
            Text(it['label'] as String, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontFamily: 'Outfit')),
          ]),
          const SizedBox(height: 6),
          Text(it['value'] as String, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, fontFamily: 'Outfit')),
        ]),
      )).toList(),
    );
  }
}

class _EventsList extends StatelessWidget {
  final Map<String, dynamic> trip;
  const _EventsList({required this.trip});

  @override
  Widget build(BuildContext context) {
    final events = (trip['events'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    if (events.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Driving Events', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 10),
      ...events.map((e) {
        final type = e['type']?.toString() ?? '-';
        final icon = type.contains('BRAKE') ? Icons.warning_amber : type.contains('SPEED') ? Icons.speed : Icons.event;
        final color = type.contains('HARD') ? AppColors.error : AppColors.warning;
        return Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppColors.border)),
          child: Row(children: [
            Icon(icon, color: color, size: 18),
            const SizedBox(width: 10),
            Expanded(child: Text(type.replaceAll('_', ' '), style: const TextStyle(fontSize: 14, fontFamily: 'Outfit', fontWeight: FontWeight.w500))),
            if (e['value'] != null)
              Text('${e['value']}', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
          ]),
        );
      }),
    ]);
  }
}
