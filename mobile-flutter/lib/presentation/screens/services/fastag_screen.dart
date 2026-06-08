import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';
import 'package:intl/intl.dart';

final _fastagProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  try {
    final res = await createDioClient().get('/api/v1/documents/get-fastag');
    return res.data['data'] as Map<String, dynamic>?;
  } catch (_) {
    return null;
  }
});

class FastagScreen extends ConsumerWidget {
  const FastagScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_fastagProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('FASTag')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => _LinkView(onLinked: () => ref.invalidate(_fastagProvider)),
        data: (tag) => tag == null
            ? _LinkView(onLinked: () => ref.invalidate(_fastagProvider))
            : _TagView(tag: tag),
      ),
    );
  }
}

class _TagView extends StatelessWidget {
  final Map<String, dynamic> tag;
  const _TagView({required this.tag});

  @override
  Widget build(BuildContext context) {
    final balance = (tag['walletBalance'] as num?)?.toDouble() ?? 0;
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [Color(0xFF0369A1), Color(0xFF0EA5E9)]),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Icon(Icons.speed, color: Colors.white, size: 32),
              const Spacer(),
              const Text('FASTag', style: TextStyle(color: Colors.white70, fontSize: 13, fontFamily: 'Outfit')),
            ]),
            const SizedBox(height: 20),
            const Text('Balance', style: TextStyle(color: Colors.white60, fontSize: 13, fontFamily: 'Outfit')),
            Text(fmt.format(balance), style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w800, fontFamily: 'Outfit')),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(color: Colors.white.withOpacity(0.15), borderRadius: BorderRadius.circular(8)),
              child: Text(tag['tagId']?.toString() ?? '-', style: const TextStyle(color: Colors.white, fontFamily: 'Outfit', fontWeight: FontWeight.w600)),
            ),
          ]),
        ),
        const SizedBox(height: 16),
        _InfoTile(icon: Icons.account_balance, label: 'Bank', value: tag['issuingBank']?.toString() ?? '-'),
        _InfoTile(icon: Icons.credit_card, label: 'Vehicle No.', value: tag['vehicleNumber']?.toString() ?? '-'),
        _InfoTile(icon: Icons.circle, label: 'Status', value: tag['status']?.toString() ?? 'ACTIVE'),
        const SizedBox(height: 20),
        ElevatedButton.icon(
          onPressed: () {},
          icon: const Icon(Icons.add),
          label: const Text('Recharge FASTag'),
        ),
      ]),
    );
  }
}

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoTile({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 8),
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
    child: Row(children: [
      Icon(icon, color: AppColors.primary, size: 20),
      const SizedBox(width: 12),
      Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 14, fontFamily: 'Outfit')),
      const Spacer(),
      Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, fontFamily: 'Outfit')),
    ]),
  );
}

class _LinkView extends StatefulWidget {
  final VoidCallback onLinked;
  const _LinkView({required this.onLinked});

  @override
  State<_LinkView> createState() => _LinkViewState();
}

class _LinkViewState extends State<_LinkView> {
  final _ctrl = TextEditingController();
  bool _loading = false;

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(24),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Icon(Icons.speed, size: 60, color: AppColors.primary),
      const SizedBox(height: 16),
      Text('Link FASTag', style: Theme.of(context).textTheme.headlineMedium),
      const SizedBox(height: 8),
      const Text('Enter your FASTag ID to link and track your toll payments.', style: TextStyle(color: AppColors.textSecondary)),
      const SizedBox(height: 32),
      TextField(controller: _ctrl, decoration: const InputDecoration(labelText: 'FASTag ID / Vehicle Number'), textCapitalization: TextCapitalization.characters),
      const SizedBox(height: 24),
      ElevatedButton(
        onPressed: _loading ? null : () async {
          if (_ctrl.text.trim().isEmpty) return;
          setState(() => _loading = true);
          try {
            await createDioClient().post('/api/v1/documents/verify-fastag', data: {'vehicleNumber': _ctrl.text.trim()});
            widget.onLinked();
          } catch (_) {} finally { if (mounted) setState(() => _loading = false); }
        },
        child: _loading ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Link FASTag'),
      ),
    ]),
  );
}
