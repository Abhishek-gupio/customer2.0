import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';
import 'package:intl/intl.dart';

final _analyticsProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final res = await createDioClient().get('/api/v1/expenses/analytics');
  return res.data['data'] as Map<String, dynamic>;
});

class ExpenseAnalyticsScreen extends ConsumerWidget {
  const ExpenseAnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_analyticsProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Expense Analytics')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => _FallbackView(),
        data: (data) => RefreshIndicator(
          onRefresh: () => ref.refresh(_analyticsProvider.future),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _TotalCard(data: data),
              const SizedBox(height: 16),
              _CategoryBreakdown(data: data),
              const SizedBox(height: 16),
              _MonthlyTrend(data: data),
            ],
          ),
        ),
      ),
    );
  }
}

class _TotalCard extends StatelessWidget {
  final Map<String, dynamic> data;
  const _TotalCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final total = (data['totalAmount'] as num?)?.toDouble() ?? 0;
    final count = data['totalTransactions']?.toString() ?? '0';
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [AppColors.primary, AppColors.primaryDark]),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Total Spending', style: TextStyle(color: Colors.white70, fontFamily: 'Outfit')),
        const SizedBox(height: 4),
        Text(fmt.format(total), style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.w800, fontFamily: 'Outfit')),
        const SizedBox(height: 12),
        Text('$count transactions this period',
            style: const TextStyle(color: Colors.white60, fontSize: 13, fontFamily: 'Outfit')),
      ]),
    );
  }
}

class _CategoryBreakdown extends StatelessWidget {
  final Map<String, dynamic> data;
  const _CategoryBreakdown({required this.data});

  static const _icons = <String, IconData>{
    'FUEL': Icons.local_gas_station,
    'SERVICE': Icons.build,
    'INSURANCE': Icons.shield,
    'TOLL': Icons.toll,
    'PARKING': Icons.local_parking,
    'FINE': Icons.gavel,
    'OTHER': Icons.receipt,
  };
  static const _colors = <String, Color>{
    'FUEL': Color(0xFFF59E0B),
    'SERVICE': AppColors.primary,
    'INSURANCE': AppColors.accent,
    'TOLL': Color(0xFF8B5CF6),
    'PARKING': Color(0xFF06B6D4),
    'FINE': AppColors.error,
    'OTHER': AppColors.textSecondary,
  };

  @override
  Widget build(BuildContext context) {
    final byCategory = (data['byCategory'] as List? ?? []).cast<Map<String, dynamic>>();
    if (byCategory.isEmpty) return const SizedBox.shrink();
    final total = byCategory.fold(0.0, (s, c) => s + ((c['amount'] as num?)?.toDouble() ?? 0));
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('By Category', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 16),
        ...byCategory.map((c) {
          final cat = c['category']?.toString() ?? 'OTHER';
          final amt = (c['amount'] as num?)?.toDouble() ?? 0;
          final pct = total > 0 ? amt / total : 0.0;
          final color = _colors[cat] ?? AppColors.textSecondary;
          return Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Column(children: [
              Row(children: [
                Icon(_icons[cat] ?? Icons.receipt, color: color, size: 18),
                const SizedBox(width: 8),
                Expanded(child: Text(cat, style: const TextStyle(fontFamily: 'Outfit', fontWeight: FontWeight.w600, fontSize: 14))),
                Text(fmt.format(amt), style: TextStyle(fontWeight: FontWeight.w700, color: color, fontFamily: 'Outfit')),
              ]),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: pct,
                  backgroundColor: color.withOpacity(0.1),
                  valueColor: AlwaysStoppedAnimation(color),
                  minHeight: 6,
                ),
              ),
            ]),
          );
        }),
      ]),
    );
  }
}

class _MonthlyTrend extends StatelessWidget {
  final Map<String, dynamic> data;
  const _MonthlyTrend({required this.data});

  @override
  Widget build(BuildContext context) {
    final monthly = (data['monthly'] as List? ?? []).cast<Map<String, dynamic>>();
    if (monthly.isEmpty) return const SizedBox.shrink();
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final maxAmt = monthly.fold<double>(1.0, (m, e) {
      final a = (e['amount'] as num?)?.toDouble() ?? 0.0;
      return a > m ? a : m;
    });
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Monthly Trend', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 16),
        ...monthly.map((m) {
          final amt = (m['amount'] as num?)?.toDouble() ?? 0;
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(children: [
              SizedBox(
                width: 70,
                child: Text(m['month']?.toString() ?? '-',
                    style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, fontFamily: 'Outfit')),
              ),
              Expanded(child: ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(
                  value: maxAmt > 0 ? amt / maxAmt : 0,
                  backgroundColor: AppColors.primary.withOpacity(0.08),
                  valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                  minHeight: 18,
                ),
              )),
              const SizedBox(width: 10),
              SizedBox(
                width: 70,
                child: Text(fmt.format(amt),
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, fontFamily: 'Outfit'),
                    textAlign: TextAlign.right),
              ),
            ]),
          );
        }),
      ]),
    );
  }
}

class _FallbackView extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.bar_chart_outlined, size: 80, color: AppColors.border),
      const SizedBox(height: 16),
      Text('Analytics unavailable', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 8),
      const Text('Add more expenses to see spending insights', style: TextStyle(color: AppColors.textSecondary)),
    ]),
  );
}
