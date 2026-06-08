import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/router/app_router.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';

class HelpSupportScreen extends ConsumerWidget {
  const HelpSupportScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: const Text('Help & Support')),
    body: ListView(padding: const EdgeInsets.all(16), children: [
      _Card(Icons.chat_bubble_outline, 'Live Chat', 'Talk to our support team', AppColors.primary, () => context.push(AppRoutes.contactSupport)),
      const SizedBox(height: 10),
      _Card(Icons.receipt_long_outlined, 'My Tickets', 'Track your support requests', AppColors.accent, () => context.push(AppRoutes.tickets)),
      const SizedBox(height: 24),
      Text('FAQs', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 12),
      _FaqList(),
    ]),
  );
}

class _Card extends StatelessWidget {
  final IconData icon; final String title, subtitle; final Color color; final VoidCallback onTap;
  const _Card(this.icon, this.title, this.subtitle, this.color, this.onTap);

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: color.withOpacity(0.08), borderRadius: BorderRadius.circular(14), border: Border.all(color: color.withOpacity(0.2))),
      child: Row(children: [
        Icon(icon, color: color, size: 28),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(color: color)),
          Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
        ])),
        Icon(Icons.chevron_right, color: color),
      ]),
    ),
  );
}

class _FaqList extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FutureBuilder(
      future: createDioClient().get('/api/v1/support/faqs'),
      builder: (_, snap) {
        if (snap.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());
        if (snap.hasError || snap.data == null) return const Text('Could not load FAQs');
        final faqs = (snap.data!.data['data'] as List).cast<Map<String, dynamic>>();
        return Column(children: faqs.map((f) => ExpansionTile(
          title: Text(f['question']?.toString() ?? '', style: const TextStyle(fontFamily: 'Outfit', fontWeight: FontWeight.w500)),
          children: [Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 12), child: Text(f['answer']?.toString() ?? '', style: Theme.of(context).textTheme.bodyMedium))],
        )).toList());
      },
    );
  }
}
