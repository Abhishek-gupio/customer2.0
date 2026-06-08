import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';
import 'package:intl/intl.dart';

final _challansProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, vehicleId) async {
  final res = await createDioClient().get('/api/v1/vehicles/$vehicleId/challans');
  return (res.data['data'] as List).cast<Map<String, dynamic>>();
});

class ChallansScreen extends ConsumerWidget {
  final String vehicleId;
  const ChallansScreen({super.key, required this.vehicleId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_challansProvider(vehicleId));
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Traffic Challans')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const Center(child: Text('Failed to load challans')),
        data: (challans) => challans.isEmpty
            ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.check_circle_outline, size: 80, color: AppColors.success),
                const SizedBox(height: 16),
                Text('No pending challans!', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                const Text('Your vehicle has a clean record.', style: TextStyle(color: AppColors.textSecondary)),
              ]))
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: challans.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (_, i) => _ChallanCard(challan: challans[i]),
              ),
      ),
    );
  }
}

class _ChallanCard extends StatelessWidget {
  final Map<String, dynamic> challan;
  const _ChallanCard({required this.challan});

  @override
  Widget build(BuildContext context) {
    final isPaid = challan['isPaid'] == true;
    final amount = (challan['amount'] as num?)?.toDouble() ?? 0;
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final date = challan['offenseDate'] != null
        ? DateFormat('d MMM yyyy').format(DateTime.parse(challan['offenseDate']))
        : '';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isPaid ? AppColors.border : AppColors.error.withOpacity(0.3),
        ),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(
            challan['offense']?.toString() ?? 'Traffic Violation',
            style: Theme.of(context).textTheme.titleMedium,
          )),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: isPaid ? AppColors.success.withOpacity(0.1) : AppColors.error.withOpacity(0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(isPaid ? 'Paid' : 'Unpaid',
                style: TextStyle(
                  fontSize: 11,
                  color: isPaid ? AppColors.success : AppColors.error,
                  fontWeight: FontWeight.w700,
                )),
          ),
        ]),
        const SizedBox(height: 8),
        Row(children: [
          const Icon(Icons.location_on_outlined, size: 14, color: AppColors.textSecondary),
          const SizedBox(width: 4),
          Expanded(child: Text(challan['location']?.toString() ?? '-',
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary))),
          Text(fmt.format(amount),
              style: TextStyle(
                fontSize: 16, fontWeight: FontWeight.w700, fontFamily: 'Outfit',
                color: isPaid ? AppColors.textSecondary : AppColors.error,
              )),
        ]),
        const SizedBox(height: 4),
        Text(date, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        if (!isPaid) ...[
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () {},
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.primary),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text('Pay Now'),
            ),
          ),
        ],
      ]),
    );
  }
}
