import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';
import 'package:intl/intl.dart';

final _warrantyProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final res = await createDioClient().get('/api/v1/services/warranties');
  return (res.data['data'] as List).cast<Map<String, dynamic>>();
});

class WarrantyStatusScreen extends ConsumerWidget {
  const WarrantyStatusScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_warrantyProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Warranty Status')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => _NoWarrantyView(),
        data: (items) => items.isEmpty
            ? _NoWarrantyView()
            : RefreshIndicator(
                onRefresh: () => ref.refresh(_warrantyProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => _WarrantyCard(item: items[i]),
                ),
              ),
      ),
    );
  }
}

class _WarrantyCard extends StatelessWidget {
  final Map<String, dynamic> item;
  const _WarrantyCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final expiry = item['expiryDate'] != null
        ? DateTime.parse(item['expiryDate'])
        : null;
    final daysLeft = expiry != null ? expiry.difference(DateTime.now()).inDays : null;
    final color = daysLeft == null
        ? AppColors.textSecondary
        : daysLeft > 90
            ? AppColors.success
            : daysLeft > 30
                ? AppColors.warning
                : AppColors.error;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(Icons.verified_user_outlined, color: color, size: 28),
          const SizedBox(width: 10),
          Expanded(child: Text(item['warrantyType']?.toString().replaceAll('_', ' ') ?? 'Warranty',
              style: Theme.of(context).textTheme.titleMedium)),
          if (daysLeft != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
              child: Text(
                daysLeft > 0 ? '$daysLeft days left' : 'Expired',
                style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700),
              ),
            ),
        ]),
        const SizedBox(height: 10),
        _InfoRow('Provider', item['provider']?.toString() ?? '-'),
        _InfoRow('Coverage', item['coverage']?.toString() ?? 'Full coverage'),
        if (expiry != null) _InfoRow('Expires', DateFormat('d MMM yyyy').format(expiry)),
        if (item['claimsUsed'] != null) _InfoRow('Claims used', '${item['claimsUsed']}'),
      ]),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow(this.label, this.value);

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(children: [
      SizedBox(width: 90, child: Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, fontFamily: 'Outfit'))),
      Expanded(child: Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, fontFamily: 'Outfit'))),
    ]),
  );
}

class _NoWarrantyView extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.verified_user_outlined, size: 80, color: AppColors.border),
      const SizedBox(height: 16),
      Text('No warranties found', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 8),
      const Text('Add vehicle warranty details in settings', style: TextStyle(color: AppColors.textSecondary)),
    ]),
  );
}
