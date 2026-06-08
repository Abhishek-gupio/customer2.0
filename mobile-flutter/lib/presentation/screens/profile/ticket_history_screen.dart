import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/router/app_router.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';
import 'package:intl/intl.dart';

final _ticketsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final res = await createDioClient().get('/api/v1/support/tickets');
  return (res.data['data'] as List).cast<Map<String, dynamic>>();
});

class TicketHistoryScreen extends ConsumerWidget {
  const TicketHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_ticketsProvider);
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('My Tickets')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const Center(child: Text('Failed to load tickets')),
        data: (tickets) => tickets.isEmpty
            ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.support_agent_outlined, size: 80, color: AppColors.border),
                const SizedBox(height: 16),
                Text('No support tickets', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                const Text('Submit a ticket if you need help', style: TextStyle(color: AppColors.textSecondary)),
              ]))
            : RefreshIndicator(
                onRefresh: () => ref.refresh(_ticketsProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: tickets.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => _TicketCard(ticket: tickets[i]),
                ),
              ),
      ),
    );
  }
}

class _TicketCard extends StatelessWidget {
  final Map<String, dynamic> ticket;
  const _TicketCard({required this.ticket});

  static const _statusColors = <String, Color>{
    'OPEN': AppColors.primary,
    'IN_PROGRESS': AppColors.warning,
    'RESOLVED': AppColors.success,
    'CLOSED': AppColors.textSecondary,
  };

  @override
  Widget build(BuildContext context) {
    final status = ticket['status']?.toString() ?? 'OPEN';
    final color = _statusColors[status] ?? AppColors.primary;
    final ts = ticket['createdAt'] != null
        ? DateFormat('d MMM yyyy').format(DateTime.parse(ticket['createdAt']))
        : '';
    return GestureDetector(
      onTap: () {
        final id = ticket['id']?.toString();
        if (id != null) context.push('/profile/tickets/$id');
      },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(
              ticket['subject']?.toString() ?? 'Support Ticket',
              style: Theme.of(context).textTheme.titleMedium,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            )),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
              child: Text(status.replaceAll('_', ' '), style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
            ),
          ]),
          const SizedBox(height: 6),
          Text(
            ticket['description']?.toString() ?? '-',
            style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 6),
          Row(children: [
            Text(ticket['category']?.toString() ?? 'GENERAL',
                style: const TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w600)),
            const Spacer(),
            Text(ts, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ]),
        ]),
      ),
    );
  }
}
