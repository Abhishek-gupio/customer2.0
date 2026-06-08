import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';

final _budgetsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final res = await createDioClient().get('/api/v1/expenses/budgets');
  return (res.data['data'] as List).cast<Map<String, dynamic>>();
});

class BudgetSettingsScreen extends ConsumerWidget {
  const BudgetSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_budgetsProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Budget Settings')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showBudgetSheet(context, null, ref),
        icon: const Icon(Icons.add),
        label: const Text('Set Budget'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const Center(child: Text('Failed to load budgets')),
        data: (budgets) => budgets.isEmpty
            ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.savings_outlined, size: 80, color: AppColors.border),
                const SizedBox(height: 16),
                Text('No budgets set', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                const Text('Set monthly limits per expense category', style: TextStyle(color: AppColors.textSecondary)),
              ]))
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                itemCount: budgets.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (_, i) => _BudgetCard(
                  budget: budgets[i],
                  onEdit: () => _showBudgetSheet(context, budgets[i], ref),
                ),
              ),
      ),
    );
  }

  void _showBudgetSheet(BuildContext context, Map<String, dynamic>? existing, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _BudgetSheet(existing: existing, onSaved: () => ref.invalidate(_budgetsProvider)),
    );
  }
}

class _BudgetCard extends StatelessWidget {
  final Map<String, dynamic> budget;
  final VoidCallback onEdit;
  const _BudgetCard({required this.budget, required this.onEdit});

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
    final cat = budget['category']?.toString() ?? 'OTHER';
    final limit = (budget['monthlyLimit'] as num?)?.toDouble() ?? 0;
    final spent = (budget['currentSpend'] as num?)?.toDouble() ?? 0;
    final pct = limit > 0 ? (spent / limit).clamp(0.0, 1.0) : 0.0;
    final color = _colors[cat] ?? AppColors.primary;
    final barColor = pct >= 0.9 ? AppColors.error : pct >= 0.7 ? AppColors.warning : color;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
            child: Icon(Icons.category, color: color, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(cat, style: Theme.of(context).textTheme.titleMedium)),
          IconButton(onPressed: onEdit, icon: const Icon(Icons.edit_outlined, size: 18), color: AppColors.textSecondary),
        ]),
        const SizedBox(height: 10),
        Row(children: [
          Text('₹${spent.toStringAsFixed(0)} / ₹${limit.toStringAsFixed(0)}',
              style: const TextStyle(fontSize: 13, fontFamily: 'Outfit')),
          const Spacer(),
          Text('${(pct * 100).toStringAsFixed(0)}%',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: barColor, fontFamily: 'Outfit')),
        ]),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(
            value: pct,
            backgroundColor: color.withOpacity(0.1),
            valueColor: AlwaysStoppedAnimation(barColor),
            minHeight: 8,
          ),
        ),
      ]),
    );
  }
}

class _BudgetSheet extends StatefulWidget {
  final Map<String, dynamic>? existing;
  final VoidCallback onSaved;
  const _BudgetSheet({this.existing, required this.onSaved});

  @override
  State<_BudgetSheet> createState() => _BudgetSheetState();
}

class _BudgetSheetState extends State<_BudgetSheet> {
  final _amtCtrl = TextEditingController();
  String _category = 'FUEL';
  bool _loading = false;

  static const _categories = ['FUEL', 'SERVICE', 'INSURANCE', 'TOLL', 'PARKING', 'FINE', 'OTHER'];

  @override
  void initState() {
    super.initState();
    if (widget.existing != null) {
      _category = widget.existing!['category']?.toString() ?? 'FUEL';
      _amtCtrl.text = widget.existing!['monthlyLimit']?.toString() ?? '';
    }
  }

  @override
  void dispose() { _amtCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
    child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(widget.existing != null ? 'Edit Budget' : 'Set Budget', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 16),
      DropdownButtonFormField<String>(
        value: _category,
        decoration: const InputDecoration(labelText: 'Category'),
        items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
        onChanged: (v) => setState(() => _category = v!),
      ),
      const SizedBox(height: 12),
      TextField(
        controller: _amtCtrl,
        decoration: const InputDecoration(labelText: 'Monthly Limit (₹)', prefixText: '₹'),
        keyboardType: TextInputType.number,
      ),
      const SizedBox(height: 20),
      ElevatedButton(
        onPressed: _loading ? null : () async {
          final limit = double.tryParse(_amtCtrl.text);
          if (limit == null || limit <= 0) return;
          setState(() => _loading = true);
          try {
            await createDioClient().post('/api/v1/expenses/budgets', data: {'category': _category, 'monthlyLimit': limit});
            widget.onSaved();
            if (mounted) Navigator.pop(context);
          } catch (_) { setState(() => _loading = false); }
        },
        child: _loading ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Save Budget'),
      ),
    ]),
  );
}
