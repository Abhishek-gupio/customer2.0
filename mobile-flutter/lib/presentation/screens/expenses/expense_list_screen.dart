import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/router/app_router.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';
import 'package:intl/intl.dart';

final _expensesProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final dio = createDioClient();
  final res = await dio.get('/api/v1/expenses');
  return (res.data['data'] as List).cast<Map<String, dynamic>>();
});

class ExpenseListScreen extends ConsumerWidget {
  const ExpenseListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final expensesAsync = ref.watch(_expensesProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Expenses'),
        actions: [
          IconButton(icon: const Icon(Icons.bar_chart), onPressed: () => context.push(AppRoutes.expenseAnalytics)),
          IconButton(icon: const Icon(Icons.add), onPressed: () => context.push(AppRoutes.addExpense)),
        ],
      ),
      body: expensesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Failed to load expenses')),
        data: (expenses) => expenses.isEmpty
            ? _Empty()
            : RefreshIndicator(
                onRefresh: () => ref.refresh(_expensesProvider.future),
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _SummaryCard(expenses: expenses),
                    const SizedBox(height: 16),
                    ...expenses.map((e) => _ExpenseCard(expense: e)),
                    const SizedBox(height: 80),
                  ],
                ),
              ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(AppRoutes.addExpense),
        icon: const Icon(Icons.add),
        label: const Text('Add'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final List<Map<String, dynamic>> expenses;
  const _SummaryCard({required this.expenses});

  @override
  Widget build(BuildContext context) {
    final total = expenses.fold(0.0, (sum, e) => sum + ((e['amount'] as num?)?.toDouble() ?? 0));
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [AppColors.primary, AppColors.primaryDark]),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Total Spent', style: TextStyle(color: Colors.white70, fontSize: 13, fontFamily: 'Outfit')),
        const SizedBox(height: 4),
        Text(fmt.format(total), style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w700, fontFamily: 'Outfit')),
        const SizedBox(height: 12),
        Text('${expenses.length} transactions', style: const TextStyle(color: Colors.white60, fontSize: 13, fontFamily: 'Outfit')),
      ]),
    );
  }
}

class _ExpenseCard extends StatelessWidget {
  final Map<String, dynamic> expense;
  const _ExpenseCard({required this.expense});

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
    final category = expense['category']?.toString() ?? 'OTHER';
    final icon = _icons[category] ?? Icons.receipt;
    final color = _colors[category] ?? AppColors.textSecondary;
    final amount = (expense['amount'] as num?)?.toDouble() ?? 0;
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final date = expense['date'] != null ? DateFormat('d MMM yyyy').format(DateTime.parse(expense['date'])) : '';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
      child: Row(children: [
        Container(
          width: 44, height: 44,
          decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: color, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(expense['merchantName']?.toString() ?? category, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontSize: 15)),
          Text(date, style: Theme.of(context).textTheme.bodyMedium),
        ])),
        Text(fmt.format(amount), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary, fontFamily: 'Outfit')),
      ]),
    );
  }
}

class _Empty extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
    const Icon(Icons.receipt_long_outlined, size: 80, color: AppColors.border),
    const SizedBox(height: 16),
    Text('No expenses yet', style: Theme.of(context).textTheme.titleLarge),
    const SizedBox(height: 8),
    Text('Track your vehicle spending', style: Theme.of(context).textTheme.bodyMedium),
  ]));
}
