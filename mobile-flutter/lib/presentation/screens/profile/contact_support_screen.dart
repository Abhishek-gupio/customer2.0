import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/providers/vehicle_provider.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';

class ContactSupportScreen extends ConsumerStatefulWidget {
  const ContactSupportScreen({super.key});

  @override
  ConsumerState<ContactSupportScreen> createState() => _ContactSupportScreenState();
}

class _ContactSupportScreenState extends ConsumerState<ContactSupportScreen> {
  final _subjectCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String _category = 'GENERAL';
  String? _vehicleId;
  bool _loading = false;
  bool _submitted = false;

  static const _categories = ['GENERAL', 'VEHICLE', 'EXPENSE', 'DOCUMENT', 'TECHNICAL', 'BILLING'];

  @override
  void dispose() { _subjectCtrl.dispose(); _descCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    if (_submitted) return _SuccessView();
    final vehicles = ref.watch(vehicleProvider).vehicles;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Contact Support')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text(
            'Describe your issue below and our support team will get back to you within 24 hours.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 14, height: 1.5),
          ),
          const SizedBox(height: 24),
          DropdownButtonFormField<String>(
            value: _category,
            decoration: const InputDecoration(labelText: 'Category'),
            items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
            onChanged: (v) => setState(() => _category = v!),
          ),
          if (vehicles.isNotEmpty) ...[
            const SizedBox(height: 12),
            DropdownButtonFormField<String?>(
              value: _vehicleId,
              decoration: const InputDecoration(labelText: 'Related Vehicle (optional)'),
              items: [
                const DropdownMenuItem(value: null, child: Text('None')),
                ...vehicles.map((v) => DropdownMenuItem(
                  value: v['id']?.toString(),
                  child: Text('${v['registrationNumber'] ?? v['id']}'),
                )),
              ],
              onChanged: (v) => setState(() => _vehicleId = v),
            ),
          ],
          const SizedBox(height: 12),
          TextField(controller: _subjectCtrl, decoration: const InputDecoration(labelText: 'Subject')),
          const SizedBox(height: 12),
          TextField(
            controller: _descCtrl,
            decoration: const InputDecoration(
              labelText: 'Description',
              hintText: 'Please describe your issue in detail...',
              alignLabelWithHint: true,
            ),
            maxLines: 5,
            minLines: 4,
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _loading ? null : _submit,
            child: _loading
                ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Submit Ticket'),
          ),
          const SizedBox(height: 20),
          _ContactOptions(),
        ]),
      ),
    );
  }

  Future<void> _submit() async {
    if (_subjectCtrl.text.trim().isEmpty || _descCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please fill all required fields')));
      return;
    }
    setState(() => _loading = true);
    try {
      await createDioClient().post('/api/v1/support/tickets', data: {
        'subject': _subjectCtrl.text.trim(),
        'description': _descCtrl.text.trim(),
        'category': _category,
        if (_vehicleId != null) 'vehicleId': _vehicleId,
      });
      setState(() => _submitted = true);
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to submit ticket. Try again.')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }
}

class _ContactOptions extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    const Text('Other ways to reach us', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, fontFamily: 'Outfit')),
    const SizedBox(height: 12),
    Row(children: [
      _ContactBtn(Icons.email_outlined, 'Email', 'support@gupio.tech'),
      const SizedBox(width: 12),
      _ContactBtn(Icons.chat_outlined, 'WhatsApp', '+91 99999 00000'),
    ]),
  ]);
}

class _ContactBtn extends StatelessWidget {
  final IconData icon;
  final String label;
  final String sub;
  const _ContactBtn(this.icon, this.label, this.sub);

  @override
  Widget build(BuildContext context) => Expanded(child: Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
    child: Row(children: [
      Icon(icon, color: AppColors.primary, size: 20),
      const SizedBox(width: 8),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, fontFamily: 'Outfit')),
        Text(sub, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis),
      ])),
    ]),
  ));
}

class _SuccessView extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.background,
    appBar: AppBar(title: const Text('Contact Support')),
    body: Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 80, height: 80,
          decoration: const BoxDecoration(color: AppColors.accent, shape: BoxShape.circle),
          child: const Icon(Icons.check, color: Colors.white, size: 40),
        ),
        const SizedBox(height: 24),
        Text('Ticket Submitted!', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 8),
        const Text('Our team will respond within 24 hours.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 15), textAlign: TextAlign.center),
        const SizedBox(height: 32),
        ElevatedButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Done'),
        ),
      ]),
    ),
  );
}
