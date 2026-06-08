import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';
import 'package:intl/intl.dart';

final _servicesProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final res = await createDioClient().get('/api/v1/services');
  return (res.data['data'] as List).cast<Map<String, dynamic>>();
});

class ServiceHistoryScreen extends ConsumerWidget {
  const ServiceHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_servicesProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Service History')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddServiceSheet(context, ref),
        icon: const Icon(Icons.add),
        label: const Text('Log Service'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const Center(child: Text('Failed to load service records')),
        data: (records) => records.isEmpty
            ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.build_outlined, size: 80, color: AppColors.border),
                const SizedBox(height: 16),
                Text('No service records', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                const Text('Log your first service to track history', style: TextStyle(color: AppColors.textSecondary)),
              ]))
            : RefreshIndicator(
                onRefresh: () => ref.refresh(_servicesProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                  itemCount: records.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => _ServiceCard(record: records[i]),
                ),
              ),
      ),
    );
  }

  void _showAddServiceSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _AddServiceSheet(onSaved: () => ref.invalidate(_servicesProvider)),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  final Map<String, dynamic> record;
  const _ServiceCard({required this.record});

  @override
  Widget build(BuildContext context) {
    final cost = (record['cost'] as num?)?.toDouble() ?? 0;
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final date = record['serviceDate'] != null
        ? DateFormat('d MMM yyyy').format(DateTime.parse(record['serviceDate']))
        : '';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              color: AppColors.accent.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.build, color: AppColors.accent, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(record['serviceType']?.toString().replaceAll('_', ' ') ?? 'Service',
                style: Theme.of(context).textTheme.titleMedium),
            Text(date, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
          ])),
          Text(fmt.format(cost), style: const TextStyle(
            fontSize: 16, fontWeight: FontWeight.w700, fontFamily: 'Outfit', color: AppColors.textPrimary,
          )),
        ]),
        if (record['notes'] != null) ...[
          const SizedBox(height: 8),
          const Divider(),
          Text(record['notes'].toString(), style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
        ],
        if (record['odometerAtService'] != null) ...[
          const SizedBox(height: 6),
          Row(children: [
            const Icon(Icons.speed, size: 14, color: AppColors.textSecondary),
            const SizedBox(width: 4),
            Text('${record['odometerAtService']} km at service',
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ]),
        ],
      ]),
    );
  }
}

class _AddServiceSheet extends StatefulWidget {
  final VoidCallback onSaved;
  const _AddServiceSheet({required this.onSaved});

  @override
  State<_AddServiceSheet> createState() => _AddServiceSheetState();
}

class _AddServiceSheetState extends State<_AddServiceSheet> {
  final _notesCtrl = TextEditingController();
  final _costCtrl = TextEditingController();
  String _type = 'OIL_CHANGE';
  bool _loading = false;

  static const _types = ['OIL_CHANGE', 'TYRE_ROTATION', 'BRAKE_SERVICE', 'FULL_SERVICE', 'BATTERY', 'AC_SERVICE', 'OTHER'];

  @override
  void dispose() { _notesCtrl.dispose(); _costCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Log Service', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 16),
        DropdownButtonFormField<String>(
          value: _type,
          decoration: const InputDecoration(labelText: 'Service Type'),
          items: _types.map((t) => DropdownMenuItem(value: t, child: Text(t.replaceAll('_', ' ')))).toList(),
          onChanged: (v) => setState(() => _type = v!),
        ),
        const SizedBox(height: 12),
        TextField(controller: _costCtrl, decoration: const InputDecoration(labelText: 'Cost (₹)'), keyboardType: TextInputType.number),
        const SizedBox(height: 12),
        TextField(controller: _notesCtrl, decoration: const InputDecoration(labelText: 'Notes (optional)'), maxLines: 2),
        const SizedBox(height: 20),
        ElevatedButton(
          onPressed: _loading ? null : () async {
            setState(() => _loading = true);
            try {
              await createDioClient().post('/api/v1/services', data: {
                'serviceType': _type,
                'cost': double.tryParse(_costCtrl.text) ?? 0,
                'notes': _notesCtrl.text.trim(),
                'serviceDate': DateTime.now().toIso8601String(),
              });
              widget.onSaved();
              if (mounted) Navigator.pop(context);
            } catch (_) {
              setState(() => _loading = false);
            }
          },
          child: _loading
              ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Save Service Record'),
        ),
      ]),
    );
  }
}
