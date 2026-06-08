import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/router/app_router.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';
import 'package:intl/intl.dart';

final _tripsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final res = await createDioClient().get('/api/v1/telematics/trips', queryParameters: {'limit': 50});
  return (res.data['data'] as List).cast<Map<String, dynamic>>();
});

class DrivingTimelineScreen extends ConsumerWidget {
  const DrivingTimelineScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_tripsProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Driving Timeline')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const Center(child: Text('Failed to load trips')),
        data: (trips) => trips.isEmpty
            ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.route, size: 80, color: AppColors.border),
                const SizedBox(height: 16),
                Text('No trips recorded', style: Theme.of(context).textTheme.titleLarge),
              ]))
            : RefreshIndicator(
                onRefresh: () => ref.refresh(_tripsProvider.future),
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: trips.length,
                  itemBuilder: (_, i) => _TimelineTripItem(trip: trips[i], isLast: i == trips.length - 1),
                ),
              ),
      ),
    );
  }
}

class _TimelineTripItem extends StatelessWidget {
  final Map<String, dynamic> trip;
  final bool isLast;
  const _TimelineTripItem({required this.trip, required this.isLast});

  @override
  Widget build(BuildContext context) {
    final score = (trip['safetyScore'] as num?)?.toInt() ?? 0;
    final color = score >= 80 ? AppColors.success : score >= 60 ? AppColors.warning : AppColors.error;
    final start = trip['startTime'] != null ? DateTime.parse(trip['startTime']) : null;
    final dateStr = start != null ? DateFormat('d MMM, h:mm a').format(start) : '-';
    final distKm = (trip['distanceKm'] as num?)?.toStringAsFixed(1) ?? '0.0';

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 40,
            child: Column(children: [
              Container(
                width: 14, height: 14,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              if (!isLast) Expanded(child: Container(width: 2, color: AppColors.border)),
            ]),
          ),
          Expanded(
            child: GestureDetector(
              onTap: () {
                final id = trip['id']?.toString();
                if (id != null) context.push('/telematics/trip/$id');
              },
              child: Container(
                margin: const EdgeInsets.only(left: 8, bottom: 12),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Text(dateStr, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
                      child: Text('Score: $score', style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700)),
                    ),
                  ]),
                  const SizedBox(height: 8),
                  Row(children: [
                    const Icon(Icons.route, size: 16, color: AppColors.primary),
                    const SizedBox(width: 4),
                    Text('$distKm km', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, fontFamily: 'Outfit')),
                    const SizedBox(width: 16),
                    const Icon(Icons.access_time, size: 16, color: AppColors.textSecondary),
                    const SizedBox(width: 4),
                    Text('${trip['durationMinutes'] ?? '-'} min',
                        style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                  ]),
                ]),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
