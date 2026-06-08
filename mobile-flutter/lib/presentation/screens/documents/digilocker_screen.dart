import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';

class DigiLockerScreen extends ConsumerStatefulWidget {
  const DigiLockerScreen({super.key});

  @override
  ConsumerState<DigiLockerScreen> createState() => _DigiLockerScreenState();
}

class _DigiLockerScreenState extends ConsumerState<DigiLockerScreen> {
  bool _connecting = false;
  bool _connected = false;
  String? _syncStatus;

  Future<void> _connect() async {
    setState(() => _connecting = true);
    try {
      final res = await createDioClient().get('/api/v1/documents/digilocker/connect');
      final url = res.data['data']?['authUrl']?.toString();
      if (url != null && mounted) {
        // In production, launch URL with url_launcher
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Auth URL: $url'), action: SnackBarAction(label: 'Open', onPressed: () {})),
        );
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to connect to DigiLocker')));
    } finally {
      if (mounted) setState(() => _connecting = false);
    }
  }

  Future<void> _sync() async {
    setState(() => _syncStatus = 'Syncing...');
    try {
      await createDioClient().post('/api/v1/documents/digilocker/sync');
      setState(() => _syncStatus = 'Sync complete!');
    } catch (_) {
      setState(() => _syncStatus = 'Sync failed. Please try again.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('DigiLocker KYC')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF1E40AF), Color(0xFF3B82F6)]),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(children: [
                const Icon(Icons.account_balance_wallet, color: Colors.white, size: 40),
                const SizedBox(width: 16),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('DigiLocker', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800, fontFamily: 'Outfit')),
                  const Text('Government of India', style: TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Outfit')),
                ])),
              ]),
            ),
            const SizedBox(height: 24),
            Text('What is DigiLocker?', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            const Text(
              'DigiLocker is a Government of India initiative to provide citizens digital access to their official documents. Connect your DigiLocker to automatically import your driving licence, vehicle RC, and insurance documents.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 14, height: 1.5),
            ),
            const SizedBox(height: 24),
            ...[
              ('Driving Licence', Icons.credit_card),
              ('Vehicle Registration Certificate', Icons.directions_car),
              ('Insurance Policy', Icons.shield),
              ('Pollution Certificate (PUC)', Icons.eco),
            ].map((item) => _BenefitRow(icon: item.$2, text: item.$1)),
            const SizedBox(height: 32),
            if (_syncStatus != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.accent.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(children: [
                  const Icon(Icons.info_outline, color: AppColors.accent, size: 18),
                  const SizedBox(width: 8),
                  Text(_syncStatus!, style: const TextStyle(color: AppColors.accent, fontWeight: FontWeight.w600)),
                ]),
              ),
              const SizedBox(height: 16),
            ],
            ElevatedButton.icon(
              onPressed: _connecting ? null : _connect,
              icon: _connecting
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.link),
              label: Text(_connected ? 'Connected' : 'Connect DigiLocker'),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _sync,
              icon: const Icon(Icons.sync),
              label: const Text('Sync Documents'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BenefitRow extends StatelessWidget {
  final IconData icon;
  final String text;
  const _BenefitRow({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(children: [
      Container(
        width: 36, height: 36,
        decoration: BoxDecoration(color: AppColors.primary.withOpacity(0.08), borderRadius: BorderRadius.circular(8)),
        child: Icon(icon, color: AppColors.primary, size: 18),
      ),
      const SizedBox(width: 12),
      Expanded(child: Text(text, style: const TextStyle(fontSize: 14, fontFamily: 'Outfit', fontWeight: FontWeight.w500))),
      const Icon(Icons.check_circle, color: AppColors.accent, size: 18),
    ]),
  );
}
