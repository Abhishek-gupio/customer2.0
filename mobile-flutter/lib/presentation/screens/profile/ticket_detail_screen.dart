import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gupio_customer/infrastructure/http/dio_client.dart';
import 'package:gupio_customer/presentation/theme/app_theme.dart';
import 'package:intl/intl.dart';

final _ticketDetailProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, id) async {
  final res = await createDioClient().get('/api/v1/support/tickets/$id');
  return res.data['data'] as Map<String, dynamic>;
});

class TicketDetailScreen extends ConsumerStatefulWidget {
  final String ticketId;
  const TicketDetailScreen({super.key, required this.ticketId});

  @override
  ConsumerState<TicketDetailScreen> createState() => _TicketDetailScreenState();
}

class _TicketDetailScreenState extends ConsumerState<TicketDetailScreen> {
  final _msgCtrl = TextEditingController();
  bool _sending = false;

  @override
  void dispose() { _msgCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_ticketDetailProvider(widget.ticketId));
    return async.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(appBar: AppBar(title: const Text('Ticket')), body: Center(child: Text('Error: $e'))),
      data: (ticket) {
        final messages = (ticket['messages'] as List? ?? []).cast<Map<String, dynamic>>();
        return Scaffold(
          backgroundColor: AppColors.background,
          appBar: AppBar(
            title: Text(ticket['subject']?.toString() ?? 'Ticket', overflow: TextOverflow.ellipsis),
            actions: [_StatusChip(ticket: ticket)],
          ),
          body: Column(children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _TicketHeader(ticket: ticket),
                  const SizedBox(height: 16),
                  ...messages.map((m) => _MessageBubble(message: m)),
                  const SizedBox(height: 80),
                ],
              ),
            ),
            if (ticket['status'] != 'CLOSED' && ticket['status'] != 'RESOLVED')
              _ReplyBox(
                ctrl: _msgCtrl,
                sending: _sending,
                onSend: () async {
                  if (_msgCtrl.text.trim().isEmpty) return;
                  setState(() => _sending = true);
                  try {
                    await createDioClient().post('/api/v1/support/tickets/${widget.ticketId}/messages', data: {
                      'content': _msgCtrl.text.trim(),
                    });
                    _msgCtrl.clear();
                    ref.invalidate(_ticketDetailProvider(widget.ticketId));
                  } catch (_) {} finally { if (mounted) setState(() => _sending = false); }
                },
              ),
          ]),
        );
      },
    );
  }
}

class _StatusChip extends StatelessWidget {
  final Map<String, dynamic> ticket;
  const _StatusChip({required this.ticket});

  static const _colors = <String, Color>{
    'OPEN': AppColors.primary, 'IN_PROGRESS': AppColors.warning,
    'RESOLVED': AppColors.success, 'CLOSED': AppColors.textSecondary,
  };

  @override
  Widget build(BuildContext context) {
    final status = ticket['status']?.toString() ?? 'OPEN';
    final color = _colors[status] ?? AppColors.primary;
    return Padding(
      padding: const EdgeInsets.only(right: 12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
        child: Text(status.replaceAll('_', ' '), style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700)),
      ),
    );
  }
}

class _TicketHeader extends StatelessWidget {
  final Map<String, dynamic> ticket;
  const _TicketHeader({required this.ticket});

  @override
  Widget build(BuildContext context) {
    final ts = ticket['createdAt'] != null
        ? DateFormat('d MMM yyyy, h:mm a').format(DateTime.parse(ticket['createdAt']))
        : '';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(ticket['description']?.toString() ?? '-', style: const TextStyle(fontSize: 14, height: 1.5)),
        const SizedBox(height: 8),
        Row(children: [
          Text(ticket['category']?.toString() ?? 'GENERAL',
              style: const TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.w600)),
          const Spacer(),
          Text(ts, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        ]),
      ]),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final Map<String, dynamic> message;
  const _MessageBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final isCustomer = message['senderType']?.toString() == 'CUSTOMER';
    final ts = message['createdAt'] != null
        ? DateFormat('h:mm a').format(DateTime.parse(message['createdAt']))
        : '';
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: isCustomer ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          if (!isCustomer) ...[
            Container(
              width: 32, height: 32,
              decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
              child: const Icon(Icons.support_agent, color: Colors.white, size: 16),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isCustomer ? AppColors.primary : AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: isCustomer ? null : Border.all(color: AppColors.border),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(message['content']?.toString() ?? '',
                  style: TextStyle(color: isCustomer ? Colors.white : AppColors.textPrimary, fontSize: 14, height: 1.4)),
              const SizedBox(height: 4),
              Text(ts, style: TextStyle(fontSize: 11, color: isCustomer ? Colors.white60 : AppColors.textSecondary)),
            ]),
          )),
        ],
      ),
    );
  }
}

class _ReplyBox extends StatelessWidget {
  final TextEditingController ctrl;
  final bool sending;
  final VoidCallback onSend;
  const _ReplyBox({required this.ctrl, required this.sending, required this.onSend});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
    decoration: const BoxDecoration(color: AppColors.surface, border: Border(top: BorderSide(color: AppColors.border))),
    child: SafeArea(
      child: Row(children: [
        Expanded(child: TextField(
          controller: ctrl,
          decoration: const InputDecoration(hintText: 'Add a reply...', border: InputBorder.none, contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 4)),
          maxLines: 3, minLines: 1,
        )),
        const SizedBox(width: 8),
        IconButton(
          onPressed: sending ? null : onSend,
          icon: sending
              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.send, color: AppColors.primary),
        ),
      ]),
    ),
  );
}
