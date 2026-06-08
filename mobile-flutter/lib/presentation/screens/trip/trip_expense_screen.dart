import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';
import 'package:intl/intl.dart';

final _plansProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final res = await createDioClient().get('/api/v1/trip-expense/plans');
  return (res.data['data'] as List).cast<Map<String, dynamic>>();
});

class TripExpenseScreen extends ConsumerWidget {
  const TripExpenseScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_plansProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Trip Planner')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showPlanSheet(context, ref),
        icon: const Icon(Icons.add_road),
        label: const Text('Plan Trip'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const Center(child: Text('Failed to load trip plans')),
        data: (plans) => plans.isEmpty
            ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.map_outlined, size: 80, color: AppColors.border),
                const SizedBox(height: 16),
                Text('No trips planned', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                const Text('Plan your next journey with toll & fuel estimates', textAlign: TextAlign.center, style: TextStyle(color: AppColors.textSecondary)),
              ]))
            : RefreshIndicator(
                onRefresh: () => ref.refresh(_plansProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                  itemCount: plans.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (_, i) => _PlanCard(plan: plans[i]),
                ),
              ),
      ),
    );
  }

  void _showPlanSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _NewPlanSheet(onCreated: () => ref.invalidate(_plansProvider)),
    );
  }
}

class _PlanCard extends StatelessWidget {
  final Map<String, dynamic> plan;
  const _PlanCard({required this.plan});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final total = (plan['estimatedCost'] as num?)?.toDouble() ?? 0;
    final fuel = (plan['fuelCost'] as num?)?.toDouble() ?? 0;
    final toll = (plan['tollCost'] as num?)?.toDouble() ?? 0;
    final dist = (plan['distanceKm'] as num?)?.toStringAsFixed(0) ?? '0';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.route, color: AppColors.primary, size: 22),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(plan['origin']?.toString() ?? 'Origin', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontSize: 14)),
            const Icon(Icons.arrow_downward, size: 14, color: AppColors.textSecondary),
            Text(plan['destination']?.toString() ?? 'Destination', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontSize: 14)),
          ])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(fmt.format(total), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, fontFamily: 'Outfit', color: AppColors.primary)),
            const Text('estimated', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
          ]),
        ]),
        const Divider(height: 20),
        Row(children: [
          _CostChip(label: 'Fuel', amount: fuel, color: AppColors.warning),
          const SizedBox(width: 8),
          _CostChip(label: 'Tolls', amount: toll, color: AppColors.accent),
          const Spacer(),
          Row(children: [
            const Icon(Icons.route, size: 14, color: AppColors.textSecondary),
            const SizedBox(width: 4),
            Text('$dist km', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, fontFamily: 'Outfit')),
          ]),
        ]),
      ]),
    );
  }
}

class _CostChip extends StatelessWidget {
  final String label;
  final double amount;
  final Color color;
  const _CostChip({required this.label, required this.amount, required this.color});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
      child: Row(children: [
        Text(label, style: TextStyle(fontSize: 12, color: color, fontFamily: 'Outfit')),
        const SizedBox(width: 4),
        Text(fmt.format(amount), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color, fontFamily: 'Outfit')),
      ]),
    );
  }
}

class _NewPlanSheet extends StatefulWidget {
  final VoidCallback onCreated;
  const _NewPlanSheet({required this.onCreated});

  @override
  State<_NewPlanSheet> createState() => _NewPlanSheetState();
}

class _NewPlanSheetState extends State<_NewPlanSheet> {
  final _originCtrl = TextEditingController();
  final _destCtrl = TextEditingController();
  bool _loading = false;
  Map<String, dynamic>? _estimate;

  @override
  void dispose() { _originCtrl.dispose(); _destCtrl.dispose(); super.dispose(); }

  Future<void> _estimate_() async {
    if (_originCtrl.text.isEmpty || _destCtrl.text.isEmpty) return;
    setState(() => _loading = true);
    try {
      final res = await createDioClient().get('/api/v1/trip-expense/toll-estimate', queryParameters: {
        'origin': _originCtrl.text.trim(),
        'destination': _destCtrl.text.trim(),
      });
      setState(() => _estimate = res.data['data'] as Map<String, dynamic>?);
    } catch (_) {} finally { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _plan() async {
    setState(() => _loading = true);
    try {
      await createDioClient().post('/api/v1/trip-expense/plan', data: {
        'origin': _originCtrl.text.trim(),
        'destination': _destCtrl.text.trim(),
      });
      widget.onCreated();
      if (mounted) Navigator.pop(context);
    } catch (_) { setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Plan a Trip', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 16),
        TextField(controller: _originCtrl, decoration: const InputDecoration(labelText: 'From (city/address)')),
        const SizedBox(height: 12),
        TextField(controller: _destCtrl, decoration: const InputDecoration(labelText: 'To (city/address)')),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: _loading ? null : _estimate_,
          icon: const Icon(Icons.calculate_outlined),
          label: const Text('Get Estimate'),
          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
        ),
        if (_estimate != null) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.06), borderRadius: BorderRadius.circular(12)),
            child: Column(children: [
              _EstRow('Distance', '${_estimate!['distanceKm']?.toString() ?? '-'} km'),
              _EstRow('Fuel Cost', fmt.format((_estimate!['fuelCost'] as num?)?.toDouble() ?? 0)),
              _EstRow('Toll Cost', fmt.format((_estimate!['tollCost'] as num?)?.toDouble() ?? 0)),
              const Divider(),
              _EstRow('Total', fmt.format((_estimate!['totalCost'] as num?)?.toDouble() ?? 0), bold: true),
            ]),
          ),
          const SizedBox(height: 12),
          ElevatedButton(onPressed: _loading ? null : _plan, child: const Text('Save Trip Plan')),
        ],
      ]),
    );
  }
}

class _EstRow extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;
  const _EstRow(this.label, this.value, {this.bold = false});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(children: [
      Text(label, style: TextStyle(color: AppColors.textSecondary, fontSize: 13, fontFamily: 'Outfit', fontWeight: bold ? FontWeight.w700 : FontWeight.w400)),
      const Spacer(),
      Text(value, style: TextStyle(fontSize: 13, fontFamily: 'Outfit', fontWeight: bold ? FontWeight.w800 : FontWeight.w600)),
    ]),
  );
}
