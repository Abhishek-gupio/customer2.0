import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';
import 'package:intl/intl.dart';

final _dlProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  try {
    final res = await createDioClient().get('/api/v1/documents/get-dl');
    return res.data['data'] as Map<String, dynamic>?;
  } catch (_) {
    return null;
  }
});

class DlVerificationScreen extends ConsumerWidget {
  const DlVerificationScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_dlProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Driving Licence')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => _UploadView(onUploaded: () => ref.invalidate(_dlProvider)),
        data: (dl) => dl == null
            ? _UploadView(onUploaded: () => ref.invalidate(_dlProvider))
            : _DlView(dl: dl, onRefresh: () => ref.invalidate(_dlProvider)),
      ),
    );
  }
}

class _DlView extends StatelessWidget {
  final Map<String, dynamic> dl;
  final VoidCallback onRefresh;
  const _DlView({required this.dl, required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    final isVerified = dl['isVerified'] == true;
    final expiry = dl['expiryDate'] != null
        ? DateFormat('d MMM yyyy').format(DateTime.parse(dl['expiryDate']))
        : null;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: isVerified
                  ? [const Color(0xFF064E3B), const Color(0xFF059669)]
                  : [const Color(0xFF7C2D12), const Color(0xFFEA580C)],
            ),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Icon(Icons.credit_card, color: Colors.white, size: 32),
              const SizedBox(width: 12),
              Expanded(child: Text('Driving Licence', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700, fontFamily: 'Outfit'))),
              Icon(isVerified ? Icons.verified : Icons.pending_outlined, color: Colors.white70),
            ]),
            const SizedBox(height: 16),
            _DlField('DL Number', dl['dlNumber']?.toString() ?? '-'),
            _DlField('Name', dl['name']?.toString() ?? '-'),
            _DlField('DOB', dl['dob']?.toString() ?? '-'),
            if (expiry != null) _DlField('Expiry', expiry),
            _DlField('Status', isVerified ? 'Verified ✓' : 'Pending Verification'),
          ]),
        ),
        const SizedBox(height: 20),
        OutlinedButton.icon(
          onPressed: () async {
            try {
              await createDioClient().post('/api/v1/documents/verify-dl', data: {'dlNumber': dl['dlNumber']});
              onRefresh();
            } catch (_) {}
          },
          icon: const Icon(Icons.refresh),
          label: const Text('Re-verify'),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ]),
    );
  }
}

class _DlField extends StatelessWidget {
  final String label;
  final String value;
  const _DlField(this.label, this.value);

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(children: [
      SizedBox(width: 90, child: Text(label, style: const TextStyle(color: Colors.white60, fontSize: 12, fontFamily: 'Outfit'))),
      Expanded(child: Text(value, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600, fontFamily: 'Outfit'))),
    ]),
  );
}

class _UploadView extends StatefulWidget {
  final VoidCallback onUploaded;
  const _UploadView({required this.onUploaded});

  @override
  State<_UploadView> createState() => _UploadViewState();
}

class _UploadViewState extends State<_UploadView> {
  final _dlCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  bool _loading = false;

  @override
  void dispose() { _dlCtrl.dispose(); _nameCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    padding: const EdgeInsets.all(24),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Icon(Icons.credit_card_outlined, size: 60, color: AppColors.primary),
      const SizedBox(height: 16),
      Text('Add Driving Licence', style: Theme.of(context).textTheme.headlineMedium),
      const SizedBox(height: 8),
      const Text('Enter your DL number to verify your driving licence.', style: TextStyle(color: AppColors.textSecondary)),
      const SizedBox(height: 32),
      TextField(controller: _dlCtrl, decoration: const InputDecoration(labelText: 'DL Number'), textCapitalization: TextCapitalization.characters),
      const SizedBox(height: 16),
      TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'Name as on DL'), textCapitalization: TextCapitalization.words),
      const SizedBox(height: 24),
      ElevatedButton(
        onPressed: _loading ? null : () async {
          if (_dlCtrl.text.trim().isEmpty) return;
          setState(() => _loading = true);
          try {
            await createDioClient().post('/api/v1/documents/verify-dl', data: {
              'dlNumber': _dlCtrl.text.trim(),
              'name': _nameCtrl.text.trim(),
            });
            widget.onUploaded();
          } catch (_) {} finally { if (mounted) setState(() => _loading = false); }
        },
        child: _loading
            ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : const Text('Verify DL'),
      ),
    ]),
  );
}
