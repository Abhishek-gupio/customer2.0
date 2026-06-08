import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';
import 'package:intl/intl.dart';

final _notificationsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final res = await createDioClient().get('/api/v1/notifications');
  return (res.data['data'] as List).cast<Map<String, dynamic>>();
});

class AlertsScreen extends ConsumerWidget {
  const AlertsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_notificationsProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Alerts'),
        actions: [
          TextButton(
            onPressed: () async {
              await createDioClient().patch('/api/v1/notifications/read-all');
              ref.invalidate(_notificationsProvider);
            },
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const Center(child: Text('Failed to load notifications')),
        data: (items) => items.isEmpty
            ? _Empty()
            : RefreshIndicator(
                onRefresh: () => ref.refresh(_notificationsProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) => _NotifTile(item: items[i]),
                ),
              ),
      ),
    );
  }
}

class _NotifTile extends StatelessWidget {
  final Map<String, dynamic> item;
  const _NotifTile({required this.item});

  static const _icons = <String, IconData>{
    'MAINTENANCE': Icons.build_circle_outlined,
    'EXPENSE': Icons.receipt_long_outlined,
    'DOCUMENT': Icons.description_outlined,
    'SOS': Icons.emergency_outlined,
    'SYSTEM': Icons.info_outline,
  };

  @override
  Widget build(BuildContext context) {
    final isRead = item['isRead'] == true;
    final type = item['type']?.toString() ?? 'SYSTEM';
    final ts = item['createdAt'] != null
        ? DateFormat('d MMM, h:mm a').format(DateTime.parse(item['createdAt']))
        : '';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isRead ? AppColors.surface : AppColors.primary.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isRead ? AppColors.border : AppColors.primary.withOpacity(0.2),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42, height: 42,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(_icons[type] ?? Icons.notifications_outlined, color: AppColors.primary, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(
                item['title']?.toString() ?? type,
                style: TextStyle(
                  fontFamily: 'Outfit',
                  fontSize: 15,
                  fontWeight: isRead ? FontWeight.w500 : FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              if (item['body'] != null) ...[
                const SizedBox(height: 3),
                Text(item['body'].toString(),
                    style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis),
              ],
              const SizedBox(height: 4),
              Text(ts, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
            ]),
          ),
          if (!isRead)
            Container(
              width: 8, height: 8,
              margin: const EdgeInsets.only(top: 4),
              decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
            ),
        ],
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.notifications_none_outlined, size: 80, color: AppColors.border),
          const SizedBox(height: 16),
          Text("You're all caught up!", style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          const Text('No new alerts', style: TextStyle(color: AppColors.textSecondary)),
        ]),
      );
}
