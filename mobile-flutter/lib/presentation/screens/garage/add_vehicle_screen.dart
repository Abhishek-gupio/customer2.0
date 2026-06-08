import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gupio_customer/presentation/providers/vehicle_provider.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';

class AddVehicleScreen extends ConsumerStatefulWidget {
  const AddVehicleScreen({super.key});

  @override
  ConsumerState<AddVehicleScreen> createState() => _AddVehicleScreenState();
}

class _AddVehicleScreenState extends ConsumerState<AddVehicleScreen> {
  final _regCtrl = TextEditingController();
  final _brandCtrl = TextEditingController();
  final _modelCtrl = TextEditingController();
  final _yearCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  String _fuelType = 'PETROL';
  String _error = '';

  @override
  void dispose() {
    _regCtrl.dispose(); _brandCtrl.dispose(); _modelCtrl.dispose(); _yearCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _error = '');
    final reg = _regCtrl.text.trim().toUpperCase();
    final v = await ref.read(vehicleProvider.notifier).addVehicle({
      'registrationNumber': reg,
      'brand': _brandCtrl.text.trim(),
      'model': _modelCtrl.text.trim(),
      'year': int.tryParse(_yearCtrl.text.trim()),
      'fuelType': _fuelType,
    });
    if (v != null && mounted) context.pop();
    else setState(() => _error = ref.read(vehicleProvider).error ?? 'Failed to add vehicle');
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(vehicleProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Add Vehicle')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Vehicle Details', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 20),
            _Field('Registration Number', _regCtrl, hint: 'MH01AB1234',
              validator: (v) => (v?.length ?? 0) < 6 ? 'Enter valid registration number' : null,
              textCapitalization: TextCapitalization.characters),
            const SizedBox(height: 12),
            _Field('Brand', _brandCtrl, hint: 'Maruti, Honda, Tata...'),
            const SizedBox(height: 12),
            _Field('Model', _modelCtrl, hint: 'Swift, City, Nexon...'),
            const SizedBox(height: 12),
            _Field('Year', _yearCtrl, hint: '2022', keyboardType: TextInputType.number),
            const SizedBox(height: 16),
            Text('Fuel Type', style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 8),
            Wrap(spacing: 8, children: ['PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID'].map((ft) =>
              ChoiceChip(
                label: Text(ft),
                selected: _fuelType == ft,
                onSelected: (_) => setState(() => _fuelType = ft),
                selectedColor: AppColors.primary.withOpacity(0.15),
                labelStyle: TextStyle(color: _fuelType == ft ? AppColors.primary : AppColors.textSecondary, fontWeight: FontWeight.w600),
              )).toList()),
            const SizedBox(height: 24),
            if (_error.isNotEmpty) Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error, style: const TextStyle(color: AppColors.error)),
            ),
            ElevatedButton(
              onPressed: state.isLoading ? null : _submit,
              child: state.isLoading
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Add Vehicle'),
            ),
          ]),
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  final String label, hint;
  final TextEditingController ctrl;
  final TextInputType? keyboardType;
  final String? Function(String?)? validator;
  final TextCapitalization textCapitalization;
  const _Field(this.label, this.ctrl, {this.hint = '', this.keyboardType, this.validator, this.textCapitalization = TextCapitalization.words});

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(label, style: Theme.of(context).textTheme.labelLarge),
    const SizedBox(height: 6),
    TextFormField(
      controller: ctrl,
      keyboardType: keyboardType,
      textCapitalization: textCapitalization,
      decoration: InputDecoration(hintText: hint),
      validator: validator ?? (v) => (v?.trim().isEmpty ?? true) ? 'Required' : null,
    ),
  ]);
}
