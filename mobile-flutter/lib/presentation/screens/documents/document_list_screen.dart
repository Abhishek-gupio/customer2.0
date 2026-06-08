import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/router/app_router.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';
import 'package:intl/intl.dart';

final _docsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final res = await createDioClient().get('/api/v1/documents');
  return (res.data['data'] as List).cast<Map<String, dynamic>>();
});

class DocumentListScreen extends ConsumerWidget {
  const DocumentListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_docsProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Documents'),
        actions: [
          IconButton(
            icon: const Icon(Icons.account_balance_wallet_outlined),
            onPressed: () => context.push(AppRoutes.digilocker),
            tooltip: 'DigiLocker',
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const Center(child: Text('Failed to load documents')),
        data: (docs) => Column(
          children: [
            _QuickUploadRow(),
            Expanded(
              child: docs.isEmpty
                  ? _Empty()
                  : RefreshIndicator(
                      onRefresh: () => ref.refresh(_docsProvider.future),
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: docs.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (_, i) => _DocCard(doc: docs[i]),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickUploadRow extends StatelessWidget {
  static const _items = [
    {'icon': Icons.credit_card, 'label': 'DL'},
    {'icon': Icons.speed, 'label': 'FASTag'},
    {'icon': Icons.eco_outlined, 'label': 'PUC'},
    {'icon': Icons.shield_outlined, 'label': 'Insurance'},
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      child: Row(
        children: _items.map((it) => Expanded(child: GestureDetector(
          onTap: () {},
          child: Column(children: [
            Container(
              width: 48, height: 48,
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(it['icon'] as IconData, color: AppColors.primary, size: 22),
            ),
            const SizedBox(height: 5),
            Text(it['label'] as String, style: const TextStyle(fontSize: 11, fontFamily: 'Outfit', fontWeight: FontWeight.w600)),
          ]),
        ))).toList(),
      ),
    );
  }
}

class _DocCard extends StatelessWidget {
  final Map<String, dynamic> doc;
  const _DocCard({required this.doc});

  static const _icons = <String, IconData>{
    'DRIVING_LICENSE': Icons.credit_card,
    'INSURANCE': Icons.shield_outlined,
    'PUC': Icons.eco_outlined,
    'REGISTRATION': Icons.article_outlined,
    'FASTAG': Icons.speed,
    'OTHER': Icons.description_outlined,
  };

  static const _statusColors = <String, Color>{
    'VALID': AppColors.success,
    'EXPIRING_SOON': AppColors.warning,
    'EXPIRED': AppColors.error,
    'PENDING_VERIFICATION': AppColors.textSecondary,
  };

  @override
  Widget build(BuildContext context) {
    final type = doc['type']?.toString() ?? 'OTHER';
    final status = doc['status']?.toString() ?? 'VALID';
    final color = _statusColors[status] ?? AppColors.textSecondary;
    final expiry = doc['expiryDate'] != null
        ? DateFormat('d MMM yyyy').format(DateTime.parse(doc['expiryDate']))
        : null;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(children: [
        Container(
          width: 48, height: 48,
          decoration: BoxDecoration(
            color: AppColors.primary.withOpacity(0.08),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(_icons[type] ?? Icons.description_outlined, color: AppColors.primary, size: 24),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(type.replaceAll('_', ' '), style: Theme.of(context).textTheme.titleMedium),
          if (expiry != null)
            Text('Expires: $expiry', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
        ])),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(status.replaceAll('_', ' '), style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w700)),
        ),
      ]),
    );
  }
}

class _Empty extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.folder_open_outlined, size: 80, color: AppColors.border),
      const SizedBox(height: 16),
      Text('No documents yet', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 8),
      const Text('Upload your vehicle documents above', style: TextStyle(color: AppColors.textSecondary)),
    ]),
  );
}
