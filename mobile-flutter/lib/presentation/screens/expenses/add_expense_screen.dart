import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/providers/vehicle_provider.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';

class AddExpenseScreen extends ConsumerStatefulWidget {
  const AddExpenseScreen({super.key});

  @override
  ConsumerState<AddExpenseScreen> createState() => _State();
}

class _State extends ConsumerState<AddExpenseScreen> {
  final _amountCtrl = TextEditingController();
  final _merchantCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  String _category = 'FUEL';
  String? _vehicleId;
  bool _loading = false;
  String _error = '';

  static const _categories = ['FUEL', 'SERVICE', 'INSURANCE', 'TOLL', 'PARKING', 'FINE', 'OTHER'];

  @override
  void dispose() {
    _amountCtrl.dispose(); _merchantCtrl.dispose(); _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = ''; });
    try {
      final dio = createDioClient();
      await dio.post('/api/v1/expenses', data: {
        'amount': double.parse(_amountCtrl.text.trim()),
        'category': _category,
        'merchantName': _merchantCtrl.text.trim().isEmpty ? null : _merchantCtrl.text.trim(),
        'notes': _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
        'vehicleId': _vehicleId,
        'date': DateTime.now().toIso8601String(),
      });
      if (mounted) context.pop();
    } catch (e) {
      setState(() => _error = 'Failed to add expense');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final vehicles = ref.watch(vehicleProvider).vehicles;
    return Scaffold(
      appBar: AppBar(title: const Text('Add Expense')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Category', style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 8),
            Wrap(spacing: 8, children: _categories.map((c) => ChoiceChip(
              label: Text(c),
              selected: _category == c,
              onSelected: (_) => setState(() => _category = c),
              selectedColor: AppColors.primary.withOpacity(0.15),
              labelStyle: TextStyle(color: _category == c ? AppColors.primary : AppColors.textSecondary, fontWeight: FontWeight.w600),
            )).toList()),
            const SizedBox(height: 16),
            Text('Amount (₹)', style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 6),
            TextFormField(
              controller: _amountCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))],
              decoration: const InputDecoration(hintText: '0.00', prefixText: '₹  '),
              validator: (v) {
                final n = double.tryParse(v ?? '');
                return n == null || n <= 0 ? 'Enter a valid amount' : null;
              },
            ),
            const SizedBox(height: 12),
            Text('Merchant / Station', style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 6),
            TextFormField(controller: _merchantCtrl, decoration: const InputDecoration(hintText: 'Optional')),
            const SizedBox(height: 12),
            if (vehicles.isNotEmpty) ...[
              Text('Vehicle', style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                value: _vehicleId,
                hint: const Text('Select vehicle (optional)'),
                decoration: InputDecoration(border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border))),
                items: vehicles.map((v) => DropdownMenuItem(value: v['id']?.toString(), child: Text(v['registrationNumber']?.toString() ?? ''))).toList(),
                onChanged: (v) => setState(() => _vehicleId = v),
              ),
              const SizedBox(height: 12),
            ],
            Text('Notes', style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 6),
            TextFormField(controller: _notesCtrl, maxLines: 3, decoration: const InputDecoration(hintText: 'Optional notes')),
            const SizedBox(height: 24),
            if (_error.isNotEmpty) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_error, style: const TextStyle(color: AppColors.error))),
            ElevatedButton(
              onPressed: _loading ? null : _submit,
              child: _loading ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Add Expense'),
            ),
          ]),
        ),
      ),
    );
  }
}
